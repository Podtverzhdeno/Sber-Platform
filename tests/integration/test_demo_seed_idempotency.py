"""Regression: demo deploy seeding never overwrites runtime career or course progress.

Runs against a dedicated integration PostgreSQL database, not production.
"""

from __future__ import annotations

import os
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import delete, insert, select, update

from impulse.application.development import DevelopmentService
from impulse.application.identity import DemoAuthService
from impulse.bootstrap.ai_role_catalog import AI_ROLE_PROFILES
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.identity_store import SqlIdentityStore
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
        # A legacy user with one existing selection must not silently gain
        # two more "active" roles just because the catalog gained them.
        async with database.sessions() as session:
            all_attempts = (
                await session.execute(
                    select(track_attempts.c.id).where(track_attempts.c.person_id == alex_id)
                )
            ).all()
        assert len(all_attempts) == 1
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


@pytest.mark.asyncio
async def test_postgresql_api_returns_all_detailed_ai_paths_for_unselected_roles() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("TEST_DATABASE_URL is required")

    database = Database(async_database_url(url))
    try:
        await seed_demo(database)
        settings = Settings(
            app_env=AppEnvironment.TEST,
            demo_mode=True,
            session_secret=SecretStr("ai-catalog-integration-secret-long-enough"),
        )
        auth = DemoAuthService(
            SqlIdentityStore(database),
            secret=settings.session_signing_secret(),
            ttl_seconds=settings.session_ttl_seconds,
        )
        app = create_app(
            settings,
            auth_service=auth,
            development_service=DevelopmentService(SqlDevelopmentStore(database)),
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            logged_in = await client.post(
                "/api/v1/auth/demo-login",
                json={"persona_key": "participant-alex"},
            )
            assert logged_in.status_code == 200
            response = await client.get("/api/v1/me/roadmap-catalog")
            tracks_response = await client.get("/api/v1/development/tracks")
        assert response.status_code == 200, response.text
        assert tracks_response.status_code == 200, tracks_response.text
        items = {entry["track_key"]: entry for entry in response.json()}
        titles = {track["key"]: track["title"] for track in tracks_response.json()["tracks"]}
        assert set(items) == set(AI_ROLE_PROFILES) == set(titles)
        for key, plan in items.items():
            assert titles[key] == AI_ROLE_PROFILES[key]["title"]
            assert len(plan["milestones"]) == 7
            assert all(len(stage["activities"]) == 3 for stage in plan["milestones"])
            assert all(stage["deliverable"] for stage in plan["milestones"])
            assert all(len(stage["theory"]) == 2 for stage in plan["milestones"])
            assert all(len(stage["acceptance"]) == 3 for stage in plan["milestones"])
            assert all(stage["lab"] for stage in plan["milestones"])
            assert all(len(stage["resources"]) == 2 for stage in plan["milestones"])
            assert all(
                ref["url"].startswith("https://")
                for stage in plan["milestones"]
                for ref in stage["resources"]
            )
            assert all(4 <= stage["estimated_hours"] <= 16 for stage in plan["milestones"])
            assert [stage["position"] for stage in plan["milestones"]] == list(range(1, 8))
        assert all(not step["completed"] for step in items["data"]["milestones"])
    finally:
        await database.close()
