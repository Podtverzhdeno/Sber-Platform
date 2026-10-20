"""PostgreSQL deadline discussion: proposal does not move the deadline, approval does."""

from __future__ import annotations

import os
from uuid import UUID

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
from impulse.infrastructure.models.work import deadline_requests, task_terms_versions
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_deadline_request_leaves_terms_until_approval() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("deadline-integration-secret-long-enough"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work_store = SqlWorkStore(database)
    app = create_app(settings, auth_service=auth, work_service=WorkService(work_store))
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
                "task_key": "deadline-rd",
                "title": "PostgreSQL deadline discussion",
                "problem": "Проверить обсуждение срока.",
                "deliverable": "Работающий срез.",
                "acceptance_criteria": ["Запрос не меняет срок без одобрения"],
                "deadline_at": "2026-11-01T18:00:00Z",
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
            f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "operator-pavel"}
        )
        operator_csrf = operator_login.json()["csrf_token"]
        await client.post(
            f"/api/v1/operations/tasks/{task_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
        )
        await client.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        await client.post(
            f"/api/v1/operations/tasks/{task_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )

        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        detail = await client.get(f"/api/v1/marketplace/tasks/{task_id}")
        terms_version = int(detail.json()["terms"]["version"])
        await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": terms_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        applied = await client.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert applied.status_code == 200

        customer_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "customer-roman"}
        )
        customer_csrf = customer_login.json()["csrf_token"]
        applications = (
            await client.get(
                f"/api/v1/customer/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": customer_csrf},
            )
        ).json()
        application = next(item for item in applications if item["status"] == "applied")
        accepted = await client.post(
            f"/api/v1/customer/applications/{application['id']}/accept",
            json={"expected_version": application["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert accepted.status_code == 200
        assignment_id = accepted.json()["id"]

        customer_detail = (
            await client.get(
                f"/api/v1/customer/tasks/{task_id}", headers={"X-CSRF-Token": customer_csrf}
            )
        ).json()
        before_version = customer_detail["terms"]["version"]

        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        proposed = await client.post(
            f"/api/v1/me/assignments/{assignment_id}/deadline-requests",
            json={
                "proposed_deadline_at": "2026-11-08T18:00:00Z",
                "reason": "Интеграция требует дополнительной недели.",
                "impact": "Демо сдвигается.",
                "base_terms_version": terms_version,
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert proposed.status_code == 201
        request_id = UUID(proposed.json()["id"])

        async with database.sessions() as session:
            terms_rows = (
                await session.execute(
                    select(task_terms_versions).where(task_terms_versions.c.task_id == task_id)
                )
            ).all()
            stored = (
                await session.execute(
                    select(deadline_requests).where(deadline_requests.c.id == request_id)
                )
            ).one()
            assert stored.status == "pending"
            assert [row.terms_version for row in terms_rows] == [before_version]
            assert terms_rows[0].deadline_at.strftime("%Y-%m-%d") == "2026-11-01"

        approved = await client.post(
            f"/api/v1/customer/deadline-requests/{request_id}/decision",
            json={"approve": True, "comment": "Согласовано."},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        async with database.sessions() as session:
            terms_rows = (
                await session.execute(
                    select(task_terms_versions)
                    .where(task_terms_versions.c.task_id == task_id)
                    .order_by(task_terms_versions.c.terms_version)
                )
            ).all()
            assert [row.terms_version for row in terms_rows] == [
                before_version,
                before_version + 1,
            ]
            assert terms_rows[-1].deadline_at.strftime("%Y-%m-%d") == "2026-11-08"
            stored = (
                await session.execute(
                    select(deadline_requests).where(deadline_requests.c.id == request_id)
                )
            ).one()
            assert stored.status == "approved"
            assert stored.decision_comment == "Согласовано."
            assert stored.decided_at is not None

        final_terms = (
            await client.get(
                f"/api/v1/customer/tasks/{task_id}", headers={"X-CSRF-Token": customer_csrf}
            )
        ).json()["terms"]
        assert final_terms["version"] == before_version + 1
        assert final_terms["deadline_at"] == "2026-11-08T18:00:00Z"
