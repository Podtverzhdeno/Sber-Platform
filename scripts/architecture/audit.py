#!/usr/bin/env python3
"""Read-only Python/TS dependency, source and migration audit. stdlib only."""
from __future__ import annotations
import argparse
import ast
from collections import Counter, defaultdict
from datetime import date
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
from typing import Any

EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".scss", ".sql"}
GENERATED = {"frontend/src/api/schema.ts"}
TS_IMPORT = re.compile(r'(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["\x27]([^"\x27]+)["\x27]|^\s*import\s*["\x27]([^"\x27]+)["\x27]', re.M)
MIGRATION = re.compile(r'(?m)^\s*(revision|down_revision)\s*(?::[^=\n]+)?=\s*(.+?)\s*$')


def filenames(root: Path) -> list[str]:
    p = subprocess.run(["git", "-C", str(root), "ls-files", "-z"], capture_output=True, check=False)
    if p.returncode == 0:
        return sorted(x.decode() for x in p.stdout.split(b"\0") if x)
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*")
                  if p.is_file() and not {".git", "node_modules", ".venv", "dist"}.intersection(p.parts))


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
    return next((x for x in (base, base + ".ts", base + ".tsx", base + ".js",
                              base + ".scss", base + ".css", base + "/index.ts",
                              base + "/index.tsx") if x in known), None)


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
    details = {}
    for name, contents in files.items():
        parsed: dict[str, Any] = {}
        for match in MIGRATION.finditer(contents):
            try:
                parsed[match.group(1)] = ast.literal_eval(match.group(2))
            except (ValueError, SyntaxError):
                parsed[match.group(1)] = None
        details[name] = parsed
    ids = {x.get("revision") for x in details.values() if isinstance(x.get("revision"), str)}
    parents: set[str] = set()
    for x in details.values():
        prev = x.get("down_revision")
        if isinstance(prev, str):
            parents.add(prev)
        elif isinstance(prev, (tuple, list)):
            parents.update(y for y in prev if isinstance(y, str))
    return {"count": len(details), "heads": sorted(ids - parents),
            "orphan_parents": sorted(parents - ids),
            "missing_revision": sorted(p for p, x in details.items() if not x.get("revision"))}


def analyze(root: Path) -> dict[str, Any]:
    all_files = filenames(root)
    known = set(all_files)
    graph: dict[str, set[str]] = defaultdict(set)
    forbidden: list[dict[str, Any]] = []
    cross_features: list[dict[str, Any]] = []
    failures: list[str] = []
    biggest = []
    mig = {}
    counts: Counter[str] = Counter()
    edges_scanned = 0
    for path in all_files:
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
        biggest.append({"path": path, "lines": source.count("\n") + 1, "bytes": len(source.encode()), "kind": kind})
        if kind == "migration":
            mig[path] = source
        if kind == "generated":
            continue
        if path.endswith(".py"):
            try:
                tree = ast.parse(source, filename=path)
            except SyntaxError:
                failures.append(path)
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    modules = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    if node.level:
                        package = PurePosixPath(path).parts[1:-1]
                        ancestor = package[:len(package) - (node.level - 1)]
                        base = ".".join((*ancestor, *(node.module.split(".") if node.module else [])))
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
                edges_scanned += 1
                dest = ts_file(path, spec, known)
                if dest and dest != path:
                    graph[path].add(dest)
                    a, b = PurePosixPath(path).parts, PurePosixPath(dest).parts
                    if kind == category(dest) == "frontend/feature" and len(a) > 3 and len(b) > 3 and a[3] != b[3]:
                        cross_features.append({"path": path, "line": source.count("\n", 0, match.start()) + 1, "target": dest})
        graph.setdefault(path, set())
    biggest.sort(key=lambda x: x["bytes"], reverse=True)
    return {"tracked": len(all_files), "sources": sum(v for k, v in counts.items() if k != "non_source"),
            "categories": dict(counts), "imports_scanned": edges_scanned,
            "edges": sum(len(x) for x in graph.values()),
            "forbidden_imports": sorted(forbidden, key=lambda x: (x["path"], x["line"])),
            "cross_feature_imports": cross_features, "cycles": strongly_connected(graph),
            "migration_graph": migrations(mig), "unreadable_or_invalid": sorted(failures),
            "largest": [x for x in biggest if x["kind"] != "generated"][:40]}


def as_markdown(r: dict[str, Any]) -> str:
    lines = ["# Architecture audit", "",
             f"Tracked: {r['tracked']}, sources: {r['sources']}, dependency edges: {r['edges']}",
             f"Forbidden imports: {len(r['forbidden_imports'])}, cycles: {len(r['cycles'])}, migration heads: {len(r['migration_graph']['heads'])}",
             "", "## Forbidden imports", ""]
    lines += [f"- {x['path']}:{x['line']} imports {x['module']}" for x in r["forbidden_imports"]]
    lines += ["", "## Import cycles", ""]
    lines += ["- " + " -> ".join(c) for c in r["cycles"][:30]]
    lines += ["", "## Largest handwritten files", "", "| File | Lines | Bytes |", "|---|---:|---:|"]
    lines += [f"| {x['path']} | {x['lines']} | {x['bytes']} |" for x in r["largest"][:30]]
    lines += ["", "## Migration graph", "", json.dumps(r["migration_graph"], indent=2), "",
              "Static scan: runtime, dynamic imports, performance and RBAC still need executable tests."]
    return "\n".join(lines) + "\n"



def baseline_regressions(report: dict[str, Any], baseline: dict[str, Any]) -> list[str]:
    allowed = {
        (x["path"], x["module"]): x
        for x in baseline.get("exceptions", [])
    }
    errors = []
    for violation in report["forbidden_imports"]:
        key = (violation["path"], violation["module"])
        existing = allowed.get(key)
        if existing is None:
            errors.append("New forbidden import: " + violation["path"] + " -> " + violation["module"])
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
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/impulse-architecture"))
    parser.add_argument("--fail-on-domain-violations", action="store_true")
    parser.add_argument("--fail-on-new", action="store_true")
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    report = analyze(args.root.resolve())
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "architecture.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output_dir / "architecture.md").write_text(as_markdown(report), encoding="utf-8")
    print(as_markdown(report).split("## Forbidden imports")[0])
    if args.fail_on_new:
        baseline_path = args.baseline or (args.root / "scripts/architecture/legacy-imports.json")
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        problems = baseline_regressions(report, baseline)
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
