#!/usr/bin/env python3
"""Synthetic tests for the offline Impulse source-crosswalk verifier."""

from __future__ import annotations
import json
from pathlib import Path
import tempfile
import unittest
from verify_impulse_crosswalk import git_blob_sha, verify


class CrosswalkTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.repo = Path(tmp.name)
        src = self.repo / "frontend" / "src"
        src.mkdir(parents=True)
        self.file = src / "demo.tsx"
        self.file.write_text("export const example = 1;\n", encoding="utf-8")
        self.manifest = self.repo / "crosswalk.json"
        self.data = {
            "targets": [
                {
                    "id": "AUI-IMP-001",
                    "impulse_file": "frontend/src/demo.tsx",
                    "impulse_blob_sha_main": git_blob_sha(self.file.read_bytes()),
                    "test_file": None,
                    "test_blob_sha_main": None,
                    "measured_parity": False,
                }
            ]
        }
        self.write()

    def write(self):
        self.manifest.write_text(json.dumps(self.data), encoding="utf-8")

    def test_matching_blob_sha(self):
        errors, warnings = verify(self.repo, self.manifest)
        self.assertEqual((errors, warnings), ([], []))

    def test_stale_sha_warns_but_is_not_a_missing_file(self):
        self.file.write_text("export const example = 2;\n", encoding="utf-8")
        errors, warnings = verify(self.repo, self.manifest)
        self.assertEqual(errors, [])
        self.assertEqual(len(warnings), 1)

    def test_strict_staleness_fails(self):
        self.file.write_text("export const example = 2;\n", encoding="utf-8")
        errors, warnings = verify(self.repo, self.manifest, strict_sha=True)
        self.assertEqual(len(errors), 1)
        self.assertEqual(warnings, [])

    def test_missing_path_detected(self):
        self.file.unlink()
        errors, _ = verify(self.repo, self.manifest)
        self.assertTrue(any("missing" in item for item in errors))

    def test_duplicate_record_detected(self):
        self.data["targets"].append(dict(self.data["targets"][0]))
        self.write()
        errors, _ = verify(self.repo, self.manifest)
        self.assertTrue(any("duplicate" in item for item in errors))

    def test_claimed_apple_parity_not_allowed(self):
        self.data["targets"][0]["measured_parity"] = True
        self.write()
        errors, _ = verify(self.repo, self.manifest)
        self.assertTrue(any("Unsupported Apple" in item for item in errors))

    def test_git_blob_hash_known_fixture(self):
        self.assertEqual(git_blob_sha(b"hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a")


if __name__ == "__main__":
    unittest.main()
