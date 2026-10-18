"""Optional, failure-isolated AI telemetry with metadata-only defaults."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol


class TelemetryClient(Protocol):
    def create_event(self, *, name: str, metadata: Mapping[str, str | int | float]) -> object: ...


class LangfuseAdapter:
    def __init__(self, client: TelemetryClient | None, *, content_capture: bool = False) -> None:
        self.client = client
        self.content_capture = content_capture

    def record_run(
        self,
        *,
        run_id: str,
        purpose: str,
        model_id: str,
        policy_version: str,
        latency_ms: float,
        input_tokens: int,
        output_tokens: int,
    ) -> bool:
        if self.client is None:
            return False
        metadata: dict[str, str | int | float] = {
            "run_id": run_id,
            "purpose": purpose,
            "model_id": model_id,
            "policy_version": policy_version,
            "latency_ms": latency_ms,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }
        try:
            self.client.create_event(name="impulse.ai.run", metadata=metadata)
        except Exception:
            return False
        return True
