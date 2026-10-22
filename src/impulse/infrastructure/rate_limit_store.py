"""Cross-instance sliding-window rate limiting (openspec 29.4)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.infrastructure.database import Database
from impulse.infrastructure.models.rate_limit import ai_rate_events


@dataclass(frozen=True, slots=True)
class RateWindowDecision:
    """Point-in-time cost of one in-category request for one actor."""

    allowed: bool
    used: int
    limit: int


class RateWindowStore(Protocol):
    async def slide_window(
        self,
        category: str,
        actor_key: str,
        *,
        window_seconds: float,
        limit: int,
        now: datetime,
    ) -> RateWindowDecision:
        raise NotImplementedError


class MemoryRateWindowStore(RateWindowStore):
    """Single-process fallback with the same contract as the SQL store."""

    def __init__(self) -> None:
        self._events: dict[tuple[str, str], list[datetime]] = {}

    async def slide_window(
        self,
        category: str,
        actor_key: str,
        *,
        window_seconds: float,
        limit: int,
        now: datetime,
    ) -> RateWindowDecision:
        key = (category, actor_key)
        cutoff = now - timedelta(seconds=window_seconds)
        retained = [stamp for stamp in self._events.get(key, []) if stamp >= cutoff]
        self._events[key] = retained
        if len(retained) >= limit:
            return RateWindowDecision(allowed=False, used=len(retained), limit=limit)
        retained.append(now)
        self._events[key] = retained
        return RateWindowDecision(allowed=True, used=len(retained), limit=limit)


class SqlRateWindowStore(RateWindowStore):
    """Persisted counters shared by every application instance (29.4)."""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def slide_window(
        self,
        category: str,
        actor_key: str,
        *,
        window_seconds: float,
        limit: int,
        now: datetime,
    ) -> RateWindowDecision:
        cutoff = now - timedelta(seconds=window_seconds)
        key = f"{category}:{actor_key}"
        lock_key = int.from_bytes(
            hashlib.blake2s(key.encode(), digest_size=8).digest(), "big", signed=True
        )
        async with self._database.session() as session:
            if await _owns_advisory_locks(session):
                await session.execute(select(func.pg_advisory_xact_lock(lock_key)))
            await session.execute(
                delete(ai_rate_events).where(
                    ai_rate_events.c.category == category,
                    ai_rate_events.c.actor_key == actor_key,
                    ai_rate_events.c.occurred_at < cutoff,
                )
            )
            used = (
                await session.execute(
                    select(func.count())
                    .select_from(ai_rate_events)
                    .where(
                        ai_rate_events.c.category == category,
                        ai_rate_events.c.actor_key == actor_key,
                        ai_rate_events.c.occurred_at >= cutoff,
                    )
                )
            ).scalar_one()
            if used >= limit:
                return RateWindowDecision(allowed=False, used=int(used), limit=limit)
            await session.execute(
                ai_rate_events.insert().values(
                    category=category,
                    actor_key=actor_key,
                    occurred_at=now,
                )
            )
            return RateWindowDecision(allowed=True, used=int(used) + 1, limit=limit)


async def _owns_advisory_locks(session: AsyncSession) -> bool:
    bind = session.bind
    return bind is not None and bind.dialect.name == "postgresql"
