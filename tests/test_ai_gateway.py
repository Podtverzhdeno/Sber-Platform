from __future__ import annotations

import pytest

from impulse.ai.gateway import (
    FakeGateway,
    FakeOutcome,
    ModelErrorCode,
    ModelGateway,
    ModelGatewayError,
    ModelMessage,
    ModelOutputKind,
    ModelPurpose,
    ToolCall,
)


def messages() -> tuple[ModelMessage, ...]:
    return (ModelMessage(role="user", content="Explain my next step."),)


async def invoke(gateway: ModelGateway):
    return await gateway.invoke(
        ModelPurpose.BUDDY,
        messages(),
        correlation_id="correlation-1",
    )


async def test_fake_gateway_returns_text_and_records_purpose() -> None:
    gateway = FakeGateway([FakeOutcome.text_response("Continue the course.")])

    result = await invoke(gateway)

    assert result.kind is ModelOutputKind.TEXT
    assert result.text == "Continue the course."
    assert result.provider == "fake"
    assert result.usage.total_tokens == 2
    assert gateway.invocations[0].purpose is ModelPurpose.BUDDY


async def test_fake_gateway_returns_tool_call() -> None:
    call = ToolCall(call_id="call-1", name="get_my_tracks", arguments={})
    gateway = FakeGateway([FakeOutcome.tool_response(call)])

    result = await invoke(gateway)

    assert result.kind is ModelOutputKind.TOOL_CALLS
    assert result.tool_calls == (call,)


async def test_fake_gateway_returns_structured_payload() -> None:
    gateway = FakeGateway(
        [FakeOutcome.structured_response({"text": "Next step", "source_refs": ["track-1"]})]
    )

    result = await invoke(gateway)

    assert result.kind is ModelOutputKind.STRUCTURED
    assert result.structured == {"text": "Next step", "source_refs": ["track-1"]}


@pytest.mark.parametrize(
    ("outcome", "code", "retryable", "status_code"),
    [
        (FakeOutcome.malformed(), ModelErrorCode.MODEL_OUTPUT_MALFORMED, False, None),
        (FakeOutcome.http_error(402), ModelErrorCode.AGENT_BUDGET_EXCEEDED, False, 402),
        (FakeOutcome.http_error(429), ModelErrorCode.MODEL_RATE_LIMITED, True, 429),
        (FakeOutcome.timeout(), ModelErrorCode.MODEL_TIMEOUT, True, None),
    ],
)
async def test_fake_gateway_normalizes_failure_outcomes(
    outcome: FakeOutcome,
    code: ModelErrorCode,
    retryable: bool,
    status_code: int | None,
) -> None:
    gateway = FakeGateway([outcome])

    with pytest.raises(ModelGatewayError) as captured:
        await invoke(gateway)

    assert captured.value.code is code
    assert captured.value.retryable is retryable
    assert captured.value.status_code == status_code
    assert str(captured.value) == code.value
