#!/usr/bin/env python3
"""Synthetic offline tests for reference-link integrity checker."""

import tempfile
import unittest
from pathlib import Path

from audit_reference_links import audit, markdown_urls


class ReferenceLinksTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "category").mkdir()
        (self.root / "category" / "preview.svg").write_text("<svg/>")
        (self.root / "category" / "README.md").write_text("Ready")

    def test_valid_local_and_remote(self):
        (self.root / "README.md").write_text(
            "[Doc](category/README.md) ![SVG](category/preview.svg) [Apple](https://developer.apple.com/design/resources/)"
        )
        counts, errors = audit(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(counts.local, 2)
        self.assertEqual(counts.remote_unverified, 1)

    def test_missing_asset(self):
        (self.root / "README.md").write_text("[missing](category/no.svg)")
        _, errors = audit(self.root)
        self.assertEqual(len(errors), 1)
        self.assertIn("category/no.svg", errors[0])

    def test_encoded_space_and_query(self):
        (self.root / "file name.md").write_text("okay")
        (self.root / "README.md").write_text(
            "[target](file%20name.md?x=1#heading) [anchor](#heading)"
        )
        counts, errors = audit(self.root)
        self.assertFalse(errors)
        self.assertEqual(counts.local, 1)

    def test_html_assets(self):
        (self.root / "gallery.html").write_text(
            '<img src="category/preview.svg"><a href="category/README.md">Open</a>'
        )
        counts, errors = audit(self.root)
        self.assertFalse(errors)
        self.assertEqual(counts.local, 2)

    def test_fenced_example_ignored(self):
        sample = "~~~\n[missing](nowhere)\n~~~\n[valid](category/README.md)"
        self.assertEqual(markdown_urls(sample), ["category/README.md"])

    def test_parent_repo_path_explicitly_excluded(self):
        (self.root / "README.md").write_text("[repo doc](../docs/missing.md)")
        counts, errors = audit(self.root)
        self.assertFalse(errors)
        self.assertEqual(counts.outside_root, 1)


if __name__ == "__main__":
    unittest.main()
