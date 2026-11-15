#!/usr/bin/env python3
"""Offline synthetic fixtures for the structural Apple UI kit audit."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from audit_source_bundle import audit, REQUIRED


class AuditSourceBundleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for item in REQUIRED:
            path = self.root / item
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("test", encoding="utf-8")
        for number in range(1, 14):
            folder = self.root / f"{number:02d}-reference"
            folder.mkdir()
            (folder / "README.md").write_text("A source reference", encoding="utf-8")
            (folder / "references.json").write_text(
                json.dumps(
                    {
                        "category_id": folder.name,
                        "kit_component_layers_inspected": False,
                        "reference_page": "https://developer.apple.com/design/resources/",
                    }
                ),
                encoding="utf-8",
            )
            (folder / "preview.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg"><desc>'
                "NOT an Apple design kit export</desc></svg>",
                encoding="utf-8",
            )
        (self.root / "reference-manifest.json").write_text(
            json.dumps(
                {
                    "meta": {
                        "official_design_kit_layers_inspected": False,
                        "archive_contains_licensed_apple_assets": False,
                        "category_folder_count": 13,
                    }
                }
            ),
            encoding="utf-8",
        )
        items = [
            {
                "id": f"AUI-{i:03d}",
                "reference": {
                    "actual_layer_inspected": False,
                    "url": "https://developer.apple.com/design/human-interface-guidelines/materials",
                },
                "measurements": {"measured": False},
            }
            for i in range(1, 68)
        ]
        (self.root / "component-catalog.json").write_text(
            json.dumps({"total": 67, "components": items}), encoding="utf-8"
        )
        (self.root / "web-implementation/index.html").write_text(
            '<button id="menuBtn">Menu</button>', encoding="utf-8"
        )
        (self.root / "web-implementation/app.js").write_text('el("menuBtn")', encoding="utf-8")

    def test_valid_fixture_passes(self) -> None:
        self.assertEqual(audit(self.root), [])

    def test_missing_dom_id_is_detected(self) -> None:
        (self.root / "web-implementation/app.js").write_text('el("notThere")')
        self.assertTrue(any("missing HTML id" in issue for issue in audit(self.root)))

    def test_false_apple_kit_measurement_is_detected(self) -> None:
        path = self.root / "component-catalog.json"
        payload = json.loads(path.read_text())
        payload["components"][0]["measurements"]["measured"] = True
        path.write_text(json.dumps(payload))
        self.assertTrue(any("false measured state" in issue for issue in audit(self.root)))

    def test_restricted_font_detected(self) -> None:
        (self.root / "SF-Pro.woff2").write_bytes(b"not a real font")
        self.assertTrue(any("restricted third-party binary" in issue for issue in audit(self.root)))

    def test_missing_category_svg_detected(self) -> None:
        (self.root / "01-reference/preview.svg").unlink()
        self.assertTrue(
            any("missing 01-reference/preview.svg" in issue for issue in audit(self.root))
        )


if __name__ == "__main__":
    unittest.main()
