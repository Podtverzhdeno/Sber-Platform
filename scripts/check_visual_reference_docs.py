"""Validate visual reference inventory, route traceability, and asset boundaries."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

CATALOG = Path("openspec/changes/impulse-ecosystem/docs/visual-reference-catalog.md")
TRACEABILITY = Path("openspec/changes/impulse-ecosystem/docs/visual-route-traceability.md")
REFERENCE_ID = re.compile(r"R-(?:PAR|MEN|CUS|MGR|OPS)-\d{2}")
TABLE_REFERENCE = re.compile(r"^\| `(?P<reference>R-(?:PAR|MEN|CUS|MGR|OPS)-\d{2})`", re.MULTILINE)
EXPECTED_ROLE_COUNTS = {"PAR": 12, "MEN": 8, "CUS": 9, "MGR": 8, "OPS": 9}
SOURCE_SUFFIXES = {".css", ".html", ".js", ".jsx", ".json", ".ts", ".tsx"}
RASTER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _table_references(path: Path) -> list[str]:
    return TABLE_REFERENCE.findall(path.read_text(encoding="utf-8"))


def _assert_unique(label: str, references: list[str]) -> None:
    duplicates = sorted(reference for reference, count in Counter(references).items() if count > 1)
    if duplicates:
        raise AssertionError(f"Duplicate {label} references: {', '.join(duplicates)}")


def _trace_rows() -> dict[str, str]:
    rows: dict[str, str] = {}
    for line in TRACEABILITY.read_text(encoding="utf-8").splitlines():
        match = TABLE_REFERENCE.match(line)
        if match is None:
            continue
        columns = [column.strip() for column in line.strip("|").split("|")]
        if len(columns) != 4:
            raise AssertionError(f"Invalid traceability row: {line}")
        rows[match.group("reference")] = columns[-1]
    return rows


def _explicit_test_references() -> set[str]:
    references: set[str] = set()
    roots = (Path("frontend/e2e"), Path("frontend/src"))
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or not (
                path.name.endswith(".spec.ts") or path.name.endswith(".test.tsx")
            ):
                continue
            references.update(REFERENCE_ID.findall(path.read_text(encoding="utf-8")))
    return references


def _check_asset_boundary() -> None:
    frontend = Path("frontend")
    excluded = {"node_modules", "dist", "playwright-report", "test-results", "coverage"}
    for path in frontend.rglob("*"):
        if not path.is_file() or excluded.intersection(path.parts):
            continue
        if path.suffix.lower() in SOURCE_SUFFIXES:
            text = path.read_text(encoding="utf-8", errors="replace")
            if "Downloads/Визуал" in text or "Downloads\\Визуал" in text:
                raise AssertionError(f"Local visual-reference path leaked into {path}")
        if path.suffix.lower() in RASTER_SUFFIXES and REFERENCE_ID.search(path.name):
            raise AssertionError(f"Reference screenshot must not be bundled: {path}")


def main() -> None:
    """Run deterministic documentation and source-boundary checks."""
    catalog = _table_references(CATALOG)
    traceability = _table_references(TRACEABILITY)
    _assert_unique("catalog", catalog)
    _assert_unique("traceability", traceability)
    if set(catalog) != set(traceability):
        missing = sorted(set(catalog) - set(traceability))
        extra = sorted(set(traceability) - set(catalog))
        raise AssertionError(f"Reference mismatch; missing={missing}, extra={extra}")
    counts = Counter(reference.split("-")[1] for reference in catalog)
    if dict(counts) != EXPECTED_ROLE_COUNTS:
        raise AssertionError(f"Unexpected role counts: {dict(counts)}")

    rows = _trace_rows()
    allowed_markers = ("baseline", "route screenshot", "workflow", "gap")
    invalid_rows = sorted(
        reference
        for reference, coverage in rows.items()
        if not any(marker in coverage for marker in allowed_markers)
    )
    if invalid_rows:
        raise AssertionError(f"Rows without a coverage status: {', '.join(invalid_rows)}")

    explicit_tests = _explicit_test_references()
    claimed_baselines = {
        reference for reference, coverage in rows.items() if coverage.startswith("baseline")
    }
    unproven = sorted(claimed_baselines - explicit_tests)
    if unproven:
        raise AssertionError(f"Baseline claims without explicit test IDs: {', '.join(unproven)}")
    undocumented_tests = sorted(explicit_tests - set(catalog))
    if undocumented_tests:
        raise AssertionError(f"Test IDs absent from catalog: {', '.join(undocumented_tests)}")

    _check_asset_boundary()
    gaps = sum("gap" in coverage for coverage in rows.values())
    print(
        "Visual reference docs check passed: "
        f"{len(catalog)} references, {len(explicit_tests)} explicit baselines, {gaps} gaps"
    )


if __name__ == "__main__":
    main()
