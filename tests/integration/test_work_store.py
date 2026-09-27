"""PostgreSQL customer task publication workflow."""

from __future__ import annotations

import asyncio
import os
from uuid import UUID

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from impulse.api.errors import ApiError
from impulse.application.identity import DemoAuthService
from impulse.application.work import (
    CheckpointRecord,
    TeamArtifactRecord,
    WorkService,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.work import (
    applications,
    artifacts,
    assignments,
    contributions,
    task_terms_versions,
    tasks,
)
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

        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        detail = await client.get(f"/api/v1/marketplace/tasks/{task_id}")
        old_version = detail.json()["terms"]["version"]

        customer_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "customer-roman"}
        )
        customer_csrf = customer_login.json()["csrf_token"]
        revised = await client.post(
            f"/api/v1/customer/tasks/{task_id}/terms",
            json={
                "deadline_at": "2026-11-08T18:00:00Z",
                "deliverable": "Обновлённый вертикальный срез.",
                "acceptance_criteria": ["Состояния и миграция проверены"],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        stale = await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": old_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert stale.status_code == 409
        assert stale.json()["code"] == "TERMS_CHANGED"
        accepted = await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": revised.json()["version"]},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert accepted.status_code == 200
        alex_application = await client.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )

        maria_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-maria"}
        )
        maria_csrf = maria_login.json()["csrf_token"]
        await client.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": revised.json()["version"]},
            headers={"X-CSRF-Token": maria_csrf},
        )
        maria_application = await client.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": maria_csrf},
        )

    candidates = [alex_application.json(), maria_application.json()]
    results = await asyncio.gather(
        *(
            work_store.accept_application(UUID(item["id"]), item["version"], places=1)
            for item in candidates
        ),
        return_exceptions=True,
    )
    assignments_created = [item for item in results if not isinstance(item, BaseException)]
    failures = [item for item in results if isinstance(item, ApiError)]
    assert len(assignments_created) == 1
    assert len(failures) == 1
    assert failures[0].code == "TASK_FULL"
    winner = next(
        item for item in candidates if item["id"] == str(assignments_created[0].application_id)
    )
    with pytest.raises(ApiError) as stale:
        await work_store.accept_application(UUID(winner["id"]), winner["version"], places=1)
    assert stale.value.code == "STALE_APPLICATION"
    started = await work_store.start_assignment(assignments_created[0].id)
    assert started.status.value == "in_progress"
    checkpoint = await work_store.add_checkpoint(
        task_id, CheckpointRecord("mvp-review", "Проверка командного MVP")
    )
    assert checkpoint.status == "planned"
    await work_store.add_team_artifact(
        task_id,
        TeamArtifactRecord("team-repository", "https://example.test/team/repository"),
    )
    contribution = await work_store.submit_contribution(
        started.id,
        "Я реализовал API поиска и самостоятельно добавил проверку offline-метрики.",
        (
            TeamArtifactRecord(
                "personal-api-proof", "https://example.test/team/repository/commit/42"
            ),
        ),
    )
    assert contribution.version == 1

    async with database.sessions() as session:
        row = (
            await session.execute(
                select(tasks.c.status, tasks.c.version, tasks.c.payload).where(
                    tasks.c.id == task_id
                )
            )
        ).one()
        terms_count = int(
            await session.scalar(
                select(func.count())
                .select_from(task_terms_versions)
                .where(task_terms_versions.c.task_id == task_id)
            )
            or 0
        )
        accepted_terms = await session.scalar(
            select(applications.c.accepted_terms_version).where(applications.c.task_id == task_id)
        )
        assignment_count = int(
            await session.scalar(
                select(func.count())
                .select_from(assignments)
                .where(assignments.c.task_id == task_id)
            )
            or 0
        )
        contribution_row = (
            await session.execute(
                select(contributions.c.summary, contributions.c.contribution_version).where(
                    contributions.c.assignment_id == started.id
                )
            )
        ).one()
        artifact_count = int(
            await session.scalar(
                select(func.count())
                .select_from(artifacts)
                .where(artifacts.c.contribution_id == contribution.id)
            )
            or 0
        )
    assert row.status == "published"
    assert row.version == 7
    assert row.payload["support"]["mode"] == "buddy"
    assert row.payload["nominated_mentor_id"] is None
    assert terms_count == 3
    assert accepted_terms == 3
    assert assignment_count == 1
    assert contribution_row.contribution_version == 1
    assert contribution_row.summary.startswith("Я реализовал API")
    assert artifact_count == 1
    await database.close()
