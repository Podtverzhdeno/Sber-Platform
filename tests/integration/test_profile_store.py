"""PostgreSQL scenarios for participant profile persistence and versioned consents."""

from __future__ import annotations

import os

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import delete, func, select

from impulse.application.identity import DemoAuthService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.identity import (
    consents,
    profile_skills,
    visibility_settings,
)
from impulse.infrastructure.models.insight import audit_entries

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_profile_preferences_survive_new_sql_session() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("profile-integration-secret-long-enough"),
    )
    service = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        csrf = login.json()["csrf_token"]
        updated = await client.put(
            "/api/v1/me/profile",
            headers={"X-CSRF-Token": csrf},
            json={
                "display_name": "Алекс Речной-Петров",
                "city": "Амман",
                "university": "МГТУ",
                "study_year": "4 курс",
                "primary_track": "Python-разработчик",
                "email": "alex@example.test",
                "telegram": "@alex_data",
                "about": "Развиваю backend и аналитику.",
                "locale": "en-US",
                "theme": "system",
                "timezone": "Asia/Amman",
                "buddy_enabled": False,
                "skills": ["FastAPI", "Проверки zip"],
            },
        )
        assert updated.status_code == 200
        persisted = updated.json()
        assert persisted["locale"] == "en-US"
        assert persisted["theme"] == "system"
        assert persisted["buddy_enabled"] is False

        await client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        relogin = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        assert relogin.status_code == 200
        me = await client.get("/api/v1/me")
        assert me.json()["locale"] == "en-US"
        refreshed = await client.get("/api/v1/me/profile")
        body = refreshed.json()
        assert body["timezone"] == "Asia/Amman"
        assert body["buddy_enabled"] is False
        self_reported = [item for item in body["skills"] if item["origin"] == "self_reported"]
        assert [item["title"] for item in self_reported] == ["FastAPI", "Проверки zip"]

    async with database.sessions() as session:
        rows = (
            await session.execute(
                select(profile_skills.c.title, profile_skills.c.origin).where(
                    profile_skills.c.person_id == demo_id("participant-alex")
                )
            )
        ).all()
        titles = {row.title for row in rows}
        assert "FastAPI" in titles
        audit_rows = (
            await session.execute(
                select(func.count())
                .select_from(audit_entries)
                .where(
                    audit_entries.c.created_by == demo_id("participant-alex"),
                    audit_entries.c.action == "profile.updated",
                )
            )
        ).scalar_one()
        assert audit_rows >= 1
    await database.close()


@pytest.mark.asyncio
async def test_consents_append_new_versions_per_toggle() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("consent-integration-secret-long-enough"),
    )
    service = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    person = demo_id("participant-alex")
    async with database.sessions() as session:
        rows_before = (
            await session.execute(
                select(consents.c.version, consents.c.granted)
                .where(consents.c.person_id == person, consents.c.scope == "hr_profile")
                .order_by(consents.c.version)
            )
        ).all()
    asg = [{"version": row.version, "granted": row.granted} for row in rows_before]
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        csrf = login.json()["csrf_token"]
        for granted in (True, False, True):
            response = await client.put(
                "/api/v1/me/consents/hr_profile",
                json={"granted": granted},
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200

    async with database.sessions() as session:
        rows = (
            await session.execute(
                select(consents.c.version, consents.c.granted)
                .where(consents.c.person_id == person, consents.c.scope == "hr_profile")
                .order_by(consents.c.version)
            )
        ).all()
        tail = [(row.version, row.granted) for row in rows][len(asg) :]
        assert [item[1] for item in tail] == [True, False, True]
        base_version = rows_before[-1].version if rows_before else 0
        assert [item[0] for item in tail] == list(range(base_version + 1, base_version + 4))
        audit_count = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(audit_entries)
                    .where(
                        audit_entries.c.created_by == person,
                        audit_entries.c.entity_type == "consent",
                    )
                )
            ).scalar_one()
        )
        assert audit_count >= 3
    await database.close()


@pytest.mark.asyncio
async def test_hr_visibility_matrix_rows_persist_per_scope() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("visibility-integration-secret-long-enough"),
    )
    service = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    person = demo_id("participant-alex")
    async with database.sessions() as session:
        await session.execute(
            delete(visibility_settings).where(visibility_settings.c.person_id == person)
        )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        csrf = login.json()["csrf_token"]
        await client.put(
            "/api/v1/me/consents/hr_profile",
            json={"granted": True},
            headers={"X-CSRF-Token": csrf},
        )
        toggles = (("hr_contacts", True), ("hr_learning", False), ("hr_projects", False))
        for scope, visible in toggles:
            response = await client.put(
                f"/api/v1/me/visibility/{scope}",
                json={"visible": visible},
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200

    async with database.sessions() as session:
        rows = (
            await session.execute(
                select(visibility_settings.c.scope, visibility_settings.c.visible).where(
                    visibility_settings.c.person_id == person,
                    visibility_settings.c.scope.in_(("hr_contacts", "hr_learning", "hr_projects")),
                )
            )
        ).all()
        assert {row.scope: bool(row.visible) for row in rows} == {
            "hr_contacts": True,
            "hr_learning": False,
            "hr_projects": False,
        }
        audit_rows = (
            await session.execute(
                select(func.count())
                .select_from(audit_entries)
                .where(
                    audit_entries.c.created_by == person,
                    audit_entries.c.action == "visibility.updated",
                )
            )
        ).scalar_one()
        assert audit_rows >= 3
    await database.close()
