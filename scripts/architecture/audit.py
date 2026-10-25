#!/usr/bin/env python3
"""Read-only Python/TS dependency, source and migration audit. stdlib only."""

from __future__ import annotations

import argparse
import ast
import json
import re
import shutil
import subprocess
import tomllib
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any

EXT = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".css",
    ".scss",
    ".sql",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".html",
}
GENERATED = {"frontend/src/api/schema.ts", "openapi.json"}
TS_IMPORT = re.compile(
    r'(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["\x27]([^"\x27]+)["\x27]|^\s*import\s*["\x27]([^"\x27]+)["\x27]',
    re.M,
)
MIGRATION = re.compile(r"(?m)^\s*(revision|down_revision)\s*(?::[^=\n]+)?=\s*(.+?)\s*$")


def filenames(root: Path) -> list[str]:
    git_executable = shutil.which("git")
    if git_executable is not None:
        # Shell is disabled; argv and executable are fixed, only the checkout directory varies.
        p = subprocess.run(  # noqa: S603 - fixed argv; shell=False
            [git_executable, "-C", str(root), "ls-files", "-z"],
            capture_output=True,
            check=False,
        )
        if p.returncode == 0:
            return sorted(x.decode() for x in p.stdout.split(b"\0") if x)
    return sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and not {".git", "node_modules", ".venv", "dist"}.intersection(p.parts)
    )


def category(path: str) -> str:
    parts = PurePosixPath(path).parts
    if len(parts) > 2 and parts[:2] == ("src", "impulse"):
        return parts[2]
    if path.startswith("frontend/src/features/"):
        return "frontend/feature"
    if path.startswith("frontend/src/"):
        return "frontend/shared"
    if path.startswith("migrations/versions/"):
        return "migration"
    if path.startswith(("tests/", "frontend/e2e/")) or ".test." in path:
        return "test"
    return "other"


def python_file(module: str, known: set[str]) -> str | None:
    stem = "src/" + module.replace(".", "/")
    return next((x for x in (stem + ".py", stem + "/__init__.py") if x in known), None)


def ts_file(origin: str, imported: str, known: set[str]) -> str | None:
    if not imported.startswith("."):
        return None
    parts: list[str] = []
    for x in (PurePosixPath(origin).parent / imported).parts:
        if x == "..":
            if parts:
                parts.pop()
        elif x != ".":
            parts.append(x)
    base = "/".join(parts)
    return next(
        (
            x
            for x in (
                base,
                base + ".ts",
                base + ".tsx",
                base + ".js",
                base + ".scss",
                base + ".css",
                base + "/index.ts",
                base + "/index.tsx",
            )
            if x in known
        ),
        None,
    )


def prohibited(source: str, module: str) -> bool:
    if not module.startswith("impulse."):
        return False
    destination = module.split(".")[1]
    return destination in {
        "domain": {"api", "application", "infrastructure", "bootstrap", "integrations"},
        "application": {"api", "infrastructure", "bootstrap"},
        "infrastructure": {"api", "bootstrap"},
    }.get(source, set())


def strongly_connected(graph: dict[str, set[str]]) -> list[list[str]]:
    next_id = 0
    ids: dict[str, int] = {}
    lows: dict[str, int] = {}
    stack: list[str] = []
    active: set[str] = set()
    result: list[list[str]] = []

    def visit(v: str) -> None:
        nonlocal next_id
        ids[v] = lows[v] = next_id
        next_id += 1
        active.add(v)
        stack.append(v)
        for w in sorted(graph.get(v, set())):
            if w not in ids:
                visit(w)
                lows[v] = min(lows[v], lows[w])
            elif w in active:
                lows[v] = min(lows[v], ids[w])
        if lows[v] == ids[v]:
            component: list[str] = []
            while True:
                w = stack.pop()
                active.remove(w)
                component.append(w)
                if w == v:
                    break
            if len(component) > 1 or v in graph.get(v, set()):
                result.append(sorted(component))

    for node in sorted(graph):
        if node not in ids:
            visit(node)
    return sorted(result, key=lambda x: (-len(x), x[0]))


def migrations(files: dict[str, str]) -> dict[str, Any]:
    """Validate static Alembic lineage, including duplicate and cyclic revisions."""
    details: dict[str, dict[str, Any]] = {}
    by_revision: dict[str, list[str]] = defaultdict(list)
    for name, contents in files.items():
        parsed: dict[str, Any] = {}
        for match in MIGRATION.finditer(contents):
            try:
                parsed[match.group(1)] = ast.literal_eval(match.group(2))
            except (ValueError, SyntaxError):
                parsed[match.group(1)] = None
        details[name] = parsed
        revision = parsed.get("revision")
        if isinstance(revision, str):
            by_revision[revision].append(name)

    parents_by_revision: dict[str, set[str]] = {}
    for parsed in details.values():
        revision = parsed.get("revision")
        if not isinstance(revision, str):
            continue
        prev = parsed.get("down_revision")
        if isinstance(prev, str):
            parents_by_revision[revision] = {prev}
        elif isinstance(prev, (tuple, list)):
            parents_by_revision[revision] = {x for x in prev if isinstance(x, str)}
        else:
            parents_by_revision[revision] = set()

    ids = set(parents_by_revision)
    all_parents = set().union(*parents_by_revision.values()) if parents_by_revision else set()
    heads = sorted(ids - all_parents)
    visited: set[str] = set()
    visiting: set[str] = set()
    cycle_nodes: set[str] = set()

    def visit(node: str) -> None:
        if node in visiting:
            cycle_nodes.add(node)
            return
        if node in visited:
            return
        visiting.add(node)
        for parent in parents_by_revision.get(node, set()) & ids:
            visit(parent)
        visiting.remove(node)
        visited.add(node)

    for revision in sorted(ids):
        visit(revision)
    reachable: set[str] = set()
    pending = list(heads)
    while pending:
        node = pending.pop()
        if node in reachable:
            continue
        reachable.add(node)
        pending.extend(parents_by_revision.get(node, set()) & ids)

    return {
        "count": len(details),
        "heads": heads,
        "orphan_parents": sorted(all_parents - ids),
        "missing_revision": sorted(p for p, x in details.items() if not x.get("revision")),
        "duplicate_revision": {
            revision: sorted(names)
            for revision, names in sorted(by_revision.items())
            if len(names) > 1
        },
        "cyclic_revisions": sorted(cycle_nodes),
        "unreachable_from_heads": sorted(ids - reachable),
    }


def runtime_ast_nodes(tree: ast.AST):
    """Exclude import edges that exist only under typing.TYPE_CHECKING."""
    for child in ast.iter_child_nodes(tree):
        if isinstance(child, ast.If) and (
            (isinstance(child.test, ast.Name) and child.test.id == "TYPE_CHECKING")
            or (isinstance(child.test, ast.Attribute) and child.test.attr == "TYPE_CHECKING")
        ):
            for node in child.orelse:
                yield node
                yield from runtime_ast_nodes(node)
            continue
        yield child
        yield from runtime_ast_nodes(child)


def type_only_ts_import(source: str, offset: int) -> bool:
    prefix = source[max(0, offset - 500) : offset]
    # Find the active import statement, ignoring previous completed statements.
    current = prefix.rsplit(";", 1)[-1]
    return bool(re.search(r"\bimport\s+type\b", current))


def analyze(root: Path) -> dict[str, Any]:
    all_files = filenames(root)
    known = set(all_files)
    graph: dict[str, set[str]] = defaultdict(set)
    forbidden: list[dict[str, Any]] = []
    cross_features: list[dict[str, Any]] = []
    failures: list[str] = []
    css_risks: list[dict[str, Any]] = []
    biggest = []
    mig = {}
    counts: Counter[str] = Counter()
    edges_scanned = 0
    type_edges_skipped = 0
    manifest: list[dict[str, Any]] = []
    for path in all_files:
        manifest.append(
            {
                "path": path,
                "bytes": (root / path).stat().st_size,
                "kind": (
                    "generated"
                    if path in GENERATED
                    else category(path)
                    if Path(path).suffix in EXT
                    else "asset_or_document"
                ),
            }
        )
        if Path(path).suffix not in EXT:
            counts["non_source"] += 1
            continue
        kind = "generated" if path in GENERATED else category(path)
        counts[kind] += 1
        try:
            source = (root / path).read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            failures.append(path)
            continue
        biggest.append(
            {
                "path": path,
                "lines": source.count("\n") + 1,
                "bytes": len(source.encode()),
                "kind": kind,
            }
        )
        if kind == "migration":
            mig[path] = source
        if kind == "generated":
            continue
        if path.startswith("frontend/src/") and path.endswith((".scss", ".css")):
            css_risks.append(
                {
                    "path": path,
                    "bytes": len(source.encode("utf-8")),
                    "important_count": source.count("!important"),
                    "legacy_imports": len(re.findall(r"@import\\s", source)),
                }
            )
        if path.endswith(".json"):
            try:
                json.loads(source)
            except json.JSONDecodeError:
                failures.append(path)
        elif path.endswith(".toml"):
            try:
                tomllib.loads(source)
            except tomllib.TOMLDecodeError:
                failures.append(path)
        if path.endswith(".py"):
            try:
                tree = ast.parse(source, filename=path)
            except SyntaxError:
                failures.append(path)
                continue
            for node in runtime_ast_nodes(tree):
                if isinstance(node, ast.Import):
                    modules = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    if node.level:
                        package = PurePosixPath(path).parts[1:-1]
                        ancestor = package[: len(package) - (node.level - 1)]
                        base = ".".join(
                            (*ancestor, *(node.module.split(".") if node.module else []))
                        )
                    else:
                        base = node.module or ""
                    modules = [base] if base else []
                    for alias in node.names:
                        child = base + "." + alias.name
                        if python_file(child, known):
                            modules.append(child)
                else:
                    continue
                for module in modules:
                    edges_scanned += 1
                    dest = python_file(module, known)
                    if dest and dest != path:
                        graph[path].add(dest)
                    if prohibited(kind, module):
                        forbidden.append({"path": path, "line": node.lineno, "module": module})
        elif Path(path).suffix in {".ts", ".tsx", ".js", ".jsx", ".mjs"}:
            for match in TS_IMPORT.finditer(source):
                spec = match.group(1) or match.group(2)
                if type_only_ts_import(source, match.start()):
                    type_edges_skipped += 1
                    continue
                edges_scanned += 1
                dest = ts_file(path, spec, known)
                if dest and dest != path:
                    graph[path].add(dest)
                    a, b = PurePosixPath(path).parts, PurePosixPath(dest).parts
                    if (
                        kind == category(dest) == "frontend/feature"
                        and len(a) > 3
                        and len(b) > 3
                        and a[3] != b[3]
                    ):
                        cross_features.append(
                            {
                                "path": path,
                                "line": source.count("\n", 0, match.start()) + 1,
                                "target": dest,
                            }
                        )
        graph.setdefault(path, set())
    biggest.sort(key=lambda x: x["bytes"], reverse=True)
    return {
        "tracked": len(all_files),
        "manifest": manifest,
        "sources": sum(v for k, v in counts.items() if k != "non_source"),
        "categories": dict(counts),
        "imports_scanned": edges_scanned,
        "edges": sum(len(x) for x in graph.values()),
        "type_only_edges_skipped": type_edges_skipped,
        "forbidden_imports": sorted(forbidden, key=lambda x: (x["path"], x["line"])),
        "cross_feature_imports": cross_features,
        "css_risks": sorted(css_risks, key=lambda x: x["bytes"], reverse=True),
        "cycles": strongly_connected(graph),
        "migration_graph": migrations(mig),
        "unreadable_or_invalid": sorted(failures),
        "largest": [x for x in biggest if x["kind"] != "generated"][:40],
    }


def as_markdown(r: dict[str, Any]) -> str:
    lines = [
        "# Architecture audit",
        "",
        f"Tracked: {r['tracked']}, sources: {r['sources']}, dependency edges: {r['edges']}",
        (
            f"Forbidden imports: {len(r['forbidden_imports'])}, "
            f"cycles: {len(r['cycles'])}, "
            f"migration heads: {len(r['migration_graph']['heads'])}"
        ),
        "",
        "## Forbidden imports",
        "",
    ]
    lines += [f"- {x['path']}:{x['line']} imports {x['module']}" for x in r["forbidden_imports"]]
    lines += ["", "## Import cycles", ""]
    lines += ["- " + " -> ".join(c) for c in r["cycles"][:30]]
    lines += ["", "## Frontend runtime cross-feature imports", ""]
    lines += [f"- {x['path']}:{x['line']} -> {x['target']}" for x in r["cross_feature_imports"][:40]]
    lines += [
        "",
        "## CSS review signals (size and overrides do not alone prove defects)",
        "",
        "| Stylesheet | Bytes | !important | legacy @import |",
        "|---|---:|---:|---:|",
    ]
    lines += [
        f"| {x['path']} | {x['bytes']} | {x['important_count']} | {x['legacy_imports']} |"
        for x in r["css_risks"][:20]
    ]
    lines += ["", "## Largest handwritten files", "", "| File | Lines | Bytes |", "|---|---:|---:|"]
    lines += [f"| {x['path']} | {x['lines']} | {x['bytes']} |" for x in r["largest"][:30]]
    lines += [
        "",
        "## Migration graph",
        "",
        json.dumps(r["migration_graph"], indent=2),
        "",
        "Static scan: runtime, dynamic imports, performance and RBAC still need executable tests.",
    ]
    return "\n".join(lines) + "\n"


def baseline_regressions(report: dict[str, Any], baseline: dict[str, Any]) -> list[str]:
    allowed = {(x["path"], x["module"]): x for x in baseline.get("exceptions", [])}
    errors = []
    for violation in report["forbidden_imports"]:
        key = (violation["path"], violation["module"])
        existing = allowed.get(key)
        if existing is None:
            errors.append(
                "New forbidden import: " + violation["path"] + " -> " + violation["module"]
            )
        elif not existing.get("owner") or not existing.get("expires"):
            errors.append("Unowned legacy exception: " + violation["path"])
        elif date.fromisoformat(existing["expires"]) < date.today():
            errors.append("Expired legacy exception: " + violation["path"])
    allowed_cycles = {tuple(sorted(x)) for x in baseline.get("allowed_cycles", [])}
    for group in report["cycles"]:
        if tuple(sorted(group)) not in allowed_cycles:
            errors.append("New import cycle: " + " -> ".join(group))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output-dir", type=Path, default=Path.cwd() / ".architecture-report")
    parser.add_argument("--fail-on-domain-violations", action="store_true")
    parser.add_argument("--fail-on-new", action="store_true")
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    report = analyze(args.root.resolve())
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "architecture.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (args.output_dir / "architecture.md").write_text(as_markdown(report), encoding="utf-8")
    print(as_markdown(report).split("## Forbidden imports")[0])
    if args.fail_on_new:
        baseline_path = args.baseline or (args.root / "scripts/architecture/legacy-imports.json")
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        problems = baseline_regressions(report, baseline)
        if report["unreadable_or_invalid"]:
            problems.append(
                "Invalid or unreadable tracked sources: "
                + ", ".join(report["unreadable_or_invalid"])
            )
        migration = report["migration_graph"]
        if (
            len(migration["heads"]) != 1
            or migration["orphan_parents"]
            or migration["missing_revision"]
            or migration["duplicate_revision"]
            or migration["cyclic_revisions"]
            or migration["unreachable_from_heads"]
        ):
            problems.append("Migration graph invalid: " + json.dumps(migration))
        for problem in problems:
            print("ARCHITECTURE REGRESSION: " + problem)
        if problems:
            return 1
    if args.fail_on_domain_violations and any(
        category(x["path"]) == "domain" for x in report["forbidden_imports"]
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
