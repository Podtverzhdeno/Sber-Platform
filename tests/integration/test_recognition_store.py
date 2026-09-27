"""PostgreSQL scenarios for immutable rating policy versions."""

import os
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import DBAPIError

from impulse.api.errors import ApiError
from impulse.bootstrap.demo_seed import seed_demo
from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    TieBreaker,
    rebuild_standings,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.recognition import score_ledger
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
    await seed_demo(database)
    store = SqlRecognitionStore(database)
    season = RatingSeason(uuid4(), f"test-{uuid4().hex}", "Test season")
    await store.add_season(season)
    policy = RatingPolicy(
        uuid4(),
        season.season_id,
        1,
        CohortRule("python", "Python", "impulse-demo", ("python",), 2),
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

    members = await store.cohort_members(policy)
    assert members
    source_id = uuid4()
    original = ScoreEntry(
        uuid4(),
        season.season_id,
        members[0].person_id,
        "project",
        source_id,
        "project",
        Decimal("80"),
        datetime.now(UTC),
    )
    await store.add_score_entry(original)
    with pytest.raises(ApiError) as duplicate:
        await store.add_score_entry(
            ScoreEntry(
                uuid4(),
                season.season_id,
                members[0].person_id,
                "project",
                source_id,
                "project",
                Decimal("80"),
                datetime.now(UTC),
            )
        )
    assert duplicate.value.code == "DUPLICATE_SCORE_SOURCE"
    correction = ScoreEntry(
        uuid4(),
        season.season_id,
        members[0].person_id,
        "project",
        uuid4(),
        "project",
        Decimal("-10"),
        datetime.now(UTC),
        correction_of=original.entry_id,
        correction_reason="Verified correction.",
    )
    await store.add_score_entry(correction)
    restored_entries = await store.score_entries(season.season_id)
    rows = rebuild_standings(policy, members, restored_entries)
    first_projection = await store.replace_standings(season.season_id, rows)
    second_projection = await store.replace_standings(season.season_id, rows)

    async with database.sessions() as session:
        ledger_count = await session.scalar(
            select(func.count())
            .select_from(score_ledger)
            .where(score_ledger.c.season_id == season.season_id)
        )
    assert ledger_count == 2
    assert first_projection == second_projection
    assert first_projection[0].score == Decimal("105.0")
    with pytest.raises(DBAPIError):
        async with database.session() as session:
            await session.execute(
                update(score_ledger)
                .where(score_ledger.c.id == original.entry_id)
                .values(points=Decimal("999"))
            )
    await database.close()
