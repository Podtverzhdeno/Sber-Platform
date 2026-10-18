"""Validate Playwright journey-to-OpenSpec traceability documentation."""

from __future__ import annotations

from pathlib import Path

DOC = Path("docs/journey-traceability.md")
README = Path("README.md")

JOURNEYS = (
    "J-PAR-ADULT-01",
    "J-TRACK-SWITCH-01",
    "J-TERMS-CHANGED-01",
    "J-GRADE-DISPUTE-01",
    "J-TROPHY-REVOKE-01",
    "J-PRIVACY-OPTOUT-01",
    "J-HR-VERIFY-01",
    "J-BUDDY-MONEY-01",
    "J-BUDDY-OFFER-01",
    "J-MENTOR-DRAFT-01",
    "J-OPERATOR-DUP-01",
)
CAPABILITIES = (
    "identity-access/",
    "career-roadmap/",
    "projects-tasks/",
    "compensation-5plus/",
    "portfolio-trophies/",
    "agent-buddy/",
    "agent-mentor/",
    "agent-operator/",
)


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check planned journeys without claiming their target tests exist yet."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

    _require(text, tuple(f"`{journey}`" for journey in JOURNEYS), "Journey inventory")
    _require(text, CAPABILITIES, "OpenSpec capability traceability")
    _require(
        text,
        (
            "stable UUID",
            "FakeGateway",
            "audit/version",
            "TERMS_CHANGED",
            "calculated ≠ paid",
            "safe 404",
            "feature flag `false`",
            "отсутствие model call",
            "остаются открытыми",
            "не является заменой реализации",
        ),
        "Journey acceptance contract",
    )
    if "docs/journey-traceability.md" not in readme:
        raise AssertionError("README does not link docs/journey-traceability.md")
    if "scripts/check_journey_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_journey_docs.py")

    print("Journey docs check passed: 11 journeys, 8 OpenSpec capabilities")


if __name__ == "__main__":
    main()
