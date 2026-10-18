from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

import httpx
import pytest
from pydantic import SecretStr

from impulse.ai.gateway import (
    ModelCapability,
    ModelErrorCode,
    ModelGatewayError,
    ModelPolicy,
    ModelProbeResult,
    ModelPurpose,
    ModelRegistry,
    OpenRouterCatalogProbe,
)


class Probe:
    def __init__(self, results: dict[str, ModelProbeResult]) -> None:
        self.results = results

    async def probe(self, model_id: str) -> ModelProbeResult:
        return self.results[model_id]


def result(model_id: str, *capabilities: ModelCapability) -> ModelProbeResult:
    return ModelProbeResult(
        model_id=model_id,
        available=True,
        prompt_price=Decimal("0"),
        completion_price=Decimal("0"),
        request_price=Decimal("0"),
        capabilities=frozenset(capabilities),
    )


def test_policy_rejects_non_free_slug() -> None:
    with pytest.raises(ValueError, match="paid"):
        ModelPolicy("v1", ModelPurpose.BUDDY, "openai/gpt-5")


async def test_registry_uses_only_verified_free_capable_fallback() -> None:
    primary = result("vendor/primary:free", ModelCapability.TEXT)
    fallback = result(
        "vendor/fallback:free",
        ModelCapability.TEXT,
        ModelCapability.TOOL_CALLING,
    )
    registry = ModelRegistry(
        [
            ModelPolicy(
                "v1",
                ModelPurpose.BUDDY,
                primary.model_id,
                (fallback.model_id,),
                frozenset({ModelCapability.TEXT, ModelCapability.TOOL_CALLING}),
            )
        ],
        Probe({primary.model_id: primary, fallback.model_id: fallback}),
    )

    await registry.startup_probe()

    assert registry.resolve(ModelPurpose.BUDDY) == fallback.model_id


async def test_registry_rejects_nonzero_price_despite_free_suffix() -> None:
    paid = replace(result("vendor/model:free", ModelCapability.TEXT), prompt_price=Decimal("0.1"))
    registry = ModelRegistry(
        [ModelPolicy("v1", ModelPurpose.BUDDY, paid.model_id)],
        Probe({paid.model_id: paid}),
    )
    await registry.startup_probe()

    with pytest.raises(ModelGatewayError) as captured:
        registry.resolve(ModelPurpose.BUDDY)

    assert captured.value.code is ModelErrorCode.MODEL_UNAVAILABLE


async def test_openrouter_catalog_probe_reads_price_and_capabilities() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "vendor/model:free",
                    "pricing": {"prompt": "0", "completion": "0", "request": "0"},
                    "supported_parameters": ["tools", "response_format", "max_tokens"],
                }
            },
        )

    async with OpenRouterCatalogProbe(
        SecretStr("synthetic-key"), transport=httpx.MockTransport(handler)
    ) as probe:
        checked = await probe.probe("vendor/model:free")

    assert checked.is_free is True
    assert checked.capabilities == frozenset(
        {
            ModelCapability.TEXT,
            ModelCapability.TOOL_CALLING,
            ModelCapability.STRUCTURED_OUTPUT,
        }
    )
