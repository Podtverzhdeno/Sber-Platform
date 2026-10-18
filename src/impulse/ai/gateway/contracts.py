"""Stable contracts between Impulse agents and model-provider adapters."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

type JsonValue = bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None
type JsonObject = dict[str, JsonValue]


class ModelPurpose(StrEnum):
    """Business purpose selected by trusted server code, never by the model."""

    BUDDY = "buddy"
    MENTOR_REVIEW = "mentor_review"
    OPERATOR_TRIAGE = "operator_triage"
    CUSTOMER_BRIEF = "customer_brief"


class ModelOutputKind(StrEnum):
    TEXT = "text"
    TOOL_CALLS = "tool_calls"
    STRUCTURED = "structured"


class ModelErrorCode(StrEnum):
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    MODEL_CAPABILITY_UNAVAILABLE = "MODEL_CAPABILITY_UNAVAILABLE"
    MODEL_OUTPUT_MALFORMED = "MODEL_OUTPUT_MALFORMED"
    AGENT_BUDGET_EXCEEDED = "AGENT_BUDGET_EXCEEDED"
    MODEL_RATE_LIMITED = "MODEL_RATE_LIMITED"
    MODEL_TIMEOUT = "MODEL_TIMEOUT"
    PRIVACY_POLICY_BLOCKED = "PRIVACY_POLICY_BLOCKED"


@dataclass(frozen=True, slots=True)
class ModelMessage:
    """Minimal conversation message without provider-specific message classes."""

    role: str
    content: str

    def __post_init__(self) -> None:
        if self.role not in {"system", "user", "assistant", "tool"}:
            raise ValueError(f"unsupported model message role: {self.role}")
        if not self.content:
            raise ValueError("model message content must not be empty")


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    description: str
    input_schema: JsonObject

    def __post_init__(self) -> None:
        if not self.name or not self.description:
            raise ValueError("tool name and description must not be empty")


@dataclass(frozen=True, slots=True)
class ToolCall:
    call_id: str
    name: str
    arguments: JsonObject

    def __post_init__(self) -> None:
        if not self.call_id or not self.name:
            raise ValueError("tool call id and name must not be empty")


@dataclass(frozen=True, slots=True)
class ModelUsage:
    input_tokens: int = 0
    output_tokens: int = 0

    def __post_init__(self) -> None:
        if self.input_tokens < 0 or self.output_tokens < 0:
            raise ValueError("token usage must not be negative")

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass(frozen=True, slots=True)
class ModelResult:
    """Normalized model response; exactly one output payload is populated."""

    kind: ModelOutputKind
    model_id: str
    provider: str
    request_id: str
    usage: ModelUsage = field(default_factory=ModelUsage)
    text: str | None = None
    tool_calls: tuple[ToolCall, ...] = ()
    structured: JsonObject | None = None

    def __post_init__(self) -> None:
        if not self.model_id or not self.provider or not self.request_id:
            raise ValueError("model, provider, and request id must not be empty")
        populated = sum((self.text is not None, bool(self.tool_calls), self.structured is not None))
        if populated != 1:
            raise ValueError("exactly one model output payload must be populated")
        if self.kind is ModelOutputKind.TEXT and self.text is None:
            raise ValueError("text result requires text")
        if self.kind is ModelOutputKind.TOOL_CALLS and not self.tool_calls:
            raise ValueError("tool result requires at least one tool call")
        if self.kind is ModelOutputKind.STRUCTURED and self.structured is None:
            raise ValueError("structured result requires a payload")

    @classmethod
    def text_result(
        cls,
        text: str,
        *,
        model_id: str,
        provider: str,
        request_id: str,
        usage: ModelUsage | None = None,
    ) -> ModelResult:
        return cls(
            kind=ModelOutputKind.TEXT,
            text=text,
            model_id=model_id,
            provider=provider,
            request_id=request_id,
            usage=usage or ModelUsage(),
        )

    @classmethod
    def tool_result(
        cls,
        tool_calls: Sequence[ToolCall],
        *,
        model_id: str,
        provider: str,
        request_id: str,
        usage: ModelUsage | None = None,
    ) -> ModelResult:
        return cls(
            kind=ModelOutputKind.TOOL_CALLS,
            tool_calls=tuple(tool_calls),
            model_id=model_id,
            provider=provider,
            request_id=request_id,
            usage=usage or ModelUsage(),
        )

    @classmethod
    def structured_result(
        cls,
        structured: Mapping[str, JsonValue],
        *,
        model_id: str,
        provider: str,
        request_id: str,
        usage: ModelUsage | None = None,
    ) -> ModelResult:
        return cls(
            kind=ModelOutputKind.STRUCTURED,
            structured=dict(structured),
            model_id=model_id,
            provider=provider,
            request_id=request_id,
            usage=usage or ModelUsage(),
        )


class ModelGatewayError(RuntimeError):
    """Sanitized provider-independent failure safe for application handling."""

    def __init__(
        self,
        code: ModelErrorCode,
        *,
        retryable: bool,
        status_code: int | None = None,
    ) -> None:
        super().__init__(code.value)
        self.code = code
        self.retryable = retryable
        self.status_code = status_code

    @classmethod
    def from_malformed(cls) -> ModelGatewayError:
        return cls(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)


@runtime_checkable
class ModelGateway(Protocol):
    """The only model invocation dependency exposed to graphs and use cases."""

    async def invoke(
        self,
        purpose: ModelPurpose,
        messages: Sequence[ModelMessage],
        *,
        tools: Sequence[ToolDefinition] = (),
        response_schema: type[BaseModel] | None = None,
        correlation_id: str,
    ) -> ModelResult: ...
