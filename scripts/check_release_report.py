"""Validate that the pre-RC report records every mandatory quality gate."""

from pathlib import Path

REPORT = Path("docs/release-report.md")
README = Path("README.md")

COMMANDS = (
    "validate --all --strict --no-interactive",
    "scripts/check_docs.py",
    "uv run ruff format --check .",
    "uv run ruff check .",
    "uv run pyright",
    "uv run pytest",
    "uv run pytest --cov=impulse",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run api:check",
    "npm run build",
    "npm run security:check",
    "npm run test:e2e",
    "uv run impulse-secret-scan",
    "uvx pip-audit --requirement .tmp/requirements-ci.txt",
    "npm audit --omit=dev --audit-level=high",
    "docker compose up --detach --build --wait",
    "secret-and-dependency-scans",
)


def main() -> None:
    """Require explicit results, blockers and a fail-closed release decision."""
    text = REPORT.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    missing = [command for command in COMMANDS if command not in text]
    if missing:
        raise AssertionError(f"Release report is missing gates: {', '.join(missing)}")
    for marker in (
        "Status: **NOT READY**",
        "## Blocking findings",
        "## Release decision",
        "required-gates",
        "Intentional-failure evidence",
        "requires separate owner approval",
    ):
        if marker not in text:
            raise AssertionError(f"Release report is missing marker: {marker}")
    if "docs/release-report.md" not in readme:
        raise AssertionError("README does not link docs/release-report.md")
    print("Pre-RC report check passed: 19 gates recorded with fail-closed decision")


if __name__ == "__main__":
    main()
