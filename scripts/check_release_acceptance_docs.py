"""Validate the release-report and six-role acceptance documentation contract."""

from __future__ import annotations

from pathlib import Path

DOC = Path("docs/release-acceptance.md")
README = Path("README.md")

ROLES = ("participant", "mentor", "customer", "manager", "hr", "operator")
STATUSES = ("PASS", "FAIL", "BLOCKED", "NOT_RUN")
DECISIONS = ("EXPAND", "ITERATE", "STOP")
COMMANDS = (
    "validate --all --strict --no-interactive",
    "uv run ruff format --check .",
    "uv run ruff check .",
    "uv run pyright",
    "uv run pytest",
    "uv run impulse-secret-scan",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
    "npm run test:e2e",
)


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check stable acceptance invariants without claiming that a release passed."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

    _require(text, tuple(f"`{role}`" for role in ROLES), "Role matrix")
    _require(text, STATUSES, "Result status vocabulary")
    _require(text, DECISIONS, "Release decision vocabulary")
    _require(text, COMMANDS, "Release command matrix")
    _require(text, tuple(f"`D{index:02d}`" for index in range(1, 16)), "Launch gates")
    _require(
        text,
        (
            "Commit SHA",
            "Schema revision",
            "Image digest",
            "Accessibility pass",
            "200% zoom",
            "prefers-reduced-motion",
            "Платный fallback запрещён",
            "явного подтверждения владельца",
        ),
        "Release evidence contract",
    )
    if "docs/release-acceptance.md" not in readme:
        raise AssertionError("README does not link docs/release-acceptance.md")
    if "scripts/check_release_acceptance_docs.py" not in readme:
        raise AssertionError("README does not list the release acceptance docs checker")

    print("Release acceptance docs check passed: 6 roles, 15 gates, 3 decisions")


if __name__ == "__main__":
    main()
