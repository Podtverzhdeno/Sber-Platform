"""Idempotency guard shared by consequential commands."""

from __future__ import annotations

import asyncio
import re
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any, Protocol, cast

from impulse.api.errors import ApiError

IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$")


class IdempotencyStore(Protocol):
    async def execute[T](
        self,
        *,
        scope: str,
        key: str,
        fingerprint: str,
        operation: Callable[[], Coroutine[Any, Any, T]],
    ) -> T: ...


@dataclass(slots=True)
class _Entry:
    fingerprint: str
    task: asyncio.Task[object]


class InMemoryIdempotencyStore:
    """Process-local adapter for tests/dev; PostgreSQL adapter follows in group 3."""

    def __init__(self) -> None:
        self._entries: dict[tuple[str, str], _Entry] = {}
        self._lock = asyncio.Lock()

    async def execute[T](
        self,
        *,
        scope: str,
        key: str,
        fingerprint: str,
        operation: Callable[[], Coroutine[Any, Any, T]],
    ) -> T:
        if not IDEMPOTENCY_KEY.fullmatch(key):
            raise ApiError(
                code="INVALID_IDEMPOTENCY_KEY",
                message="Idempotency-Key должен содержать от 16 до 128 безопасных символов.",
                status_code=422,
            )

        identity = (scope, key)
        async with self._lock:
            existing = self._entries.get(identity)
            if existing is not None:
                if existing.fingerprint != fingerprint:
                    raise ApiError(
                        code="IDEMPOTENCY_CONFLICT",
                        message="Этот ключ уже использован для другого набора данных.",
                        status_code=409,
                    )
                task = existing.task
            else:

                async def run_operation() -> object:
                    return await operation()

                task = asyncio.create_task(run_operation())
                self._entries[identity] = _Entry(fingerprint=fingerprint, task=task)

        try:
            result = await asyncio.shield(task)
        except BaseException:
            async with self._lock:
                current = self._entries.get(identity)
                if current is not None and current.task is task:
                    self._entries.pop(identity)
            raise
        return cast(T, result)
