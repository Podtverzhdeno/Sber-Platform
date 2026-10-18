"""Deterministic model gateway for tests, evaluation, and offline demos."""

from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel

from impulse.ai.gateway.contracts import (
    JsonObject,
    ModelErrorCode,
    ModelGatewayError,
    ModelMessage,
    ModelPurpose,
    ModelResult,
    ModelUsage,
    ToolCall,
    ToolDefinition,
)


class FakeOutcomeKind(StrEnum):
    TEXT = "text"
    TOOL = "tool"
    STRUCTURED = "structured"
    MALFORMED = "malformed"
    HTTP_ERROR = "http_error"
    TIMEOUT = "timeout"


@dataclass(frozen=True, slots=True)
class FakeOutcome:
    kind: FakeOutcomeKind
    text: str | None = None
    tool_call: ToolCall | None = None
    structured: JsonObject | None = None
    status_code: int | None = None

    @classmethod
    def text_response(cls, text: str) -> FakeOutcome:
        return cls(FakeOutcomeKind.TEXT, text=text)

    @classmethod
    def tool_response(cls, tool_call: ToolCall) -> FakeOutcome:
        return cls(FakeOutcomeKind.TOOL, tool_call=tool_call)

    @classmethod
    def structured_response(cls, payload: JsonObject) -> FakeOutcome:
        return cls(FakeOutcomeKind.STRUCTURED, structured=payload)

    @classmethod
    def malformed(cls) -> FakeOutcome:
        return cls(FakeOutcomeKind.MALFORMED)

    @classmethod
    def http_error(cls, status_code: int) -> FakeOutcome:
        return cls(FakeOutcomeKind.HTTP_ERROR, status_code=status_code)

    @classmethod
    def timeout(cls) -> FakeOutcome:
        return cls(FakeOutcomeKind.TIMEOUT)


@dataclass(frozen=True, slots=True)
class FakeInvocation:
    purpose: ModelPurpose
    messages: tuple[ModelMessage, ...]
    tools: tuple[ToolDefinition, ...]
    response_schema_name: str | None
    correlation_id: str


class FakeGateway:
    """Consume queued outcomes and record calls without network access."""

    def __init__(self, outcomes: Iterable[FakeOutcome]) -> None:
        self._outcomes = deque(outcomes)
        self.invocations: list[FakeInvocation] = []

    async def invoke(
        self,
        purpose: ModelPurpose,
        messages: Sequence[ModelMessage],
        *,
        tools: Sequence[ToolDefinition] = (),
        response_schema: type[BaseModel] | None = None,
        correlation_id: str,
    ) -> ModelResult:
        if not messages:
            raise ValueError("at least one model message is required")
        if not correlation_id:
            raise ValueError("correlation id must not be empty")
        self.invocations.append(
            FakeInvocation(
                purpose=purpose,
                messages=tuple(messages),
                tools=tuple(tools),
                response_schema_name=response_schema.__name__ if response_schema else None,
                correlation_id=correlation_id,
            )
        )
        if not self._outcomes:
            raise ModelGatewayError(ModelErrorCode.MODEL_UNAVAILABLE, retryable=False)

        outcome = self._outcomes.popleft()
        request_id = f"fake-{len(self.invocations)}"
        usage = ModelUsage(input_tokens=1, output_tokens=1)
        if outcome.kind is FakeOutcomeKind.TEXT and outcome.text is not None:
            return ModelResult.text_result(
                outcome.text,
                model_id="fake/model",
                provider="fake",
                request_id=request_id,
                usage=usage,
            )
        if outcome.kind is FakeOutcomeKind.TOOL and outcome.tool_call is not None:
            return ModelResult.tool_result(
                (outcome.tool_call,),
                model_id="fake/model",
                provider="fake",
                request_id=request_id,
                usage=usage,
            )
        if outcome.kind is FakeOutcomeKind.STRUCTURED and outcome.structured is not None:
            return ModelResult.structured_result(
                outcome.structured,
                model_id="fake/model",
                provider="fake",
                request_id=request_id,
                usage=usage,
            )
        if outcome.kind is FakeOutcomeKind.MALFORMED:
            raise ModelGatewayError(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)
        if outcome.kind is FakeOutcomeKind.TIMEOUT:
            await asyncio.sleep(0)
            raise ModelGatewayError(ModelErrorCode.MODEL_TIMEOUT, retryable=True)
        if outcome.kind is FakeOutcomeKind.HTTP_ERROR:
            return self._raise_http_error(outcome.status_code)
        raise ModelGatewayError(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)

    @staticmethod
    def _raise_http_error(status_code: int | None) -> ModelResult:
        if status_code == 402:
            raise ModelGatewayError(
                ModelErrorCode.AGENT_BUDGET_EXCEEDED,
                retryable=False,
                status_code=status_code,
            )
        if status_code == 429:
            raise ModelGatewayError(
                ModelErrorCode.MODEL_RATE_LIMITED,
                retryable=True,
                status_code=status_code,
            )
        raise ModelGatewayError(
            ModelErrorCode.MODEL_UNAVAILABLE,
            retryable=status_code is not None and status_code >= 500,
            status_code=status_code,
        )
