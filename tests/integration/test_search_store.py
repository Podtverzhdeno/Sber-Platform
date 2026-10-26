"""PostgreSQL-backed global search over seeded tasks, courses and events."""

from __future__ import annotations

import os

import httpx
import pytest
from pydantic import SecretStr

from impulse.application.development import DevelopmentService
from impulse.application.ecosystem import EcosystemService
from impulse.application.identity import DemoAuthService
from impulse.application.work import WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import reset_demo_data, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.ecosystem_store import SqlEcosystemStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration

PERSONA = "participant-alex"


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


def _settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("integration-session-secret-longer-than-32"),
    )


@pytest.mark.asyncio
async def test_search_finds_published_task_dictionary_catalog() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    report = await seed_demo(database)
    assert report["tasks"] == 12
    assert report["courses"] == 40
    assert report["events"] == 8

    settings = _settings()
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    development = DevelopmentService(SqlDevelopmentStore(database))
    ecosystem = EcosystemService(SqlEcosystemStore(database))
    work = WorkService(SqlWorkStore(database))
    app = create_app(
        settings,
        auth_service=auth,
        development_service=development,
        ecosystem_service=ecosystem,
        work_service=work,
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post("/api/v1/auth/demo-login", json={"persona_key": PERSONA})
        assert login.status_code == 200

        query = "рекоменд"
        r = await client.get("/api/v1/search", params={"q": query})
        assert r.status_code == 200
        assert r.json()["items"], "expected at least one SQL hit"

        hits = r.json()["items"]
        assert all(
            item["kind"] in {"task", "course", "event"} and item["title"].strip() for item in hits
        )
        for item in hits:
            assert item["ref"].startswith(f"{item['kind']}:")
        task_hits = [item for item in hits if item["kind"] == "task"]
        assert task_hits, "seeded published task should match"
        assert task_hits[0]["title"].startswith("Прототип рекомендательной")
        assert task_hits[0]["ref"] == "task:demo-task-1"

        event_query = await client.get("/api/v1/search", params={"q": "хакатон"})
        assert any(item["kind"] == "event" for item in event_query.json()["items"]), (
            "SQL event titles should be searchable"
        )
