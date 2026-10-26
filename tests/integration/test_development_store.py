"""PostgreSQL vertical slice for participant development progress."""

from __future__ import annotations

import os
from datetime import date

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from impulse.application.development import DevelopmentService
from impulse.application.identity import DemoAuthService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.development import (
    courses,
    enrollments,
    learning_days,
    track_attempts,
    tracks,
)

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_track_swap_reported_completion_and_one_learning_day() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("development-integration-secret-long-enough"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    development = DevelopmentService(SqlDevelopmentStore(database))
    app = create_app(settings, auth_service=auth, development_service=development)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        csrf = login.json()["csrf_token"]
        # Seeded participant already has product + ml active; freeze ml to make room.
        assert (
            await client.post(
                "/api/v1/me/tracks",
                json={"track_key": "data", "freeze_track_key": "ml"},
                headers={"X-CSRF-Token": csrf},
            )
        ).status_code == 200
        switched = await client.post(
            "/api/v1/me/tracks",
            json={"track_key": "product"},
            headers={"X-CSRF-Token": csrf},
        )
        assert switched.status_code == 200

        reported = await client.post(
            "/api/v1/me/courses/demo-course-5/completion",
            headers={"X-CSRF-Token": csrf},
        )
        assert reported.status_code == 200
        assert reported.json()["rating_eligible"] is False
        qualified_after_first: set[str] | None = None
        for occurred_at in ("2026-09-27T18:00:00Z", "2026-09-27T19:00:00Z"):
            day = await client.post(
                "/api/v1/me/courses/demo-course-5/learning-days",
                json={"occurred_at": occurred_at},
                headers={"X-CSRF-Token": csrf},
            )
            assert day.status_code == 200
            dates: set[str] = set(day.json()["qualified_dates"])
            if qualified_after_first is None:
                qualified_after_first = dates
            else:
                assert dates == qualified_after_first, "Two events on one day must not double count"

    async with database.sessions() as session:
        attempt_rows = (
            await session.execute(
                select(tracks.c.slug, track_attempts.c.status)
                .join(tracks, tracks.c.id == track_attempts.c.track_id)
                .where(track_attempts.c.person_id == demo_id("participant-alex"))
            )
        ).all()
        learning_count = int(
            await session.scalar(
                select(func.count())
                .select_from(
                    learning_days.join(
                        enrollments, enrollments.c.id == learning_days.c.enrollment_id
                    )
                )
                .where(
                    enrollments.c.person_id == demo_id("participant-alex"),
                    learning_days.c.local_date == date(2026, 9, 27),
                )
            )
            or 0
        )
        completion = (
            await session.execute(
                select(enrollments.c.status, enrollments.c.data_origin)
                .join(courses, courses.c.id == enrollments.c.course_id)
                .where(
                    enrollments.c.person_id == demo_id("participant-alex"),
                    courses.c.slug == "demo-course-5",
                    enrollments.c.attempt_number == 1,
                )
            )
        ).one_or_none()
    assert dict(attempt_rows) == {
        "python": "frozen",
        "data": "active",
        "product": "active",
        "ml": "frozen",
    }
    assert learning_count == 1
    assert completion is not None
    assert completion.status == "reported"
    # A participant reporting a pre-seeded course changes completion state,
    # not the provenance of the original enrollment.
    assert completion.data_origin == "demo_seed"
    await database.close()
