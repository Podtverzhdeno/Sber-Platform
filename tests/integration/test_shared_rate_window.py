"""PostgreSQL restart harness for cross-instance AI rate limiting (29.4)."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete

from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.rate_limit import ai_rate_events
from impulse.infrastructure.rate_limit_store import SqlRateWindowStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.fixture
async def rate_database() -> Database:
    database = Database(integration_url())
    async with database.session() as session:
        await session.execute(delete(ai_rate_events))
        await session.commit()
    return database


@pytest.mark.asyncio
async def test_limit_is_shared_between_instances_and_recovers(rate_database: Database) -> None:
    now = datetime.now(UTC)
    first_instance = SqlRateWindowStore(rate_database)
    second_instance = SqlRateWindowStore(rate_database)
    decisions = [
        (
            await first_instance.slide_window("auth", "key-a", window_seconds=60, limit=3, now=now)
        ).allowed,
        (
            await second_instance.slide_window("auth", "key-a", window_seconds=60, limit=3, now=now)
        ).allowed,
        (
            await first_instance.slide_window("auth", "key-a", window_seconds=60, limit=3, now=now)
        ).allowed,
    ]
    assert all(decisions)
    blocked = await second_instance.slide_window(
        "auth", "key-a", window_seconds=60, limit=3, now=now
    )
    assert blocked.allowed is False
    assert blocked.used == 3
    stranger = await second_instance.slide_window(
        "other", "key-b", window_seconds=60, limit=1, now=now
    )
    assert stranger.allowed is True
    after_window = now + timedelta(seconds=61)
    recovered = await first_instance.slide_window(
        "auth", "key-a", window_seconds=60, limit=3, now=after_window
    )
    assert recovered.allowed is True
    assert recovered.used == 1


@pytest.mark.asyncio
async def test_future_events_do_not_count_into_the_window(rate_database: Database) -> None:
    store = SqlRateWindowStore(rate_database)
    now = datetime.now(UTC)
    future = await store.slide_window(
        "agents", "key-future", window_seconds=60, limit=1, now=now - timedelta(hours=1)
    )
    assert future.allowed is True
    replay = await store.slide_window("agents", "key-future", window_seconds=60, limit=1, now=now)
    assert replay.allowed is True
    assert replay.used == 1
