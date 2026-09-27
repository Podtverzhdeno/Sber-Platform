"""PostgreSQL customer task publication workflow."""

from __future__ import annotations

import os

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import select

from impulse.application.identity import DemoAuthService
from impulse.application.work import WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.work import tasks
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_customer_task_stays_unpublished_until_support_is_assigned() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("work-integration-secret-long-enough"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(
        settings,
        auth_service=auth,
        work_service=WorkService(SqlWorkStore(database)),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        customer_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "customer-roman"}
        )
        customer_csrf = customer_login.json()["csrf_token"]
        draft = await client.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={
                "task_key": "postgres-rd",
                "title": "PostgreSQL R&D",
                "problem": "Проверить хранение workflow.",
                "deliverable": "Рабочий вертикальный срез.",
                "acceptance_criteria": ["Состояния сохранены"],
                "deadline_at": "2026-11-01T18:00:00Z",
                "data_constraints": "Без персональных данных.",
                "ip_terms": "Права передаются после приёмки.",
                "nominated_mentor_id": None,
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert draft.status_code == 200
        task_id = draft.json()["id"]
        await client.post(
            f"/api/v1/customer/tasks/{task_id}/submit",
            headers={"X-CSRF-Token": customer_csrf},
        )
        operator_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "operator-pavel"}
        )
        operator_csrf = operator_login.json()["csrf_token"]
        moderated = await client.post(
            f"/api/v1/operations/tasks/{task_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert moderated.json()["status"] == "awaiting_support"
        blocked = await client.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert blocked.status_code == 409
        await client.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "buddy", "assignee_id": None},
            headers={"X-CSRF-Token": operator_csrf},
        )
        published = await client.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert published.json()["status"] == "published"

    async with database.sessions() as session:
        row = (
            await session.execute(
                select(tasks.c.status, tasks.c.version, tasks.c.payload).where(
                    tasks.c.id == task_id
                )
            )
        ).one()
    assert row.status == "published"
    assert row.version == 5
    assert row.payload["support"]["mode"] == "buddy"
    assert row.payload["nominated_mentor_id"] is None
    await database.close()
