"""Regression: demo deploy seeding never overwrites runtime career or course progress.

Runs against a dedicated integration PostgreSQL database, not production.
"""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import delete, insert, select, update

from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.development import enrollments, track_attempts

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_reseed_preserves_runtime_attempt_and_course_completion() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("TEST_DATABASE_URL is required")

    database = Database(async_database_url(url))
    alex_id = demo_id("participant-alex")
    python_id = demo_id("track:python")
    course_id = demo_id("course:1")
    runtime_attempt_id = uuid4()
    try:
        await seed_demo(database)

        async with database.session() as session:
            # Simulate a participant-created attempt with an independently
            # generated UUID but the same business key as the demo seed.
            await session.execute(
                delete(track_attempts).where(
                    track_attempts.c.person_id == alex_id,
                    track_attempts.c.track_id == python_id,
                    track_attempts.c.attempt_number == 1,
                )
            )
            await session.execute(
                insert(track_attempts).values(
                    id=runtime_attempt_id,
                    person_id=alex_id,
                    track_id=python_id,
                    attempt_number=1,
                    status="active",
                    data_origin="demo_runtime",
                    payload={"completed_milestones": ["start-bootcamp", "stage-2"]},
                    created_by=alex_id,
                )
            )
            # A runtime completion can update a seed-owned enrollment in-place
            # without updating its data_origin flag.
            await session.execute(
                update(enrollments)
                .where(
                    enrollments.c.person_id == alex_id,
                    enrollments.c.course_id == course_id,
                    enrollments.c.attempt_number == 1,
                )
                .values(status="reported")
            )

        await seed_demo(database)
        await seed_demo(database)
        async with database.sessions() as session:
            attempts = (
                await session.execute(
                    select(
                        track_attempts.c.id,
                        track_attempts.c.status,
                        track_attempts.c.payload,
                    ).where(
                        track_attempts.c.person_id == alex_id,
                        track_attempts.c.track_id == python_id,
                        track_attempts.c.attempt_number == 1,
                    )
                )
            ).all()
            completion = await session.scalar(
                select(enrollments.c.status).where(
                    enrollments.c.person_id == alex_id,
                    enrollments.c.course_id == course_id,
                    enrollments.c.attempt_number == 1,
                )
            )
        assert len(attempts) == 1
        assert attempts[0].id == runtime_attempt_id
        assert attempts[0].status == "active"
        assert attempts[0].payload["completed_milestones"] == [
            "start-bootcamp",
            "stage-2",
        ]
        assert completion == "reported"
    finally:
        await database.close()
