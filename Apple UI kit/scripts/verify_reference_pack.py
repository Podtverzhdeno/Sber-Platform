#!/usr/bin/env python3
"""Dependency-free static consistency check for Apple UI kit reference pack.
Run: python "Apple UI kit/scripts/verify_reference_pack.py"
This checks files, JSON and local SVG XML, NOT browser rendering or Apple pixel parity.
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def safe_svg_root(path: Path) -> ET.Element:
    """Read only small local SVG documents, without DTD or entity definitions."""
    data = path.read_bytes()
    if len(data) > 2_000_000 or b"<!doctype" in data.lower() or b"<!entity" in data.lower():
        raise ET.ParseError("Unsafe SVG source")
    return ET.fromstring(data)  # noqa: S314 -- local size-bounded SVG with DTD/entities refused

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_GROUPS = [
    "01-liquid-glass-materials",
    "02-navigation-sidebars-tabs",
    "03-buttons-and-selection",
    "04-forms-and-inputs",
    "05-menus-popovers-sheets",
    "06-lists-tables-cards",
    "07-messages-collaboration",
    "08-typography-colors-symbols",
    "09-progress-feedback-states",
    "10-portfolio-wallet-identity",
    "11-motion-accessibility-responsive",
    "12-native-platform-kits",
    "13-official-visual-references",
]
REQUIRED_TOP = [
    "README.md",
    "SOURCES.md",
    "LIQUID_GLASS.md",
    "PROVENANCE_AND_LICENSE.md",
    "COMPONENT_ATLAS.md",
    "IMPULSE_MAPPING.md",
    "PIXEL_PARITY_QA.md",
    "AGENT_HANDOFF.md",
    "REFERENCE_GALLERY.md",
    "OFFICIAL_VISUAL_GALLERY.md",
    "reference-gallery.html",
    "reference-manifest.json",
    "design-tokens.json",
    "component-coverage.csv",
    "web-prototype/index.html",
]


def main() -> int:
    problems: list[str] = []
    for relative in REQUIRED_TOP:
        if not (ROOT / relative).is_file():
            problems.append(f"Missing top-level file: {relative}")
    gallery = (
        (ROOT / "REFERENCE_GALLERY.md").read_text(encoding="utf8")
        if (ROOT / "REFERENCE_GALLERY.md").exists()
        else ""
    )
    gallery_html = (
        (ROOT / "reference-gallery.html").read_text(encoding="utf8")
        if (ROOT / "reference-gallery.html").exists()
        else ""
    )
    count = 0
    for slug in EXPECTED_GROUPS:
        directory = ROOT / slug
        if not directory.is_dir():
            problems.append(f"Missing directory: {slug}")
            continue
        if slug not in gallery or slug not in gallery_html:
            problems.append(f"Gallery missing: {slug}")
        for name in ("README.md", "references.json", "preview.svg"):
            if not (directory / name).is_file():
                problems.append(f"Missing {slug}/{name}")
        ref = directory / "references.json"
        if ref.is_file():
            try:
                data = json.loads(ref.read_text(encoding="utf8"))
                if data.get("category_id") != slug:
                    problems.append(f"Wrong category id: {slug}")
                if not str(data.get("reference_page", "")).startswith(
                    "https://developer.apple.com/"
                ):
                    problems.append(f"Non-Apple canonical source: {slug}")
                if data.get("kit_component_layers_inspected") is not False:
                    problems.append(f"Cannot assert source frames were inspected: {slug}")
            except (json.JSONDecodeError, ValueError) as exc:
                problems.append(f"Invalid JSON {slug}: {exc}")
        svg = directory / "preview.svg"
        if svg.is_file():
            try:
                image = safe_svg_root(svg)
                if image.tag != "{http://www.w3.org/2000/svg}svg":
                    problems.append(f"Invalid SVG namespace: {slug}")
                if "NOT an Apple design kit export" not in svg.read_text(encoding="utf8"):
                    problems.append(f"SVG needs clear study provenance: {slug}")
            except ET.ParseError as exc:
                problems.append(f"Invalid SVG XML {slug}: {exc}")
        count += 1
    for name in ("reference-manifest.json", "design-tokens.json"):
        path = ROOT / name
        if path.is_file():
            try:
                json.loads(path.read_text(encoding="utf8"))
            except json.JSONDecodeError as exc:
                problems.append(f"Invalid JSON {name}: {exc}")
    if problems:
        print("FAIL: " + str(len(problems)) + " problems")
        for error in problems:
            print(" - " + error)
        return 1
    print(
        f"OK: {count} category directories, JSON source metadata, local original SVG XML, galleries"
    )
    print(
        "Not checked: Apple binary licenses, editable kit layers, browser rendering, pixel parity"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
