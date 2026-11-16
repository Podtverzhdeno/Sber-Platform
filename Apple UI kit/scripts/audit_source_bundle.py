#!/usr/bin/env python3
"""Offline structural audit of the Impulse Apple UI kit source/reference bundle.

No network calls and no Apple asset downloads. Does NOT perform browser tests
or inspect licensed Figma/Sketch layers.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

REQUIRED = (
    "README.md",
    "REFERENCE_GALLERY.md",
    "OFFICIAL_VISUAL_GALLERY.md",
    "reference-gallery.html",
    "reference-manifest.json",
    "component-catalog.json",
    "component-catalog.html",
    "web-implementation/index.html",
    "web-implementation/app.js",
    "web-implementation/styles.css",
)
DISALLOWED_BINARY_EXTS = {".fig", ".sketch", ".ttf", ".otf", ".woff", ".woff2"}
SVG_NS = "{http://www.w3.org/2000/svg}svg"
ID_PATTERN = re.compile(r'\bel\(["\x27]([A-Za-z_][\w-]*)["\x27]\)')
CATEGORY_PATTERN = re.compile(r"^\d{2}-[a-z0-9-]+$")


class _IDs(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key == "id" and value is not None:
                self.ids.append(value)


def audit(root: Path) -> list[str]:
    issues: list[str] = []
    for relative in REQUIRED:
        if not (root / relative).is_file():
            issues.append("missing required file: " + relative)

    categories = (
        sorted(
            p
            for p in root.iterdir()
            if p.is_dir()
            and CATEGORY_PATTERN.fullmatch(p.name)
            # The monorepo also has 06-cases/, 08-component-packs/ and other
            # numbered modules. Atlas categories have dedicated source records.
            and ((p / "references.json").is_file() or (p / "preview.svg").is_file())
        )
        if root.exists()
        else []
    )
    if len(categories) < 13:
        issues.append(f"only {len(categories)} category folders (expected at least 13)")

    for folder in categories:
        for filename in ("README.md", "references.json", "preview.svg"):
            if not (folder / filename).is_file():
                issues.append(f"missing {folder.name}/{filename}")
        record = folder / "references.json"
        if record.is_file():
            try:
                data = json.loads(record.read_text(encoding="utf-8"))
                if data.get("category_id") != folder.name:
                    issues.append(f"category ID mismatch in {folder.name}")
                if data.get("kit_component_layers_inspected") is not False:
                    issues.append(f"false/unreviewed Apple layer inspection in {folder.name}")
                if not str(data.get("reference_page", "")).startswith(
                    "https://developer.apple.com/"
                ):
                    issues.append(f"missing official Apple source in {folder.name}")
            except (ValueError, OSError) as exc:
                issues.append(f"invalid {folder.name}/references.json: {exc}")
        image = folder / "preview.svg"
        if image.is_file():
            try:
                if ET.parse(image).getroot().tag != SVG_NS:
                    issues.append(f"invalid SVG namespace in {folder.name}")
                if "NOT an Apple design kit export" not in image.read_text(encoding="utf-8"):
                    issues.append(f"SVG provenance disclaimer missing in {folder.name}")
            except (ET.ParseError, OSError) as exc:
                issues.append(f"invalid SVG {folder.name}: {exc}")

    manifest = root / "reference-manifest.json"
    if manifest.is_file():
        try:
            m = json.loads(manifest.read_text(encoding="utf-8"))
            meta = m.get("meta", {})
            if meta.get("official_design_kit_layers_inspected") is not False:
                issues.append("manifest makes unsupported layer inspection claim")
            if meta.get("archive_contains_licensed_apple_assets") is not False:
                issues.append("manifest makes unsupported Apple asset redistribution claim")
            if int(meta.get("category_folder_count", 0)) != len(categories):
                issues.append("manifest category count != actual category folders")
        except (ValueError, OSError, TypeError) as exc:
            issues.append(f"invalid reference manifest: {exc}")

    catalog = root / "component-catalog.json"
    if catalog.is_file():
        try:
            c = json.loads(catalog.read_text(encoding="utf-8"))
            items = c.get("components", [])
            if len(items) != c.get("total") or len(items) < 67:
                issues.append("catalog total/count mismatch or fewer than 67 records")
            ids = [str(item.get("id")) for item in items]
            if len(set(ids)) != len(ids):
                issues.append("duplicate component IDs")
            for item in items:
                if item.get("reference", {}).get("actual_layer_inspected") is not False:
                    issues.append(f"false Apple source inspection: {item.get('id')}")
                if item.get("measurements", {}).get("measured") is not False:
                    issues.append(f"false measured state: {item.get('id')}")
                url = str(item.get("reference", {}).get("url", ""))
                if not url.startswith("https://developer.apple.com/"):
                    issues.append(f"non-Apple reference: {item.get('id')}")
        except (ValueError, OSError, TypeError) as exc:
            issues.append(f"invalid component catalog: {exc}")

    page = root / "web-implementation/index.html"
    script = root / "web-implementation/app.js"
    if page.is_file() and script.is_file():
        ids = _IDs()
        ids.feed(page.read_text(encoding="utf-8"))
        if len(ids.ids) != len(set(ids.ids)):
            issues.append("duplicate HTML IDs in reference lab")
        referenced = set(ID_PATTERN.findall(script.read_text(encoding="utf-8")))
        for missing in sorted(referenced - set(ids.ids)):
            issues.append(f"reference lab JavaScript missing HTML id: {missing}")

    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in DISALLOWED_BINARY_EXTS:
            issues.append("restricted third-party binary detected: " + str(path.relative_to(root)))
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)
    if not args.root.is_dir():
        print("ERROR: reference root does not exist: " + str(args.root))
        return 2
    errors = audit(args.root)
    for error in errors:
        print("FAIL: " + error)
    if errors:
        print(f"FAILED ({len(errors)} issue(s)); no source content was changed")
        return 1
    print(
        "PASS: reference bundle structure, original SVG provenance, metadata, catalog, HTML IDs and restricted-asset guard"
    )
    print(
        "NOT CHECKED: real Apple kit layers, rights audit, browser render, source pixel equivalence"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
