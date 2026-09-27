"""PostgreSQL-backed identity and visibility projection scenarios."""

from __future__ import annotations

import os

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from impulse.application.identity import DemoAuthService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.identity import consents, visibility_settings
from impulse.infrastructure.models.insight import audit_entries

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
@pytest.mark.spec("identity-access/multiple-work-roles")
async def test_sql_session_role_switch_and_consent_projection() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("integration-session-secret-longer-than-32"),
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
        login = await client.post("/api/v1/auth/demo-login", json={"persona_key": "manager-olga"})
        assert login.status_code == 200
        assert login.json()["assigned_roles"] == ["manager", "customer"]
        switched = await client.post(
            "/api/v1/me/active-role",
            json={"role": "customer"},
            headers={"X-CSRF-Token": login.json()["csrf_token"]},
        )
        assert switched.status_code == 200
        assert switched.json()["active_role"] == "customer"

        participant = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        csrf = participant.json()["csrf_token"]
        grant = await client.put(
            "/api/v1/me/consents/hr_profile",
            json={"granted": True},
            headers={"X-CSRF-Token": csrf},
        )
        revoke = await client.put(
            "/api/v1/me/consents/hr_profile",
            json={"granted": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert grant.status_code == revoke.status_code == 200

    async with database.sessions() as session:
        count = int(
            await session.scalar(
                select(func.count())
                .select_from(consents)
                .where(
                    consents.c.person_id == demo_id("participant-alex"),
                    consents.c.scope == "hr_profile",
                )
            )
            or 0
        )
        visible = await session.scalar(
            select(visibility_settings.c.visible).where(
                visibility_settings.c.person_id == demo_id("participant-alex"),
                visibility_settings.c.scope == "hr_profile",
            )
        )
        audit_count = int(
            await session.scalar(
                select(func.count())
                .select_from(audit_entries)
                .where(
                    audit_entries.c.created_by == demo_id("participant-alex"),
                    audit_entries.c.entity_type == "consent",
                )
            )
            or 0
        )

    assert (count, bool(visible), audit_count) == (2, False, 2)
    await database.close()
