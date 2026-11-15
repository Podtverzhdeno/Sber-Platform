#!/usr/bin/env python3
"""Offline, standard-library validation of original IMPULSE SVG reference boards.

Checks XML syntax, safe vector vocabulary, dimensions, accessibility metadata,
manifest links and local gallery references. Does NOT inspect external Apple
source files and does NOT prove pixel-perfect/native Liquid Glass equivalence.
Run: python3 "Apple UI kit/04-web-reference/validate-svg-library.py"
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "06-cases"
SVG_NS = "http://www.w3.org/2000/svg"
NAME = re.compile(r"^\d{2}-[a-z0-9-]+$")
EXTERNAL_TAGS = {"script", "foreignObject", "iframe", "image", "animate", "animateMotion", "animateTransform", "set", "audio", "video"}
errors: list[str] = []
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Invalid or missing JSON at {path}: {exc}")
        return None


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images: list[str] = []
        self.local_links: list[str] = []

    def handle_starttag(self, tag, attrs):
        props = dict(attrs)
        if tag == "img" and props.get("src"):
            self.images.append(props["src"])
        if tag in {"img", "script", "link", "a"}:
            key = "src" if tag in {"img", "script"} else "href"
            uri = props.get(key, "")
            if uri.startswith("./") or uri.startswith("../"):
                self.local_links.append(uri)


def main() -> int:
    manifest = read_json(CASES / "visual-manifest.json")
    if not isinstance(manifest, dict):
        return 1
    cards = manifest.get("cards")
    check(isinstance(cards, list) and len(cards) == 12,
          "Visual manifest requires exactly 12 cases")
    if not isinstance(cards, list):
        return 1

    try:
        gallery_text = (CASES / "visual-gallery.html").read_text(encoding="utf-8")
        preview_text = (CASES / "VISUAL_GALLERY.md").read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"Missing gallery document: {exc}")
        return 1

    parsed_gallery = Assets()
    parsed_gallery.feed(gallery_text)
    seen: set[str] = set()
    for item in cards:
        if not isinstance(item, dict):
            errors.append("Non-object visual manifest entry")
            continue

        slug = str(item.get("id", ""))
        check(bool(NAME.fullmatch(slug)) and slug not in seen,
              f"Invalid or duplicate case id: {slug}")
        seen.add(slug)
        expected = f"{slug}/reference-board.svg"
        path_label = item.get("image", "")
        check(path_label == expected, f"Incorrect SVG path for {slug}")
        image = CASES / expected
        if not image.is_file():
            errors.append(f"Missing SVG: {expected}")
            continue

        check((CASES / slug / "README.md").is_file(), f"Missing README: {slug}")
        check(item.get("kind") == "self-authored-web-approximation"
              and item.get("measured_from_apple") is False
              and item.get("verified_pixel_parity") is False,
              f"Unjustified native/pixel parity claim: {slug}")

        source = item.get("source", "")
        parsed = urlparse(str(source))
        check(parsed.scheme == "https" and parsed.hostname == "developer.apple.com",
              f"Non-official HIG source: {slug} -> {source}")
        check(f"./{expected}" in parsed_gallery.images,
              f"Gallery missing image for {slug}")
        check(expected in preview_text, f"Markdown gallery missing {slug}")

        try:
            root = ET.parse(image).getroot()
        except ET.ParseError as exc:
            errors.append(f"Invalid SVG/XML at {expected}: {exc}")
            continue

        check(root.tag == f"{{{SVG_NS}}}svg", f"Missing SVG root namespace: {slug}")
        check(root.attrib.get("width") == "1600"
              and root.attrib.get("height") == "900"
              and root.attrib.get("viewBox") == "0 0 1600 900",
              f"Unexpected image dimensions: {slug}")
        check(root.attrib.get("aria-labelledby") == "svgtitle svgdesc",
              f"Missing accessible labels: {slug}")
        title = root.find(f"{{{SVG_NS}}}title")
        desc = root.find(f"{{{SVG_NS}}}desc")
        check(title is not None and bool(title.text and title.text.strip()),
              f"Missing title: {slug}")
        check(desc is not None and bool(desc.text and desc.text.strip())
              and "not a screenshot" in desc.text.lower(),
              f"Missing source disclaimer: {slug}")

        ids: set[str] = set()
        for node in root.iter():
            tag = node.tag.rsplit("}", 1)[-1]
            check(tag not in EXTERNAL_TAGS, f"Unsafe SVG tag {tag} in {slug}")
            node_id = node.attrib.get("id")
            if node_id:
                check(node_id not in ids, f"Duplicate SVG id {node_id} in {slug}")
                ids.add(node_id)
            for attr, value in node.attrib.items():
                key = attr.rsplit("}", 1)[-1].lower()
                if key in {"href", "src"}:
                    check(value.startswith("#"), f"External SVG reference {slug}: {attr}={value}")
                if "url(" in value:
                    check(not re.search(r"url\(\s*['\"]?(?!#)", value),
                          f"External CSS URL in {slug}: {value}")

    check(len(seen) == 12, f"Expected 12 unique SVG case IDs, found {len(seen)}")
    check(len(parsed_gallery.images) == 12,
          f"Expected exactly 12 gallery images, found {len(parsed_gallery.images)}")

    for uri in parsed_gallery.local_links:
        path = (CASES / uri).resolve()
        check(path.is_relative_to(ROOT.resolve()) and path.is_file(),
              f"Broken/escaping relative gallery link: {uri}")

    if errors:
        print(f"SVG library check FAILED: {len(errors)} issues, {checks} assertions", file=sys.stderr)
        for error in errors:
            print(" - " + error, file=sys.stderr)
        return 1

    print(f"SVG library check passed: {checks} assertions, {len(seen)} original boards")
    print("Limitations: no visual rendering, external link check, Apple kit access or pixel-parity claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
