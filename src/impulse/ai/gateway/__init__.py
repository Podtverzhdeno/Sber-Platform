"""Provider-independent model gateway contracts."""

from impulse.ai.gateway.contracts import (
    JsonObject,
    JsonValue,
    ModelErrorCode,
    ModelGateway,
    ModelGatewayError,
    ModelMessage,
    ModelOutputKind,
    ModelPurpose,
    ModelResult,
    ModelUsage,
    ToolCall,
    ToolDefinition,
)
from impulse.ai.gateway.fake import FakeGateway, FakeInvocation, FakeOutcome
from impulse.ai.gateway.openrouter import OpenRouterGateway
from impulse.ai.gateway.registry import (
    ModelCapability,
    ModelPolicy,
    ModelProbe,
    ModelProbeResult,
    ModelRegistry,
    OpenRouterCatalogProbe,
)

__all__ = [
    "FakeGateway",
    "FakeInvocation",
    "FakeOutcome",
    "JsonObject",
    "JsonValue",
    "ModelCapability",
    "ModelErrorCode",
    "ModelGateway",
    "ModelGatewayError",
    "ModelMessage",
    "ModelOutputKind",
    "ModelPolicy",
    "ModelProbe",
    "ModelProbeResult",
    "ModelPurpose",
    "ModelRegistry",
    "ModelResult",
    "ModelUsage",
    "OpenRouterCatalogProbe",
    "OpenRouterGateway",
    "ToolCall",
    "ToolDefinition",
]
