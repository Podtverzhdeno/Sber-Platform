#!/usr/bin/env python3
"""Check Apple UI kit 46-case capture registry, using the standard library only."""
import csv
import json
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
print("OK: 46 case folders, 46 ledger rows, no fabricated Apple measurements")
