#!/usr/bin/env python3
"""Unit checks for the optional Pillow-based pixel comparison helper."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

SCRIPT = Path(__file__).with_name("compare_reference_pixels.py")


@unittest.skipIf(Image is None, "Pillow optional dependency missing")
class CompareReferencePixelsTest(unittest.TestCase):
    def test_exact_identical(self) -> None:
        with tempfile.TemporaryDirectory() as work:
            p = Path(work)
            a = p / "a.png"
            b = p / "b.png"
            Image.new("RGB", (12, 8), (25, 30, 35)).save(a)
            Image.new("RGB", (12, 8), (25, 30, 35)).save(b)
            run = subprocess.run(
                [sys.executable, str(SCRIPT), str(a), str(b), "--out", str(p / "out")],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            data = json.loads((p / "out" / "report.json").read_text())
            self.assertEqual(data["pixels_mismatched"], 0)
            self.assertIsNone(data["mismatch_bbox_xyxy_exclusive"])
            self.assertEqual(data["mean_absolute_error_rgb"], 0)
            self.assertTrue((p / "out" / "overlay.png").is_file())
            self.assertTrue((p / "out" / "difference.png").is_file())

    def test_one_changed_pixel_and_gate(self) -> None:
        with tempfile.TemporaryDirectory() as work:
            p = Path(work)
            a, b = p / "a.png", p / "b.png"
            Image.new("RGB", (10, 10), (0, 0, 0)).save(a)
            other = Image.new("RGB", (10, 10), (0, 0, 0))
            other.putpixel((3, 4), (60, 0, 0))
            other.save(b)
            run = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    str(a),
                    str(b),
                    "--threshold",
                    "12",
                    "--max-mismatch-pct",
                    "0",
                    "--out",
                    str(p / "out"),
                ],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(run.returncode, 1, run.stderr)
            data = json.loads((p / "out" / "report.json").read_text())
            self.assertEqual(data["pixels_mismatched"], 1)
            self.assertEqual(data["pixels_mismatched_percent"], 1)
            self.assertEqual(data["mismatch_bbox_xyxy_exclusive"], [3, 4, 4, 5])

    def test_dimensions_must_match(self) -> None:
        with tempfile.TemporaryDirectory() as work:
            p = Path(work)
            a, b = p / "a.png", p / "b.png"
            Image.new("RGB", (10, 10), (0, 0, 0)).save(a)
            Image.new("RGB", (11, 10), (0, 0, 0)).save(b)
            run = subprocess.run(
                [sys.executable, str(SCRIPT), str(a), str(b), "--out", str(p / "out")],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(run.returncode, 2)
            self.assertIn("identical CSS viewport", run.stderr)


if __name__ == "__main__":
    unittest.main()
