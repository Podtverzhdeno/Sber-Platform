"""Validate security, RBAC, IDOR, and kill-switch documentation coverage."""

from __future__ import annotations

from pathlib import Path

DOC = Path("docs/security-test-matrix.md")
README = Path("README.md")

ROLES = ("participant", "mentor", "customer", "manager", "hr", "operator")
BOUNDARIES = (
    "Tasks/projects",
    "Applications/assignments",
    "Contributions/artifacts",
    "Reviews/payouts/disputes",
    "Credentials/trophies/offers",
    "Profiles/consents",
    "Messages/threads",
    "Search",
    "Notifications",
    "AI tools/threads",
    "Operator cases",
    "Files/exports",
)
AI_FLAGS = (
    "AI_BUDDY_ENABLED",
    "AI_MENTOR_DRAFT_ENABLED",
    "AI_OPERATOR_TRIAGE_ENABLED",
    "AI_CUSTOMER_BRIEF_ENABLED",
)


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check that the matrix keeps all high-risk boundaries explicit."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

    _require(text, tuple(f"`{role}`" for role in ROLES), "Security role matrix")
    _require(text, tuple(f"| {item} |" for item in BOUNDARIES), "IDOR inventory")
    _require(text, AI_FLAGS, "AI kill switches")
    _require(
        text,
        (
            "404 RESOURCE_NOT_FOUND",
            "не из request body",
            "ранее сохранённую карточку",
            "unsafe Origin",
            "wildcard",
            "credentials",
            "path traversal",
            "idempotency key",
            "не печатает найденное значение",
            "Реальные credentials для intentional failure запрещены",
            "нельзя закрывать только по этой матрице",
        ),
        "Security invariants",
    )
    if "docs/security-test-matrix.md" not in readme:
        raise AssertionError("README does not link docs/security-test-matrix.md")
    if "scripts/check_security_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_security_docs.py")

    print("Security docs check passed: 6 roles, 12 IDOR boundaries, 4 AI kill switches")


if __name__ == "__main__":
    main()
