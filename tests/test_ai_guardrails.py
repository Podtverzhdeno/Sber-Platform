"""Privacy, runtime-budget, and output-validation tests."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from impulse.ai.gateway import ModelErrorCode, ModelGatewayError, ModelPurpose
from impulse.ai.guardrails import (
    AgentLimits,
    AgentRunBudget,
    CircuitBreaker,
    ClassifiedField,
    DataClass,
    PrivacyPreflight,
)
from impulse.ai.prompts import AgentAnswer, PromptRegistry


def test_privacy_preflight_blocks_internal_data_before_provider() -> None:
    with pytest.raises(ModelGatewayError) as caught:
        PrivacyPreflight().inspect(
            ModelPurpose.CUSTOMER_BRIEF,
            (ClassifiedField("brief", "closed R&D", DataClass.INTERNAL_BUSINESS),),
        )
    assert caught.value.code is ModelErrorCode.PRIVACY_POLICY_BLOCKED


def test_privacy_preflight_redacts_secret_and_minimizes_fields() -> None:
    result = PrivacyPreflight().inspect(
        ModelPurpose.BUDDY,
        (ClassifiedField("question", "api_key=not-a-real-secret", DataClass.PUBLIC),),
    )
    assert result.fields == {"question": "[REDACTED]"}
    assert result.redacted_fields == ("question",)


def test_budget_stops_tool_loop_and_preserves_manual_path() -> None:
    budget = AgentRunBudget(AgentLimits(max_tool_calls_per_run=1, max_steps_per_run=2))
    budget.start_request(ModelPurpose.BUDDY, "user-1", "run-1")
    budget.record_step("run-1", tool_calls=1)
    with pytest.raises(ModelGatewayError) as caught:
        budget.record_step("run-1", tool_calls=1)
    assert caught.value.code is ModelErrorCode.AGENT_BUDGET_EXCEEDED
    assert budget.manual_path()["status"] == "manual_available"


def test_circuit_breaker_opens_and_recovers() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    breaker = CircuitBreaker(2, timedelta(seconds=10))
    breaker.record_failure(now)
    breaker.record_failure(now)
    with pytest.raises(ModelGatewayError):
        breaker.ensure_available(now + timedelta(seconds=1))
    breaker.ensure_available(now + timedelta(seconds=11))


def test_prompt_version_is_immutable_and_hash_is_stable() -> None:
    registry = PromptRegistry()
    first = registry.register("buddy", "v1", "Ground every answer.")
    assert registry.register("buddy", "v1", "Ground every answer.") == first
    assert len(first.content_hash) == 64
    with pytest.raises(ValueError, match="immutable"):
        registry.register("buddy", "v1", "Changed")


def test_answer_rejects_unknown_source_and_extra_fields() -> None:
    with pytest.raises(ValidationError):
        AgentAnswer.model_validate(
            {
                "answer": "Use the roadmap.",
                "source_refs": ["foreign"],
                "allowed_source_refs": ["roadmap:1"],
                "grade": 5,
            }
        )
