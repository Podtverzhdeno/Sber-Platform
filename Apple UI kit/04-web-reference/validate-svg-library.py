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


def safe_svg_root(path: Path) -> ET.Element:
    """Read only small local SVG documents, without DTD or entity definitions."""
    data = path.read_bytes()
    if len(data) > 2_000_000 or b"<!doctype" in data.lower() or b"<!entity" in data.lower():
        raise ET.ParseError("Unsafe SVG source")
    return ET.fromstring(data)  # noqa: S314 -- local size-bounded SVG with DTD/entities refused

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "06-cases"
SVG_NS = "http://www.w3.org/2000/svg"
NAME = re.compile(r"^\d{2}-[a-z0-9-]+$")
EXTERNAL_TAGS = {
    "script",
    "foreignObject",
    "iframe",
    "image",
    "animate",
    "animateMotion",
    "animateTransform",
    "set",
    "audio",
    "video",
}
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


def validate_reference_cases() -> None:
    """Validate the 16 additional self-authored 1200x760 SVG scenario boards."""
    directory = ROOT / "reference-cases"
    if not directory.is_dir():
        return  # This collection can be distributed separately from the core kit.

    manifest = read_json(directory / "manifest.json")
    if not isinstance(manifest, dict):
        return
    entries = manifest.get("cases", [])
    check(
        manifest.get("total_cases") == 16 and isinstance(entries, list) and len(entries) == 16,
        "Reference-cases manifest must describe 16 boards",
    )
    if not isinstance(entries, list):
        return

    try:
        gallery = (directory / "index.html").read_text(encoding="utf-8")
        index = (directory / "README.md").read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"Missing 16-case gallery or index: {exc}")
        return

    root_repo = ROOT.parent
    seen: set[str] = set()
    for case in entries:
        if not isinstance(case, dict):
            errors.append("Non-object reference case entry")
            continue

        slug = str(case.get("slug", ""))
        check(
            bool(NAME.fullmatch(slug)) and slug not in seen,
            f"Invalid/duplicate reference-case slug: {slug}",
        )
        seen.add(slug)

        image = directory / slug / "cover.svg"
        readme = directory / slug / "README.md"
        check(
            case.get("vector") == "cover.svg" and image.is_file(), f"Missing reference SVG: {slug}"
        )
        check(
            case.get("readme") == "README.md" and readme.is_file(),
            f"Missing reference README: {slug}",
        )
        check(f'src="{slug}/cover.svg"' in gallery, f"Gallery missing SVG: {slug}")
        check(f"{slug}/cover.svg" in index, f"Index missing SVG: {slug}")

        check(
            case.get("type") == "original_web_visual_study"
            and case.get("pixel_verified") is False
            and case.get("measured_from_official_kit") is False,
            f"Unsupported pixel parity claim: {slug}",
        )

        source = str(case.get("source_url", ""))
        parsed = urlparse(source)
        check(
            parsed.scheme == "https" and parsed.hostname == "developer.apple.com",
            f"Missing official HIG reference: {slug}",
        )

        target = str(case.get("impulse_target", ""))
        target_file = (root_repo / target).resolve()
        check(
            target.startswith("frontend/src/")
            and target_file.is_relative_to(root_repo.resolve())
            and target_file.is_file(),
            f"Missing real IMPULSE target: {slug} → {target}",
        )

        if not image.is_file():
            continue
        try:
            xml = safe_svg_root(image)
        except ET.ParseError as exc:
            errors.append(f"Malformed reference SVG {slug}: {exc}")
            continue
        check(xml.tag == f"{{{SVG_NS}}}svg", f"Incorrect SVG namespace: {slug}")
        check(
            xml.attrib.get("width") == "1200"
            and xml.attrib.get("height") == "760"
            and xml.attrib.get("viewBox") == "0 0 1200 760",
            f"Incorrect 1200x760 geometry: {slug}",
        )
        check(
            bool(xml.attrib.get("aria-label")) and xml.find(f"{{{SVG_NS}}}title") is not None,
            f"Missing SVG accessibility label/title: {slug}",
        )
        check(xml.find(f"{{{SVG_NS}}}desc") is not None, f"Missing SVG description: {slug}")

        for node in xml.iter():
            tag = node.tag.rsplit("}", 1)[-1]
            check(tag not in EXTERNAL_TAGS, f"Unexpected active SVG tag {tag}: {slug}")
            for key, value in node.attrib.items():
                local_key = key.rsplit("}", 1)[-1].lower()
                check(not local_key.startswith("on"), f"Event handler {key} in SVG: {slug}")
                if local_key in {"href", "src"}:
                    check(value.startswith("#"), f"External SVG asset reference: {slug}")
                if "url(" in value:
                    check(
                        not re.search(r"url\(\s*['\"]?(?!#)", value),
                        f"External CSS asset reference in {slug}",
                    )

    check(len(seen) == 16, f"Expected 16 unique reference cases, found {len(seen)}")


def main() -> int:
    manifest = read_json(CASES / "visual-manifest.json")
    if not isinstance(manifest, dict):
        return 1
    cards = manifest.get("cards")
    check(isinstance(cards, list) and len(cards) == 12, "Visual manifest requires exactly 12 cases")
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
        check(
            bool(NAME.fullmatch(slug)) and slug not in seen, f"Invalid or duplicate case id: {slug}"
        )
        seen.add(slug)
        expected = f"{slug}/reference-board.svg"
        path_label = item.get("image", "")
        check(path_label == expected, f"Incorrect SVG path for {slug}")
        image = CASES / expected
        if not image.is_file():
            errors.append(f"Missing SVG: {expected}")
            continue

        check((CASES / slug / "README.md").is_file(), f"Missing README: {slug}")
        check(
            item.get("kind") == "self-authored-web-approximation"
            and item.get("measured_from_apple") is False
            and item.get("verified_pixel_parity") is False,
            f"Unjustified native/pixel parity claim: {slug}",
        )

        source = item.get("source", "")
        parsed = urlparse(str(source))
        check(
            parsed.scheme == "https" and parsed.hostname == "developer.apple.com",
            f"Non-official HIG source: {slug} -> {source}",
        )
        check(f"./{expected}" in parsed_gallery.images, f"Gallery missing image for {slug}")
        check(expected in preview_text, f"Markdown gallery missing {slug}")

        try:
            root = safe_svg_root(image)
        except ET.ParseError as exc:
            errors.append(f"Invalid SVG/XML at {expected}: {exc}")
            continue

        check(root.tag == f"{{{SVG_NS}}}svg", f"Missing SVG root namespace: {slug}")
        check(
            root.attrib.get("width") == "1600"
            and root.attrib.get("height") == "900"
            and root.attrib.get("viewBox") == "0 0 1600 900",
            f"Unexpected image dimensions: {slug}",
        )
        check(
            root.attrib.get("aria-labelledby") == "svgtitle svgdesc",
            f"Missing accessible labels: {slug}",
        )
        title = root.find(f"{{{SVG_NS}}}title")
        desc = root.find(f"{{{SVG_NS}}}desc")
        check(
            title is not None and bool(title.text and title.text.strip()), f"Missing title: {slug}"
        )
        check(
            desc is not None
            and bool(desc.text and desc.text.strip())
            and "not a screenshot" in desc.text.lower(),
            f"Missing source disclaimer: {slug}",
        )

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
                    check(
                        not re.search(r"url\(\s*['\"]?(?!#)", value),
                        f"External CSS URL in {slug}: {value}",
                    )

    check(len(seen) == 12, f"Expected 12 unique SVG case IDs, found {len(seen)}")
    check(
        len(parsed_gallery.images) == 12,
        f"Expected exactly 12 gallery images, found {len(parsed_gallery.images)}",
    )

    for uri in parsed_gallery.local_links:
        path = (CASES / uri).resolve()
        check(
            path.is_relative_to(ROOT.resolve()) and path.is_file(),
            f"Broken/escaping relative gallery link: {uri}",
        )

    validate_reference_cases()

    if errors:
        print(
            f"SVG library check FAILED: {len(errors)} issues, {checks} assertions", file=sys.stderr
        )
        for error in errors:
            print(" - " + error, file=sys.stderr)
        return 1

    print(f"SVG library check passed: {checks} assertions, {len(seen)} original boards")
    print(
        "Limitations: no visual rendering, external link check, "
        "Apple kit access or pixel-parity claim."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
