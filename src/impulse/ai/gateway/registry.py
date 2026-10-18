"""Versioned, free-only model policy registry and OpenRouter catalog probe."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Protocol, cast
from urllib.parse import quote

import httpx
from pydantic import SecretStr

from impulse.ai.gateway.contracts import JsonObject, ModelErrorCode, ModelGatewayError, ModelPurpose


class ModelCapability(StrEnum):
    TEXT = "text"
    TOOL_CALLING = "tool_calling"
    STRUCTURED_OUTPUT = "structured_output"


@dataclass(frozen=True, slots=True)
class ModelPolicy:
    version: str
    purpose: ModelPurpose
    primary: str
    fallbacks: tuple[str, ...] = ()
    required_capabilities: frozenset[ModelCapability] = frozenset({ModelCapability.TEXT})

    def __post_init__(self) -> None:
        if not self.version:
            raise ValueError("model policy version must not be empty")
        for model_id in (self.primary, *self.fallbacks):
            if not is_declared_free(model_id):
                raise ValueError(f"paid or unverifiable model is forbidden: {model_id}")


@dataclass(frozen=True, slots=True)
class ModelProbeResult:
    model_id: str
    available: bool
    prompt_price: Decimal
    completion_price: Decimal
    request_price: Decimal
    capabilities: frozenset[ModelCapability]

    @property
    def is_free(self) -> bool:
        return all(
            price == 0 for price in (self.prompt_price, self.completion_price, self.request_price)
        )


class ModelProbe(Protocol):
    async def probe(self, model_id: str) -> ModelProbeResult: ...


class ModelRegistry:
    """Resolve only available, capability-compatible, verified-free models."""

    def __init__(self, policies: Iterable[ModelPolicy], probe: ModelProbe) -> None:
        self._policies: dict[ModelPurpose, ModelPolicy] = {}
        for policy in policies:
            if policy.purpose in self._policies:
                raise ValueError(f"duplicate model policy for {policy.purpose.value}")
            self._policies[policy.purpose] = policy
        if not self._policies:
            raise ValueError("at least one model policy is required")
        self._probe = probe
        self._results: dict[str, ModelProbeResult] = {}

    async def startup_probe(self) -> None:
        model_ids = {
            model_id
            for policy in self._policies.values()
            for model_id in (policy.primary, *policy.fallbacks)
        }
        self._results = {model_id: await self._probe.probe(model_id) for model_id in model_ids}

    def resolve(self, purpose: ModelPurpose) -> str:
        policy = self._policies.get(purpose)
        if policy is None:
            raise ModelGatewayError(ModelErrorCode.MODEL_UNAVAILABLE, retryable=False)
        capability_failed = False
        for model_id in (policy.primary, *policy.fallbacks):
            result = self._results.get(model_id)
            if result is None or not result.available or not result.is_free:
                continue
            if not policy.required_capabilities.issubset(result.capabilities):
                capability_failed = True
                continue
            return model_id
        code = (
            ModelErrorCode.MODEL_CAPABILITY_UNAVAILABLE
            if capability_failed
            else ModelErrorCode.MODEL_UNAVAILABLE
        )
        raise ModelGatewayError(code, retryable=False)

    def diagnostics(self) -> tuple[ModelProbeResult, ...]:
        return tuple(self._results[key] for key in sorted(self._results))


class OpenRouterCatalogProbe:
    """Read price and capability metadata from OpenRouter's Models API."""

    def __init__(
        self,
        api_key: SecretStr,
        *,
        base_url: str = "https://openrouter.ai/api/v1",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key.get_secret_value():
            raise ValueError("OpenRouter API key must not be empty")
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/") + "/",
            headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
            timeout=15,
            transport=transport,
        )

    async def __aenter__(self) -> OpenRouterCatalogProbe:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self._client.aclose()

    async def probe(self, model_id: str) -> ModelProbeResult:
        if not is_declared_free(model_id):
            raise ValueError(f"paid or unverifiable model is forbidden: {model_id}")
        author, separator, slug = model_id.partition("/")
        if not separator or not author or not slug:
            raise ValueError("OpenRouter model id must use '<author>/<slug>'")
        response = await self._client.get(f"model/{quote(author)}/{quote(slug, safe=':')}")
        if response.status_code == 404:
            return unavailable_probe(model_id)
        response.raise_for_status()
        raw_object = cast(object, response.json())
        if not isinstance(raw_object, dict):
            return unavailable_probe(model_id)
        raw = cast(dict[str, object], raw_object)
        if not isinstance(raw.get("data"), dict):
            return unavailable_probe(model_id)
        data = cast(JsonObject, raw["data"])
        pricing = data.get("pricing")
        parameters = data.get("supported_parameters")
        if not isinstance(pricing, dict) or not isinstance(parameters, list):
            return unavailable_probe(model_id)
        typed_pricing = cast(dict[str, object], pricing)
        names = {item for item in parameters if isinstance(item, str)}
        capabilities = {ModelCapability.TEXT}
        if {"tools", "tool_choice"}.intersection(names):
            capabilities.add(ModelCapability.TOOL_CALLING)
        if {"response_format", "structured_outputs"}.intersection(names):
            capabilities.add(ModelCapability.STRUCTURED_OUTPUT)
        try:
            return ModelProbeResult(
                model_id=model_id,
                available=True,
                prompt_price=_price(typed_pricing.get("prompt")),
                completion_price=_price(typed_pricing.get("completion")),
                request_price=_price(typed_pricing.get("request")),
                capabilities=frozenset(capabilities),
            )
        except (InvalidOperation, ValueError):
            return unavailable_probe(model_id)


def is_declared_free(model_id: str) -> bool:
    return model_id == "openrouter/free" or model_id.endswith(":free")


def unavailable_probe(model_id: str) -> ModelProbeResult:
    return ModelProbeResult(
        model_id=model_id,
        available=False,
        prompt_price=Decimal("0"),
        completion_price=Decimal("0"),
        request_price=Decimal("0"),
        capabilities=frozenset(),
    )


def _price(value: object) -> Decimal:
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        raise ValueError("missing model price")
    return Decimal(str(value))
