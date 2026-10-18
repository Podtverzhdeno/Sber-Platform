"""Independent agent kill switches with explicit degraded/manual state."""

from __future__ import annotations

from collections.abc import Mapping

from impulse.ai.gateway import ModelErrorCode, ModelGatewayError, ModelPurpose


class AgentKillSwitches:
    def __init__(self, enabled: Mapping[ModelPurpose, bool]) -> None:
        self._enabled = dict(enabled)

    def ensure_enabled(self, purpose: ModelPurpose) -> None:
        if not self._enabled.get(purpose, False):
            raise ModelGatewayError(ModelErrorCode.MODEL_UNAVAILABLE, retryable=False)

    def set_enabled(self, purpose: ModelPurpose, enabled: bool) -> None:
        self._enabled[purpose] = enabled

    def degraded_state(self, purpose: ModelPurpose) -> dict[str, str]:
        return {
            "purpose": purpose.value,
            "status": "available" if self._enabled.get(purpose, False) else "manual_available",
        }
