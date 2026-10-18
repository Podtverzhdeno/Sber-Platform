"""Validate retention, AI evaluation, observability, and API contracts."""

from __future__ import annotations

from pathlib import Path

README = Path("README.md")
DOCS = {
    "retention": Path("docs/retention-deletion.md"),
    "evaluation": Path("docs/ai-evaluation-contract.md"),
    "observability": Path("docs/observability-alerts.md"),
    "api": Path("docs/api-error-contract.md"),
}


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check safety invariants without claiming implementation completion."""
    texts = {name: path.read_text(encoding="utf-8") for name, path in DOCS.items()}
    readme = README.read_text(encoding="utf-8")

    _require(
        texts["retention"],
        (
            "D15",
            "immediate stop reading",
            "domain audit",
            "tombstone",
            "idempotent deletion request",
            "не закрываются одним runbook",
        ),
        "Retention",
    )
    _require(
        texts["evaluation"],
        (
            "case_id",
            "holdout",
            "FakeGateway",
            "cross-person disclosure",
            "non-free/paid model",
            "failing regression fixture",
            "остаются открытыми",
        ),
        "AI evaluation",
    )
    _require(
        texts["observability"],
        (
            "metadata-only",
            "telemetry_loss",
            "LANGFUSE_CONTENT_CAPTURE_ENABLED=false",
            "free quota",
            "manual path",
            "/health/ready",
        ),
        "Observability",
    )
    _require(
        texts["api"],
        (
            "RESOURCE_NOT_FOUND",
            "TERMS_CHANGED",
            "RATE_LIMITED",
            "PRIVACY_POLICY_BLOCKED",
            "retryable=true",
            "idempotency key",
            "payload hash",
            "manual core path",
        ),
        "API errors",
    )

    for path in DOCS.values():
        relative = path.as_posix()
        if relative not in readme:
            raise AssertionError(f"README does not link {relative}")
    if "scripts/check_contract_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_contract_docs.py")
    print("Cross-contract docs check passed: retention, evaluation, observability, API errors")


if __name__ == "__main__":
    main()
