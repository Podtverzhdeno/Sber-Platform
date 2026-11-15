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
assert len({e["record_path"] for e in items}) == 46
for e in items:
    path = root / e["record_path"]
    assert path.resolve().is_relative_to(root.resolve())
    assert path.is_file(), e["record_path"]
    content = path.read_text(encoding="utf-8")
    assert e["id"] in content and e["hig_url"] in content
    assert e["hig_url"].startswith("https://developer.apple.com/design/")
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
assert '<script src=' not in lab and 'https://raw.githubusercontent.com' not in lab
print(f"OK: {len(items)} case folders, {len(rows)} ledger rows, "
      f"{len(lab_cases)} indexed lab cases, {len(categories)} original study pattern families; "
      "no fabricated Apple measurements")
