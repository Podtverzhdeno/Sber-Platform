#!/usr/bin/env python3
"""Validate Impulse source crosswalk against a checked-out repository.

Offline: reads only files and compares tracked Git blob SHA-1 values.
A changed hash is a warning unless --strict-sha is supplied. It is NOT an
Apple/Figma source-frame verification or a browser/visual test.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def git_blob_sha(raw: bytes) -> str:
    header = b"blob " + str(len(raw)).encode("ascii") + b"\0"
    return hashlib.sha1(header + raw).hexdigest()


def verify(
    repo_root: Path, manifest_path: Path, strict_sha: bool = False
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"Cannot parse source crosswalk: {exc}"], warnings
    records = data.get("targets")
    if not isinstance(records, list) or not records:
        return ["Source crosswalk missing targets array"], warnings
    seen = set()
    for entry in records:
        identity = entry.get("id")
        if not isinstance(identity, str) or identity in seen:
            errors.append(f"Missing/duplicate identifier: {identity}")
        seen.add(identity)
        if (
            entry.get("actual_apple_kit_frames_inspected") is True
            or entry.get("measured_parity") is True
        ):
            errors.append(f"Unsupported Apple frame/parity claim: {identity}")
        for path_key, hash_key in (
            ("impulse_file", "impulse_blob_sha_main"),
            ("test_file", "test_blob_sha_main"),
        ):
            relative = entry.get(path_key)
            expected = entry.get(hash_key)
            if relative is None:
                continue
            if not isinstance(relative, str) or not relative.startswith("frontend/src/"):
                errors.append(f"{identity}: unexpected repo-relative source path {relative!r}")
                continue
            target = (repo_root / relative).resolve()
            if not target.is_relative_to(repo_root.resolve()):
                errors.append(f"{identity}: path escapes workspace")
                continue
            if not target.is_file():
                errors.append(f"{identity}: missing {relative}")
                continue
            try:
                actual = git_blob_sha(target.read_bytes())
            except OSError as exc:
                errors.append(f"{identity}: unable to read {relative}: {exc}")
                continue
            if expected and actual != expected:
                message = f"{identity}: SHA changed for {relative}: {expected} -> {actual}"
                if strict_sha:
                    errors.append(message)
                else:
                    warnings.append(message)
    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "IMPULSE_SOURCE_CROSSWALK.json",
    )
    parser.add_argument("--strict-sha", action="store_true")
    args = parser.parse_args(argv)
    errors, warnings = verify(args.repo_root, args.manifest, args.strict_sha)
    for message in warnings:
        print("WARN: " + message)
    for message in errors:
        print("FAIL: " + message)
    if errors:
        print(f"FAIL: {len(errors)} issue(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: source paths present; {len(warnings)} SHA freshness warning(s).")
    print("NOT VERIFIED: Apple editable frames, licenses, browser behavior, pixel parity.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
