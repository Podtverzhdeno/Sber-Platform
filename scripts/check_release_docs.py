"""Validate migration and Railway documentation invariants without reading secret values."""

from __future__ import annotations

import re
from pathlib import Path

MIGRATION_DOC = Path("docs/migration-rollbacks.md")
VARIABLES_DOC = Path("docs/railway-variables-checklist.md")
DEPLOY_DOC = Path("docs/railway-deploy.md")
ENV_EXAMPLE = Path(".env.example")
TABLE_VARIABLE = re.compile(r"^\| `(?P<name>[A-Z][A-Z0-9_]+)` \|", re.MULTILINE)
ASSIGNMENT = re.compile(r"^(?P<name>[A-Z][A-Z0-9_]+)=(?P<value>.+)$", re.MULTILINE)
ENV_NAME = re.compile(r"^(?P<name>[A-Z][A-Z0-9_]+)=", re.MULTILINE)
REQUIRED_VARIABLES = {
    "APP_ENV",
    "DEMO_MODE",
    "DATABASE_URL",
    "SESSION_SECRET",
    "AI_BUDDY_ENABLED",
    "AI_MENTOR_DRAFT_ENABLED",
    "AI_OPERATOR_TRIAGE_ENABLED",
    "AI_CUSTOMER_BRIEF_ENABLED",
    "AI_MAX_REQUESTS_PER_USER_DAY",
    "AI_MAX_TOOL_CALLS_PER_RUN",
    "HONOR_BOARD_ENABLED",
}
SECRET_VARIABLES = {"SESSION_SECRET", "OPENROUTER_API_KEY", "LANGFUSE_SECRET_KEY"}
LOCAL_ONLY_VARIABLES = {"APP_HOST", "APP_PORT"}


def _check_variables() -> int:
    text = VARIABLES_DOC.read_text(encoding="utf-8")
    documented = set(TABLE_VARIABLE.findall(text))
    missing = sorted(REQUIRED_VARIABLES - documented)
    if missing:
        raise AssertionError(f"Required Railway variables are undocumented: {', '.join(missing)}")
    example_variables = set(ENV_NAME.findall(ENV_EXAMPLE.read_text(encoding="utf-8")))
    undocumented = sorted(example_variables - LOCAL_ONLY_VARIABLES - documented)
    if undocumented:
        raise AssertionError(f".env.example variables are undocumented: {', '.join(undocumented)}")
    assignments = ASSIGNMENT.findall(text)
    if assignments:
        names = ", ".join(name for name, _value in assignments)
        raise AssertionError(f"Railway checklist must not contain assignments: {names}")
    for name in SECRET_VARIABLES:
        matching_lines = [line for line in text.splitlines() if f"`{name}`" in line]
        if not matching_lines or not any(
            "secret" in line and "sealed" in line for line in matching_lines
        ):
            raise AssertionError(f"Secret variable is not marked secret and sealed: {name}")
    return len(documented)


def _check_migration_runbook() -> None:
    text = MIGRATION_DOC.read_text(encoding="utf-8").lower()
    required_phrases = (
        "expand → backfill → contract",
        "предыдущий release image",
        "expanded schema",
        "не запускать `alembic downgrade`",
        "/health/ready",
        "dry-run evidence status: `pending`",
        "backfill first pass",
        "`n-1` smoke on expanded schema",
    )
    missing = [phrase for phrase in required_phrases if phrase.lower() not in text]
    if missing:
        raise AssertionError(f"Migration runbook is missing invariants: {missing}")


def _check_deploy_links() -> None:
    text = DEPLOY_DOC.read_text(encoding="utf-8")
    for target in ("railway-variables-checklist.md", "migration-rollbacks.md"):
        if target not in text:
            raise AssertionError(f"Railway deploy guide does not link {target}")


def main() -> None:
    """Run documentation checks that are safe for CI and never print values."""
    variable_count = _check_variables()
    _check_migration_runbook()
    _check_deploy_links()
    print(f"Release documentation check passed: {variable_count} Railway variable names")


if __name__ == "__main__":
    main()
