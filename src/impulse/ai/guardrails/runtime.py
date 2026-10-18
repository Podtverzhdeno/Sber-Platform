"""Per-run and per-user limits with a small provider circuit breaker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from impulse.ai.gateway import ModelErrorCode, ModelGatewayError, ModelPurpose


@dataclass(frozen=True, slots=True)
class AgentLimits:
    max_requests_per_user_day: int = 5
    max_requests_per_run: int = 3
    max_tool_calls_per_run: int = 4
    max_steps_per_run: int = 8
    timeout_seconds: float = 30.0


class AgentRunBudget:
    """In-memory fail-closed counters; domain work remains available after exhaustion."""

    def __init__(self, limits: AgentLimits) -> None:
        self.limits = limits
        self._daily: dict[tuple[ModelPurpose, str, date], int] = {}
        self._runs: dict[str, tuple[int, int, int]] = {}

    def start_request(self, purpose: ModelPurpose, user_id: str, run_id: str) -> None:
        today = datetime.now(UTC).date()
        key = (purpose, user_id, today)
        daily = self._daily.get(key, 0)
        requests, tools, steps = self._runs.get(run_id, (0, 0, 0))
        if daily >= self.limits.max_requests_per_user_day:
            self._exhausted()
        if requests >= self.limits.max_requests_per_run:
            self._exhausted()
        self._daily[key] = daily + 1
        self._runs[run_id] = (requests + 1, tools, steps)

    def record_step(self, run_id: str, *, tool_calls: int = 0) -> None:
        requests, tools, steps = self._runs.get(run_id, (0, 0, 0))
        tools += tool_calls
        steps += 1
        if tools > self.limits.max_tool_calls_per_run or steps > self.limits.max_steps_per_run:
            self._exhausted()
        self._runs[run_id] = (requests, tools, steps)

    @staticmethod
    def manual_path() -> dict[str, str]:
        return {"status": "manual_available", "reason": "ai_limit_reached"}

    @staticmethod
    def _exhausted() -> None:
        raise ModelGatewayError(ModelErrorCode.AGENT_BUDGET_EXCEEDED, retryable=False)


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_after: timedelta = timedelta(seconds=30)):
        self.failure_threshold = failure_threshold
        self.reset_after = reset_after
        self._failures = 0
        self._opened_at: datetime | None = None

    def ensure_available(self, now: datetime | None = None) -> None:
        current = now or datetime.now(UTC)
        if self._opened_at is not None and current - self._opened_at < self.reset_after:
            raise ModelGatewayError(ModelErrorCode.MODEL_UNAVAILABLE, retryable=True)
        if self._opened_at is not None:
            self._failures = 0
            self._opened_at = None

    def record_failure(self, now: datetime | None = None) -> None:
        self._failures += 1
        if self._failures >= self.failure_threshold:
            self._opened_at = now or datetime.now(UTC)

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None
