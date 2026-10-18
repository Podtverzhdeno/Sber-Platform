"""Run every repository documentation contract as one deterministic quality gate."""

from __future__ import annotations

import runpy
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
CHECK_PATTERN = "check_*.py"


def main() -> None:
    """Discover documentation checkers so new contracts cannot be silently omitted."""
    checks = sorted(
        check for check in SCRIPTS_DIR.glob(CHECK_PATTERN) if check.name != Path(__file__).name
    )
    if not checks:
        raise AssertionError(f"No documentation checks match {CHECK_PATTERN}")

    for check in checks:
        print(f"==> {check.as_posix()}")
        runpy.run_path(str(check), run_name="__main__")

    print(f"Documentation quality gate passed: {len(checks)} checks")


if __name__ == "__main__":
    main()
