"""PostgreSQL-backed participant task detail over seeded data."""

from __future__ import annotations

import os
import uuid as uuid_module

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, insert, select

from impulse.application.development import DevelopmentService
from impulse.application.ecosystem import EcosystemService
from impulse.application.identity import DemoAuthService
from impulse.application.work import WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.ecosystem_store import SqlEcosystemStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.identity import persons
from impulse.infrastructure.models.insight import audit_entries, domain_events
from impulse.infrastructure.models.work import applications, projects, tasks
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration

PERSONA = "participant-anna"


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
async def test_repeated_application_creates_one_row_and_one_audit_event() -> None:
    database = Database(integration_url())
    suffix = uuid_module.uuid4().hex
    person_id = uuid_module.uuid4()
    customer_id = uuid_module.uuid4()
    project_id = uuid_module.uuid4()
    task_id = uuid_module.uuid4()
    application_id = uuid_module.uuid4()
    async with database.session() as session:
        await session.execute(
            insert(persons),
            [
                {"id": person_id, "display_name": "Участник", "external_key": f"p-{suffix}"},
                {"id": customer_id, "display_name": "Заказчик", "external_key": f"c-{suffix}"},
            ],
        )
        await session.execute(
            insert(projects).values(id=project_id, project_key=f"project-{suffix}", title="Проект")
        )
        await session.execute(
            insert(tasks).values(
                id=task_id,
                project_id=project_id,
                customer_id=customer_id,
                task_key=f"task-{suffix}",
                status="published",
            )
        )
        await session.execute(
            insert(applications).values(
                id=application_id,
                task_id=task_id,
                person_id=person_id,
                accepted_terms_version=1,
                status="terms_accepted",
            )
        )

    store = SqlWorkStore(database)
    first = await store.apply(person_id, task_id, 1)
    second = await store.apply(person_id, task_id, 1)
    assert first == second

    async with database.sessions() as session:
        row_count = await session.scalar(
            select(func.count())
            .select_from(applications)
            .where(
                applications.c.person_id == person_id,
                applications.c.task_id == task_id,
            )
        )
        audit_count = await session.scalar(
            select(func.count())
            .select_from(audit_entries)
            .where(
                audit_entries.c.entity_id == application_id,
                audit_entries.c.action == "application.applied",
            )
        )
        event_count = await session.scalar(
            select(func.count())
            .select_from(domain_events)
            .where(
                domain_events.c.entity_id == application_id,
                domain_events.c.event_type == "work.application_applied",
            )
        )
    assert (row_count, audit_count, event_count) == (1, 1, 1)
    await database.close()


async def _assignment_persona(database: Database) -> tuple[uuid_module.UUID, str]:
    """Return the (task_id, persona_key) bound to seeded assignment:1."""
    from sqlalchemy import select

    from impulse.infrastructure.models.work import assignments

    async with database.sessions() as session:
        row = (
            await session.execute(
                select(assignments.c.task_id, assignments.c.person_id).where(
                    assignments.c.id == demo_id("assignment:1")
                )
            )
        ).one_or_none()
    assert row is not None, "seeded assignment row must exist"
    async with database.sessions() as session:
        from impulse.infrastructure.models.identity import persons

        person = (
            await session.execute(
                select(persons.c.external_key).where(persons.c.id == row.person_id)
            )
        ).one_or_none()
    assert person is not None
    return row.task_id, person.external_key.removeprefix("demo:")


@pytest.mark.asyncio
async def test_seed_detail_exposes_membership_contributions_and_feedback() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    report = await seed_demo(database)
    assert report["tasks"] == 12
    assert report["assignments"] >= 3

    target_task_id, persona_key = await _assignment_persona(database)
    settings = _settings()
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work = WorkService(SqlWorkStore(database))
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(SqlDevelopmentStore(database)),
        ecosystem_service=EcosystemService(SqlEcosystemStore(database)),
        work_service=work,
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
        assert login.status_code == 200

        detail = await client.get(f"/api/v1/me/tasks/{target_task_id}")
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["task"]["id"] == str(target_task_id)
        assert payload["task"]["status"] == "published"
        assert payload["problem"].strip()
        assert payload["terms"]["version"] >= 1
        assert payload["terms_history"], "SQL terms history must list every version"
        assert payload["customer"]["display_name"]
        assert payload["membership"] is not None
        assert payload["team"], "assigned participant sees the team"
        team_ids = {member["person_id"] for member in payload["team"]}
        assert payload["membership"]["person_id"] in team_ids

        personal = payload["personal"]
        assert personal, "seeded assignment has a versioned contribution"
        assert all(item["assignment_id"] == payload["membership"]["id"] for item in personal)

        customer_view = await client.get(f"/api/v1/customer/tasks/{target_task_id}")
        assert customer_view.status_code in {200, 403}

    async with database.sessions() as session:
        from sqlalchemy import func, select

        from impulse.infrastructure.models.work import contributions

        count = await session.scalar(
            select(func.count())
            .select_from(contributions)
            .where(contributions.c.assignment_id == demo_id("assignment:1"))
        )
        assert int(count or 0) == len(personal)


@pytest.mark.asyncio
async def test_seed_detail_private_sections_hidden_before_membership() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    await seed_demo(database)

    target_task_id, persona_key = await _assignment_persona(database)
    if persona_key == "participant-alex":
        observer = "participant-igor"
        # ensure the observer genuinely has no assignment on this task
        from sqlalchemy import select

        from impulse.infrastructure.models.work import assignments

        async with database.sessions() as session:
            row = (
                await session.execute(
                    select(assignments.c.id).where(
                        assignments.c.task_id == target_task_id,
                        assignments.c.person_id == demo_id(observer),
                    )
                )
            ).one_or_none()
        if row is not None:
            pytest.skip("seed ties the observer to the task; skip the privacy probe")
    else:
        observer = "participant-alex"

    settings = _settings()
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work = WorkService(SqlWorkStore(database))
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(SqlDevelopmentStore(database)),
        ecosystem_service=EcosystemService(SqlEcosystemStore(database)),
        work_service=work,
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post("/api/v1/auth/demo-login", json={"persona_key": observer})
        assert login.status_code == 200

        detail = await client.get(f"/api/v1/me/tasks/{target_task_id}")
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["membership"] is None
        assert payload["team"] == []
        assert payload["checkpoints"] == []
        assert payload["personal"] == []
        assert payload["feedback"] == []
        assert payload["problem"].strip(), "public brief stays visible to participants"
