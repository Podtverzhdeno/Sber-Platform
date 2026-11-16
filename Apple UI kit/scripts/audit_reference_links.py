#!/usr/bin/env python3
"""Check local Markdown/HTML links without network or Apple asset downloads."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

LINK = re.compile(r"!?\[[^\]\n]+\]\(([^)\s]+)(?:\s+['\"][^)]*['\"])?\)")
EXCLUDED = {"node_modules", "__pycache__", ".git", "pixel-diff-output", "reference-browser-output"}


class HTMLLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in {"href", "src"} and v:
                self.urls.append(v)


@dataclass
class Counts:
    files: int = 0
    local: int = 0
    remote_unverified: int = 0
    site_absolute_skipped: int = 0
    outside_root: int = 0


def markdown_urls(content):
    lines, fence = [], None
    for line in content.splitlines():
        marker = line.lstrip()[:3]
        if marker in {"~~~", "~~~" + " "} or marker == chr(96) * 3:
            if fence is None:
                fence = marker
            elif marker == fence:
                fence = None
            continue
        if fence is None:
            lines.append(line)
    return [m.group(1) for m in LINK.finditer("\n".join(lines))]


def audit(root):
    root = root.resolve()
    counts, errors = Counts(), []
    if not root.is_dir():
        return counts, ["Missing root: " + str(root)]
    for file in sorted(root.rglob("*")):
        if not file.is_file() or file.suffix.lower() not in {".md", ".html"}:
            continue
        if any(p in EXCLUDED for p in file.relative_to(root).parts):
            continue
        counts.files += 1
        try:
            content = file.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            errors.append(str(file.relative_to(root)) + " read failed: " + str(exc))
            continue
        if file.suffix.lower() == ".md":
            urls = markdown_urls(content)
        else:
            parser = HTMLLinks()
            parser.feed(content)
            urls = parser.urls
        for url in urls:
            if url.startswith("#"):
                continue
            try:
                parsed = urlsplit(url)
            except ValueError as exc:
                errors.append(
                    str(file.relative_to(root)) + " malformed link " + url + ": " + str(exc)
                )
                continue
            if parsed.scheme or parsed.netloc or url.startswith("//"):
                counts.remote_unverified += 1
                continue
            if not parsed.path:
                continue
            if parsed.path.startswith("/"):
                counts.site_absolute_skipped += 1
                continue
            target = (file.parent / unquote(parsed.path)).resolve()
            try:
                within = target.relative_to(root)
            except ValueError:
                counts.outside_root += 1
                continue
            counts.local += 1
            if not target.exists():
                errors.append(
                    str(file.relative_to(root)) + " -> " + url + " (missing " + str(within) + ")"
                )
    return counts, errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)
    counts, errors = audit(args.root)
    print(
        f"Scanned {counts.files} files; {counts.local} local links; "
        f"{counts.remote_unverified} remote URLs not checked; "
        f"{counts.outside_root} out-of-bundle paths; "
        f"{counts.site_absolute_skipped} site-absolute links"
    )
    for error in errors:
        print("BROKEN: " + error)
    if errors:
        return 1
    print("PASS: local link targets resolved. Remote URLs, browser and Apple pixels NOT verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
