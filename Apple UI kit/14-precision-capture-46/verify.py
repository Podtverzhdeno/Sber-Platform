#!/usr/bin/env python3
"""Check Apple UI kit 46-case capture registry, using the standard library only."""

import csv
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
doc = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
items = doc["entries"]
assert len(items) == 46, "expected all 46 Apple reference targets"
assert doc["official_kit_layers_inspected"] is False
assert doc["pixel_parity_verified"] is False
assert [e["id"] for e in items] == [f"APP-CAP-{i:03d}" for i in range(1, 47)]
# Keep this precision registry aligned with the 46-item parent capture queue.
# The parent may document a broader visual catalog; that is a separate inventory.
parent_atlas = (root.parent / "COMPONENT_ATLAS.md").read_text(encoding="utf-8")
queue = re.search(
    r"## 46 study targets.*?(?=## Baseline design requirements)",
    parent_atlas,
    flags=re.DOTALL,
)
assert queue is not None, "parent 46-item capture queue was renamed"
parent_targets = re.findall(r"^(\d+)\.\s+(.+)$", queue.group(), flags=re.MULTILINE)
assert len(parent_targets) == 46, "capture queue changed: reconcile IDs and cases"
for position, (raw_number, title) in enumerate(parent_targets, 1):
    assert int(raw_number) == position, "capture case order changed"
    assert title == items[position - 1]["title"], "capture target title changed"

assert len({e["record_path"] for e in items}) == 46
for e in items:
    path = root / e["record_path"]
    assert path.resolve().is_relative_to(root.resolve())
    assert path.is_file(), e["record_path"]
    content = path.read_text(encoding="utf-8")
    assert e["id"] in content and e["hig_url"] in content
    assert e["hig_url"].startswith("https://developer.apple.com/design/")
    assert e["hig_url"] != "https://developer.apple.com/design/human-interface-guidelines/", e["id"]
    assert e["source_frame_id"] is None
    assert e["geometry_px"] is None
    assert e["status"] == "MEASUREMENT_PENDING"
    assert e["pixel_parity"] == "NOT_CLAIMED"
with (root / "measurement-ledger.csv").open(encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))
assert len(rows) == 46
assert [x["id"] for x in rows] == [e["id"] for e in items]
assert all(x["status"] == "MEASUREMENT_PENDING" for x in rows)
assert all(x["frame_id"] == "" and x["artifact_sha256"] == "" for x in rows)
# Verify embedded lab case-index and 14-category coverage without a browser.
lab = (root / "interactive-state-lab.html").read_text(encoding="utf-8")
found = re.search(r"const cases=(\[.*?\]),get=s=>document.querySelector", lab, flags=re.DOTALL)
assert found is not None, "embedded lab manifest missing"
lab_cases = json.loads(found.group(1))
assert len(lab_cases) == len(items)
assert [case["id"] for case in lab_cases] == [e["id"] for e in items]
assert all(case["doc"] == e["record_path"] for case, e in zip(lab_cases, items))
assert all(case["source"] == e["hig_url"] for case, e in zip(lab_cases, items))
categories = set(e["category"] for e in items)
assert len(categories) == 14, f"expected 14 web study pattern families, found {len(categories)}"
for category in categories:
    assert (category + ":()=>") in lab or ('"' + category + '":()=>') in lab, category
assert "<dialog" in lab and 'role="status"' in lab
assert "prefers-reduced-motion" in lab and "prefers-reduced-transparency" in lab
assert "forced-colors" in lab and "focus-visible" in lab
assert "<script src=" not in lab and "https://raw.githubusercontent.com" not in lab
# Verify candidate paths against the actual checked-out Impulse repository.
mapping = json.loads((root / "impulse-integration-candidates.json").read_text(encoding="utf-8"))
targets = mapping["records"]
assert len(targets) == 46
assert [x["id"] for x in targets] == [e["id"] for e in items]
assert mapping["production_code_modified_by_this_task"] is False
assert mapping["component_ownership_or_runtime_usage_verified"] is False
repo_root = root.parents[1]
for target in targets:
    assert target["review_level"] == "CANDIDATE_PATH_VERIFIED_ONLY"
    assert target["source_frame_status"] == "MEASUREMENT_PENDING"
    assert target["adoption_status"] == "NOT_IMPLEMENTED_BY_THIS_REFERENCE_TASK"
    assert target["owner_visual_geometry_precedence"] is True
    assert target["path_candidates"], target["id"]
    for relative in target["path_candidates"]:
        path = repo_root / relative
        assert path.resolve().is_relative_to(repo_root.resolve()), relative
        assert path.is_file(), f"missing candidate: {relative}"

# Source-index integrity, without network calls or assumptions about Apple layer measurements.
source_index = json.loads((root / "official-source-index.json").read_text(encoding="utf-8"))
sources = source_index["sources"]
assert len(sources) == source_index["source_count"] == 24
assert source_index["case_count"] == len(items) == 46
assert source_index["editable_apple_layers_inspected"] is False
assert source_index["apple_copyrighted_assets_included"] is False
assert {entry["url"] for entry in sources} == {entry["hig_url"] for entry in items}
for source in sources:
    assert source["url"].startswith(
        "https://developer.apple.com/design/human-interface-guidelines/"
    )
    assert source["status"] == "OFFICIAL_HIG_CHAPTER_RESOLVED"
    assert source["source_images_copied"] is False
    assert source["source_frame_geometry_measured"] is False
    assert source["case_ids"] == [
        entry["id"] for entry in items if entry["hig_url"] == source["url"]
    ]

# Offline screenshot comparator source integrity. Runtime checks live in separate tests.
pixel_html = (root / "pixel-compare.html").read_text(encoding="utf-8")
for required in (
    "function differences(",
    "function loadImage(",
    "pixel_parity_certified:false",
    "source_geometry_verified:false",
    "URL.createObjectURL",
    'href="../PIXEL_PARITY_QA.md"',
    "rgba_0_255",
    'id="reference-file"',
    'id="actual-file"',
    'id="heatmap"',
):
    assert required in pixel_html, f"pixel-compare missing: {required}"
assert not re.search(r"<script\b[^>]*\bsrc=", pixel_html, re.IGNORECASE)
assert (root / "test_pixel_compare.cjs").is_file()
assert (root / "qa_pixel_compare.py").is_file()
assert (root / "PIXEL_COMPARE_WORKFLOW.md").is_file()

print(
    f"OK: {len(items)} case folders, {len(rows)} ledger rows, "
    f"{len(lab_cases)} indexed lab cases, {len(categories)} original study pattern families; "
    "no fabricated Apple measurements"
)
