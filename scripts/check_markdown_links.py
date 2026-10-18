"""Check repository-owned Markdown links without requiring network access."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MARKDOWN_ROOTS = (
    ROOT / "README.md",
    ROOT / "docs",
    ROOT / "openspec" / "changes" / "impulse-ecosystem",
)
LINK = re.compile(r"!?\[[^\]]*\]\((?P<target><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)")
EXTERNAL_SCHEMES = {"http", "https", "mailto"}


def _markdown_files() -> list[Path]:
    files: list[Path] = []
    for root in MARKDOWN_ROOTS:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            files.extend(root.rglob("*.md"))
    return sorted(files)


def _local_target(source: Path, raw_target: str) -> Path | None:
    target = raw_target.removeprefix("<").removesuffix(">")
    parsed = urlsplit(target)
    if parsed.scheme.lower() in EXTERNAL_SCHEMES or target.startswith("#"):
        return None
    if parsed.scheme:
        raise AssertionError(f"Unsupported link scheme in {source.relative_to(ROOT)}: {target}")
    path = unquote(parsed.path)
    if not path:
        return None
    if Path(path).is_absolute():
        raise AssertionError(f"Absolute local link in {source.relative_to(ROOT)}: {target}")
    return (source.parent / path).resolve()


def main() -> None:
    """Fail when a repository Markdown file points to a missing local target."""
    markdown_files = _markdown_files()
    checked_links = 0
    failures: list[str] = []

    for source in markdown_files:
        text = source.read_text(encoding="utf-8")
        for match in LINK.finditer(text):
            raw_target = match.group("target")
            try:
                target = _local_target(source, raw_target)
            except AssertionError as error:
                failures.append(str(error))
                continue
            if target is None:
                continue
            checked_links += 1
            if not target.exists():
                failures.append(
                    f"Broken link in {source.relative_to(ROOT)}: {raw_target} -> "
                    f"{target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}"
                )

    if failures:
        raise AssertionError("\n".join(failures))
    print(f"Markdown link check passed: {len(markdown_files)} files, {checked_links} local links")


if __name__ == "__main__":
    main()
