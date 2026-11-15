#!/usr/bin/env python3
"""Offline checks for independent 10-case / 20-SVG light-dark Impulse reference set.

Usage: python3 "Apple UI kit/advanced-cases/validate-advanced.py"
No network requests, third-party packages, or copyrighted Apple resources.
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
SVG = "{http://www.w3.org/2000/svg}"
BANNED = {"script", "foreignObject", "image", "iframe", "audio", "video", "animate",
          "animateTransform", "animateMotion", "set"}
issues: list[str] = []
assertions = 0


def verify(ok: bool, message: str) -> None:
    global assertions
    assertions += 1
    if not ok:
        issues.append(message)


def main() -> int:
    try:
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        gallery = (ROOT / "index.html").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
    except (OSError, ValueError) as exc:
        print(f"Invalid advanced reference package: {exc}", file=sys.stderr)
        return 1

    cases = manifest.get("cases", [])
    verify(manifest.get("case_count") == 10 and manifest.get("svg_count") == 20
           and manifest.get("not_official_apple_assets") is True,
           "Manifest count/provenance mismatch")
    verify(isinstance(cases, list) and len(cases) == 10,
           "Expected 10 advanced cases")
    if not isinstance(cases, list):
        return 1

    seen: set[str] = set()
    for item in cases:
        if not isinstance(item, dict):
            issues.append("Non-object advanced-case record")
            continue
        name = str(item.get("folder", ""))
        case_id = item.get("id")
        verify(isinstance(case_id, int) and 17 <= case_id <= 26
               and name.startswith(f"{case_id}-") and name not in seen
               and bool(re.fullmatch(r"[0-9]{2}-[a-z0-9-]+", name)),
               f"Bad or duplicate case: {name}")
        seen.add(name)

        src = urlparse(str(item.get("source", "")))
        verify(src.scheme == "https" and src.hostname == "developer.apple.com",
               f"Not an official HIG source: {name}")
        verify(item.get("concept") is True and item.get("official_kit_measured") is False
               and item.get("checked_pixel_parity") is False,
               f"False Apple parity/source claim: {name}")

        folder = ROOT / name
        docs = folder / "README.md"
        verify(docs.is_file() and f"{name}/README.md" in readme
               and f"{name}/README.md" in gallery, f"Missing README/link: {name}")
        variants = item.get("images")
        verify(variants == ["dark.svg", "light.svg"],
               f"Missing dark/light pairs in manifest: {name}")
        for theme in ["dark", "light"]:
            target = folder / f"{theme}.svg"
            verify(target.is_file(), f"Missing SVG: {name}/{theme}")
            verify(f"{name}/{theme}.svg" in readme, f"Missing index SVG link: {name}/{theme}")
            if not target.is_file():
                continue
            try:
                root = ET.parse(target).getroot()
            except ET.ParseError as exc:
                issues.append(f"Malformed SVG {name}/{theme}: {exc}")
                continue
            verify(root.tag == SVG + "svg" and root.attrib.get("width") == "1280"
                   and root.attrib.get("height") == "760"
                   and root.attrib.get("viewBox") == "0 0 1280 760",
                   f"Incorrect vector dimensions: {name}/{theme}")
            title = root.find(SVG + "title")
            desc = root.find(SVG + "desc")
            verify(title is not None and desc is not None
                   and "not an official apple" in (desc.text or "").lower(),
                   f"Missing origin disclaimer: {name}/{theme}")
            for tag in root.iter():
                label = tag.tag.rsplit("}", 1)[-1]
                verify(label not in BANNED, f"Active/external tag {label}: {name}/{theme}")
                for key, value in tag.attrib.items():
                    local = key.rsplit("}", 1)[-1].lower()
                    verify(not local.startswith("on"), f"Script event handler: {name}/{theme}")
                    if local in {"href", "src"}:
                        verify(value.startswith("#"), f"External SVG href: {name}/{theme}")
                    if "url(" in value:
                        verify(not re.search(r"url\(\s*['\"]?(?!#)", value),
                               f"External SVG CSS url: {name}/{theme}")

        verify(f'data-dir="{name}"' in gallery and f'src="{name}/dark.svg"' in gallery,
               f"Gallery has no corresponding thumbnail: {name}")

    verify(len(seen) == 10, f"Wrong unique case count: {len(seen)}")
    if issues:
        print(f"Advanced SVG QA failed ({len(issues)}/{assertions}):", file=sys.stderr)
        for issue in issues:
            print(" - " + issue, file=sys.stderr)
        return 1
    print(f"Advanced SVG QA passed: {assertions} checks, 10 cases, 20 original SVGs")
    print("Not a native Liquid Glass rendering or Apple pixel-parity validation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
