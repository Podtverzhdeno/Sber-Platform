"""Idempotent application flow: repeat response POST keeps one record and one audit event."""

from __future__ import annotations

import os
from uuid import UUID, uuid4

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from impulse.application.identity import DemoAuthService
from impulse.application.work import WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.insight import domain_events
from impulse.infrastructure.models.work import applications
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_repeated_application_post_returns_same_record() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("idempotency-integration-secret-long"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work_store = SqlWorkStore(database)
    app = create_app(
        settings,
        auth_service=auth,
        work_service=WorkService(work_store),
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
                "task_key": f"idempotent-rd-{uuid4().hex}",
                "title": "Идемпотентный отклик",
                "problem": "Повторный запрос не должен создавать вторую запись.",
                "deliverable": "Один отклик на участника и задачу.",
                "acceptance_criteria": ["Повтор возвращает тот же отклик"],
                "deadline_at": "2026-11-05T18:00:00Z",
                "data_constraints": "Без персональных данных.",
                "ip_terms": "Права передаются после приёмки.",
                "nominated_mentor_id": None,
                "compensation": {
                    "paid": False,
                    "base_amount_per_assignee": None,
                    "currency": None,
                    "a_multiplier": "2.00",
                    "quantum": "0.01",
                    "rounding_mode": "half_up",
                    "policy_version": 1,
                    "payout_condition": "Вознаграждение не предусмотрено.",
                },
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
        await client.post(
            f"/api/v1/operations/tasks/{task_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
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

        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        detail = await client.get(f"/api/v1/marketplace/tasks/{task_id}")
        terms_version = detail.json()["terms"]["version"]
        consented = await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": terms_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert consented.status_code == 200

        first = await client.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert first.status_code == 200
        application_id = first.json()["id"]
        assert first.json()["status"] == "applied"

        consent_replay = await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": terms_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert consent_replay.status_code == 200
        async with database.sessions() as session:
            status_after_consent = await session.scalar(
                select(applications.c.status).where(applications.c.id == UUID(application_id))
            )
        assert status_after_consent == "applied"

        retry = await client.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert retry.status_code == 200
        assert retry.json()["id"] == application_id
        assert retry.json()["status"] == "applied"

    person_id = demo_id("participant-alex")
    async with database.sessions() as session:
        stored_rows = (
            await session.execute(
                select(applications).where(
                    applications.c.person_id == person_id,
                    applications.c.task_id == task_id,
                )
            )
        ).all()
        assert len(stored_rows) == 1
        assert stored_rows[0].id == UUID(application_id)
        event_count = (
            await session.execute(
                select(func.count())
                .select_from(domain_events)
                .where(domain_events.c.event_key == f"application:{application_id}:applied:v1")
            )
        ).scalar_one()
        assert event_count == 1
    await database.close()
