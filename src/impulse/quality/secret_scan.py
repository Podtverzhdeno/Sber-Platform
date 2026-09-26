"""Deterministic secret scanner for Git-visible source files."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

PATTERNS = {
    "OpenRouter key": re.compile(r"sk-or-v1-[A-Za-z0-9_-]{20,}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}
TEXT_SUFFIXES = {
    ".css",
    ".env",
    ".example",
    ".html",
    ".js",
    ".json",
    ".md",
    ".py",
    ".toml",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}


def tracked_files(root: Path) -> list[Path]:
    """Return tracked and untracked files while respecting .gitignore."""
    git = shutil.which("git")
    if git is None:
        raise RuntimeError("Git executable is required for the secret scan")
    # Executable is resolved by shutil.which; arguments are static and never user-controlled.
    result = subprocess.run(  # noqa: S603
        [git, "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return [root / line for line in result.stdout.splitlines() if line]


def scan(root: Path) -> list[str]:
    """Return findings without printing matched secret values."""
    findings: list[str] = []
    for path in tracked_files(root):
        if not path.is_file() or (
            path.suffix.lower() not in TEXT_SUFFIXES and path.name != ".env.example"
        ):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                findings.append(f"{path.relative_to(root)}: possible {label}")
    return findings


def main() -> None:
    """Run the scanner from the repository root."""
    findings = scan(Path.cwd())
    if findings:
        raise SystemExit("Secret scan failed:\n" + "\n".join(findings))
    print("Secret scan passed")
