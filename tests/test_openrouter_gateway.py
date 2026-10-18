from __future__ import annotations

import json
from typing import Any, cast

import httpx
import openrouter
from pydantic import SecretStr

from impulse.ai.gateway import (
    ModelMessage,
    ModelOutputKind,
    ModelPurpose,
    OpenRouterGateway,
)


async def test_openrouter_gateway_normalizes_mock_transport_response() -> None:
    captured: dict[str, Any] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["authorization"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "generation-request-7",
                "provider": "SyntheticProvider",
                "model": "synthetic/model:free",
                "object": "chat.completion",
                "created": 1_797_000_000,
                "system_fingerprint": None,
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": "Grounded answer."},
                    }
                ],
                "usage": {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
            },
        )

    async_client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://openrouter.test/api/v1",
    )
    sdk_client = openrouter.OpenRouter(
        api_key="synthetic-key",
        server_url="https://openrouter.test/api/v1",
        async_client=cast(Any, async_client),
    )
    gateway = OpenRouterGateway(
        api_key=SecretStr("synthetic-key"),
        model_id="openrouter/free",
        policy_version="policy-v1",
        sdk_client=sdk_client,
    )
    try:
        result = await gateway.invoke(
            ModelPurpose.BUDDY,
            (ModelMessage(role="user", content="What is next?"),),
            correlation_id="correlation-7",
        )
    finally:
        await async_client.aclose()

    assert captured["path"] == "/api/v1/chat/completions"
    assert captured["authorization"] == "Bearer synthetic-key"
    assert captured["body"]["model"] == "openrouter/free"
    assert result.kind is ModelOutputKind.TEXT
    assert result.text == "Grounded answer."
    assert result.model_id == "synthetic/model:free"
    assert result.provider == "synthetic"
    assert result.request_id == "generation-request-7"
    assert result.usage.input_tokens == 11
    assert result.usage.output_tokens == 7
