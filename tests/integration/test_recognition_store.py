"""PostgreSQL scenarios for immutable rating policy versions."""

import os
from decimal import Decimal
from uuid import uuid4

import pytest

from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingSeason,
    ScoreSourceRule,
    TieBreaker,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.recognition_store import SqlRecognitionStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_policy_round_trip_and_season_binding() -> None:
    database = Database(integration_url())
    store = SqlRecognitionStore(database)
    season = RatingSeason(uuid4(), f"test-{uuid4().hex}", "Test season")
    await store.add_season(season)
    policy = RatingPolicy(
        uuid4(),
        season.season_id,
        1,
        CohortRule("python", "Python", "test", ("python",), 2),
        (ScoreSourceRule("project", "project", Decimal("1.5"), Decimal("600")),),
        (TieBreaker.SUCCESSFUL_PROJECTS, TieBreaker.PERSON_ID),
        (DiplomaThreshold("gold", 1, 3, "I degree"),),
        14,
    )
    await store.add_policy(policy)
    opened = season.open(policy)
    await store.save_season(opened, season.version)

    assert await store.latest_policy(season.season_id) == policy
    assert await store.season(season.season_id) == opened
    await database.close()
