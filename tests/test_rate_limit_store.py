"""Shared cross-instance rate windows (29.4) — memory contract."""

from datetime import UTC, datetime, timedelta

import pytest

from impulse.infrastructure.rate_limit_store import MemoryRateWindowStore


def stamp(**delta: int) -> datetime:
    return datetime.now(UTC) + timedelta(**delta)


@pytest.mark.asyncio
async def test_memory_window_counts_requests_per_actor() -> None:
    store = MemoryRateWindowStore()
    first = await store.slide_window("auth", "actor-a", window_seconds=60, limit=2, now=stamp())
    second = await store.slide_window(
        "auth", "actor-a", window_seconds=60, limit=2, now=stamp(seconds=1)
    )
    third = await store.slide_window(
        "auth", "actor-a", window_seconds=60, limit=2, now=stamp(seconds=2)
    )
    stranger = await store.slide_window(
        "auth", "actor-b", window_seconds=60, limit=2, now=stamp(seconds=2)
    )
    assert (first.allowed, first.used) == (True, 1)
    assert (second.allowed, second.used) == (True, 2)
    assert (third.allowed, third.used) == (False, 2)
    assert stranger.allowed is True


@pytest.mark.asyncio
async def test_memory_window_recovers_after_expiry() -> None:
    store = MemoryRateWindowStore()
    now = stamp()
    await store.slide_window("search", "actor-a", window_seconds=1, limit=1, now=now)
    blocked = await store.slide_window("search", "actor-a", window_seconds=1, limit=1, now=now)
    assert blocked.allowed is False
    later = now + timedelta(seconds=2)
    recovered = await store.slide_window("search", "actor-a", window_seconds=1, limit=1, now=later)
    assert recovered.allowed is True
    assert recovered.used == 1
