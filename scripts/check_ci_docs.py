"""Validate the documented and executable CI quality-gate contract."""

from __future__ import annotations

import re
from pathlib import Path

DOC = Path("docs/ci-quality-gates.md")
README = Path("README.md")
WORKFLOW = Path(".github/workflows/ci.yml")

STAGES = (
    "openspec-strict-and-docs",
    "backend-format-lint-types",
    "backend-unit-api-integration",
    "frontend-quality-and-contracts",
    "frontend-build-and-e2e",
    "docker-smoke",
    "secret-and-dependency-scans",
    "required-gates",
)
REQUIRED_COMMANDS = (
    "validate --all --strict --no-interactive",
    "scripts/check_docs.py",
    "uv run ruff format --check .",
    "uv run ruff check .",
    "uv run pyright",
    "uv run pytest",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run api:check",
    "npm run build",
    "npm run security:check",
    "npm run test:e2e",
    "uv run impulse-secret-scan",
)
FAILURE_GATES = (
    "OpenSpec",
    "Docs",
    "Format/lint",
    "Types",
    "Unit/API",
    "Integration",
    "Frontend lint/types/unit",
    "API contract",
    "Build/security",
    "E2E/accessibility",
    "Docker smoke",
    "Secret scan",
    "Dependency scan",
    "Aggregator",
)


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check that CI documentation and workflow stay fail-closed and aligned."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")

    _require(text, STAGES, "CI stages")
    _require(text, REQUIRED_COMMANDS, "CI commands")
    _require(text, tuple(f"| {gate} |" for gate in FAILURE_GATES), "Failure matrix")
    _require(
        text,
        (
            "production secrets",
            "реальный OpenRouter",
            "`continue-on-error`",
            "`|| true`",
            "не равен `success`",
            "реальные credentials",
            "`.github/workflows/ci.yml`",
        ),
        "Fail-closed CI invariants",
    )
    if "docs/ci-quality-gates.md" not in readme:
        raise AssertionError("README does not link docs/ci-quality-gates.md")
    if "scripts/check_ci_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_ci_docs.py")
    if ".github/workflows/ci.yml" not in readme:
        raise AssertionError("README does not link .github/workflows/ci.yml")

    _require(workflow, tuple(f"name: {stage}" for stage in STAGES), "CI workflow stages")
    _require(workflow, REQUIRED_COMMANDS, "CI workflow commands")
    _require(
        workflow,
        (
            "pull_request:",
            "push:",
            "permissions:\n  contents: read",
            "services:\n      postgres:",
            "uv run alembic upgrade head",
            "docker compose up --detach --build --wait",
            "docker compose stop postgres",
            "npm audit --omit=dev --audit-level=high",
            "uvx pip-audit",
            "aquasec/trivy:",
            "if: ${{ always() }}",
        ),
        "Executable CI invariants",
    )
    forbidden = ("pull_request_target:", "continue-on-error", "|| true")
    present = [value for value in forbidden if value in workflow]
    if present:
        raise AssertionError(f"CI workflow contains fail-open construct: {', '.join(present)}")
    if workflow.count(".result }}' = 'success'") != len(STAGES) - 1:
        raise AssertionError("required-gates must verify every mandatory dependency result")
    action_refs = re.findall(r"^\s+uses:\s+[^@\s]+@([^\s#]+)", workflow, re.MULTILINE)
    unpinned = [
        reference for reference in action_refs if re.fullmatch(r"[0-9a-f]{40}", reference) is None
    ]
    if unpinned:
        raise AssertionError(f"GitHub Actions must use immutable SHAs: {', '.join(unpinned)}")
    if "${{ secrets." in workflow:
        raise AssertionError("CI workflow must not consume repository secrets")

    print("CI contract check passed: 8 executable stages, 14 intentional-failure gates")


if __name__ == "__main__":
    main()
