"""OpenRouter adapter. LangChain/OpenRouter types do not escape this module."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, cast

import httpx
from langchain_core.messages import AIMessage
from langchain_openrouter import ChatOpenRouter
from pydantic import BaseModel, SecretStr

from impulse.ai.gateway.contracts import (
    JsonObject,
    JsonValue,
    ModelErrorCode,
    ModelGatewayError,
    ModelMessage,
    ModelPurpose,
    ModelResult,
    ModelUsage,
    ToolCall,
    ToolDefinition,
)


class OpenRouterGateway:
    """Invoke ChatOpenRouter and normalize SDK responses into Impulse contracts."""

    def __init__(
        self,
        *,
        api_key: SecretStr,
        model_id: str,
        policy_version: str,
        timeout_seconds: int = 30,
        max_tokens: int = 1200,
        sdk_client: Any | None = None,
    ) -> None:
        if not api_key.get_secret_value():
            raise ValueError("OpenRouter API key must not be empty")
        if not model_id or not policy_version:
            raise ValueError("model id and policy version must not be empty")
        self._model_id = model_id
        self._policy_version = policy_version
        self._model = ChatOpenRouter(
            api_key=api_key,
            model=model_id,
            timeout=timeout_seconds * 1000,
            max_tokens=max_tokens,
            max_retries=0,
            openrouter_provider={"data_collection": "deny"},
            app_title="Impulse",
            client=sdk_client,
        )

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
        runnable: Any = self._model
        if tools:
            runnable = runnable.bind_tools([self._tool_schema(tool) for tool in tools], strict=True)
        if response_schema is not None:
            runnable = runnable.with_structured_output(
                response_schema,
                method="json_schema",
                strict=True,
            )
        converted = [(message.role, message.content) for message in messages]
        try:
            response = await runnable.ainvoke(
                converted,
                config={
                    "metadata": {
                        "purpose": purpose.value,
                        "model_policy_version": self._policy_version,
                        "correlation_id": correlation_id,
                    }
                },
            )
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise ModelGatewayError(ModelErrorCode.MODEL_TIMEOUT, retryable=True) from exc
        except Exception as exc:
            raise self._normalized_error(exc) from exc

        if isinstance(response, AIMessage):
            return self._normalize_message(response, correlation_id)
        if isinstance(response, BaseModel):
            return ModelResult.structured_result(
                cast(JsonObject, response.model_dump(mode="json")),
                model_id=self._model_id,
                provider="openrouter",
                request_id=correlation_id,
            )
        raise ModelGatewayError(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)

    @staticmethod
    def _tool_schema(tool: ToolDefinition) -> dict[str, JsonValue]:
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            },
        }

    def _normalize_message(self, message: AIMessage, correlation_id: str) -> ModelResult:
        metadata = message.response_metadata
        model_id = self._string_metadata(metadata, "model_name", "model") or self._model_id
        provider = self._string_metadata(metadata, "provider") or self._provider_from_model(
            model_id
        )
        request_id = self._string_metadata(metadata, "id", "request_id") or correlation_id
        usage = message.usage_metadata or {}
        normalized_usage = ModelUsage(
            input_tokens=self._int_value(usage.get("input_tokens")),
            output_tokens=self._int_value(usage.get("output_tokens")),
        )
        calls = tuple(self._normalize_tool_call(call) for call in message.tool_calls)
        if calls:
            return ModelResult.tool_result(
                calls,
                model_id=model_id,
                provider=provider,
                request_id=request_id,
                usage=normalized_usage,
            )
        text = self._text_content(message.content)
        if not text:
            raise ModelGatewayError(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)
        return ModelResult.text_result(
            text,
            model_id=model_id,
            provider=provider,
            request_id=request_id,
            usage=normalized_usage,
        )

    @staticmethod
    def _normalize_tool_call(call: Mapping[str, Any]) -> ToolCall:
        call_id = call.get("id")
        name = call.get("name")
        arguments = call.get("args")
        if (
            not isinstance(call_id, str)
            or not isinstance(name, str)
            or not isinstance(arguments, dict)
        ):
            raise ModelGatewayError(ModelErrorCode.MODEL_OUTPUT_MALFORMED, retryable=False)
        return ToolCall(
            call_id=call_id,
            name=name,
            arguments=cast(JsonObject, arguments),
        )

    @staticmethod
    def _text_content(content: str | list[str | dict[str, Any]]) -> str:
        if isinstance(content, str):
            return content.strip()
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif block.get("type") == "text":
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts).strip()

    @staticmethod
    def _string_metadata(metadata: Mapping[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = metadata.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    @staticmethod
    def _int_value(value: object) -> int:
        return value if isinstance(value, int) and value >= 0 else 0

    @staticmethod
    def _provider_from_model(model_id: str) -> str:
        provider, separator, _model = model_id.partition("/")
        return provider if separator and provider else "openrouter"

    @staticmethod
    def _normalized_error(exc: Exception) -> ModelGatewayError:
        status = getattr(exc, "status_code", None)
        if not isinstance(status, int):
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
        if status == 402:
            return ModelGatewayError(
                ModelErrorCode.AGENT_BUDGET_EXCEEDED,
                retryable=False,
                status_code=402,
            )
        if status == 429:
            return ModelGatewayError(
                ModelErrorCode.MODEL_RATE_LIMITED,
                retryable=True,
                status_code=429,
            )
        return ModelGatewayError(
            ModelErrorCode.MODEL_UNAVAILABLE,
            retryable=isinstance(status, int) and status >= 500,
            status_code=status if isinstance(status, int) else None,
        )
