"""Validate AI release, canary, and rollback documentation invariants."""

from __future__ import annotations

from pathlib import Path

DOC = Path("docs/ai-release-policy.md")
README = Path("README.md")

FLAGS = (
    "AI_BUDDY_ENABLED",
    "AI_MENTOR_DRAFT_ENABLED",
    "AI_OPERATOR_TRIAGE_ENABLED",
    "AI_CUSTOMER_BRIEF_ENABLED",
)
VERSIONS = (
    "policy_version",
    "prompt_version",
    "model_registry_version",
    "dataset_version",
    "evaluator_version",
    "tool_contract_version",
    "code_commit",
)
OUTCOMES = ("text", "tool", "structured", "malformed", "402", "429", "timeout")
HARD_GATES = (
    "cross-person disclosure",
    "secret leak",
    "wrong money/offer",
    "unauthorized write",
    "non-free model",
    "blocked data class",
)


def _require(text: str, values: tuple[str, ...], context: str) -> None:
    missing = [value for value in values if value not in text]
    if missing:
        raise AssertionError(f"{context} is missing: {', '.join(missing)}")


def main() -> None:
    """Check safety-critical documentation without executing an AI provider call."""
    text = DOC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")

    _require(text, FLAGS, "AI kill switches")
    _require(text, VERSIONS, "Version tuple")
    _require(text, OUTCOMES, "FakeGateway outcomes")
    _require(text, HARD_GATES, "Hard gates")
    _require(
        text,
        (
            "openrouter/free",
            "provider/model:free",
            "Paid fallback отсутствует",
            "без domain migration",
            "не продолжает tool/model steps",
            "manual path",
            "synthetic/public fixtures",
            "задача 16.6 не отмечается выполненной",
        ),
        "Canary and rollback contract",
    )
    if "docs/ai-release-policy.md" not in readme:
        raise AssertionError("README does not link docs/ai-release-policy.md")
    if "scripts/check_ai_release_docs.py" not in readme:
        raise AssertionError("README does not list scripts/check_ai_release_docs.py")

    print("AI release docs check passed: 4 flags, 7 versions, 7 FakeGateway outcomes")


if __name__ == "__main__":
    main()
