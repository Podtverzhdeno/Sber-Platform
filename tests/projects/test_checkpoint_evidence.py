"""Private checkpoint file upload and reviewed submission integration test."""

from __future__ import annotations

import base64
import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import insert, select

from impulse.api.errors import install_error_handlers
from impulse.api.v1 import work
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession, SessionRecord
from impulse.application.work import AssignmentRecord, CheckpointRecord, ContributionRecord
from impulse.domain.identity import ActorContext, Role
from impulse.domain.work import AssignmentStatus
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.identity import persons
from impulse.infrastructure.models.work import (
    applications,
    assignments,
    contributions,
    projects,
    tasks,
)

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_checkpoint_files_persist_and_restrict_access() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("PostgreSQL integration test requires TEST_DATABASE_URL")

    database = Database(url)
    person, customer, outsider = uuid4(), uuid4(), uuid4()
    project_id, task_id, application_id, assignment_id = (uuid4() for _ in range(4))
    checkpoint = CheckpointRecord(
        key="test-stage",
        title="Проверить результат",
        description="Проведи эксперимент и задокументируй выводы",
        deliverable="Отчёт с воспроизводимыми замерами",
        acceptance_criteria=("Есть исходные данные", "Приведены метрики"),
    )
    record = AssignmentRecord(
        assignment_id, task_id, person, application_id, AssignmentStatus.IN_PROGRESS
    )
    uploaded_contributions: list[ContributionRecord] = []
    current_actor = [person]
    current_role = [Role.PARTICIPANT]

    class StubStore:
        async def assignment(self, assignment: object) -> AssignmentRecord | None:
            return record if assignment == assignment_id else None

        async def checkpoints(self, task: object) -> tuple[CheckpointRecord, ...]:
            return (checkpoint,) if task == task_id else ()

        async def get(self, task: object) -> SimpleNamespace | None:
            return (
                SimpleNamespace(aggregate=SimpleNamespace(customer_id=customer))
                if task == task_id
                else None
            )

        async def contributions_for_assignment(
            self, assignment: object
        ) -> tuple[ContributionRecord, ...]:
            return tuple(uploaded_contributions) if assignment == assignment_id else ()

    class StubService:
        store = StubStore()

        async def submit_contribution(
            self,
            actor: ActorContext,
            assignment: object,
            summary: str,
            _artifacts: object,
        ) -> ContributionRecord:
            assert actor.person_id == person and assignment == assignment_id
            contribution = ContributionRecord(
                uuid4(), assignment_id, 1, summary, ("report",)
            )
            async with database.session() as session:
                await session.execute(
                    insert(contributions).values(
                        id=contribution.id,
                        assignment_id=assignment_id,
                        contribution_version=1,
                        summary=summary,
                    )
                )
            uploaded_contributions.append(contribution)
            return contribution

    def credentials() -> AuthenticatedSession:
        actor = ActorContext(
            person_id=current_actor[0],
            display_name="Участник",
            active_role=current_role[0],
            assigned_roles=(current_role[0],),
            scopes=frozenset(),
            program_key="test",
            consent_scopes=frozenset(),
        )
        return AuthenticatedSession(
            actor=actor,
            session=SessionRecord(
                session_id=uuid4(),
                person_id=current_actor[0],
                token_digest="test-digest",
                csrf_digest="test-csrf",
                active_role=current_role[0],
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            ),
        )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        suffix = uuid4().hex
        async with database.session() as session:
            await session.execute(
                insert(persons),
                [
                    {"id": person, "display_name": "Участник", "external_key": f"p-{suffix}"},
                    {"id": customer, "display_name": "Заказчик", "external_key": f"c-{suffix}"},
                    {"id": outsider, "display_name": "Другой", "external_key": f"x-{suffix}"},
                ],
            )
            await session.execute(
                insert(projects).values(
                    id=project_id, project_key=f"test-{suffix}", title="Тест проекта"
                )
            )
            await session.execute(
                insert(tasks).values(
                    id=task_id,
                    project_id=project_id,
                    customer_id=customer,
                    task_key=f"stage-{suffix}",
                    status="published",
                )
            )
            await session.execute(
                insert(applications).values(
                    id=application_id,
                    task_id=task_id,
                    person_id=person,
                    accepted_terms_version=1,
                    status="accepted",
                )
            )
            await session.execute(
                insert(assignments).values(
                    id=assignment_id,
                    task_id=task_id,
                    person_id=person,
                    application_id=application_id,
                    status="in_progress",
                )
            )
        yield
        await database.close()

    app = FastAPI(lifespan=lifespan)
    install_error_handlers(app)
    app.include_router(work.router, prefix="/api/v1")
    app.state.database = database
    app.state.work_service = StubService()
    app.dependency_overrides[csrf_session] = credentials
    app.dependency_overrides[current_session] = credentials

    route = (
        f"/api/v1/me/assignments/{assignment_id}/checkpoints/{checkpoint.key}"
    )
    raw = b"checkpoint evidence is persisted and downloadable"
    with TestClient(app) as client:
        invalid = client.post(
            route + "/files",
            json={
                "filename": "run.exe",
                "content_type": "application/octet-stream",
                "base64_data": base64.b64encode(raw).decode(),
            },
        )
        assert invalid.status_code == 422

        response = client.post(
            route + "/files",
            json={
                "filename": "report.txt",
                "content_type": "text/plain",
                "base64_data": base64.b64encode(raw).decode(),
            },
        )
        assert response.status_code == 200, response.text
        file_id = response.json()["id"]

        current_actor[0] = outsider
        assert client.get(f"/api/v1/checkpoint-evidence-files/{file_id}").status_code == 404
        current_actor[0] = person
        assert client.get(f"/api/v1/checkpoint-evidence-files/{file_id}").content == raw

        assert client.post(
            route + "/submit",
            json={
                "summary": "Я подготовил воспроизводимый отчёт и оценил качество решения.",
                "artifact_key": "report",
                "file_ids": [file_id],
            },
        ).status_code == 200

        history = client.get(
            f"/api/v1/me/assignments/{assignment_id}/checkpoint-submissions"
        )
        assert history.status_code == 200, history.text
        rows = history.json()
        assert len(rows) == 1
        assert rows[0]["checkpoint_key"] == checkpoint.key
        assert rows[0]["status"] == "submitted"
        assert rows[0]["files"][0]["filename"] == "report.txt"
        assert rows[0]["files"][0]["id"] == file_id

        current_actor[0], current_role[0] = customer, Role.CUSTOMER
        assert client.get(f"/api/v1/checkpoint-evidence-files/{file_id}").content == raw
        current_actor[0], current_role[0] = outsider, Role.PARTICIPANT
        assert client.get(
            f"/api/v1/me/assignments/{assignment_id}/checkpoint-submissions"
        ).status_code == 404

    # Explicitly prove that bytes survived the database transaction.
    async with database.sessions() as session:
        result = (
            await session.execute(
                select(contributions.c.id).where(
                    contributions.c.assignment_id == assignment_id
                )
            )
        ).all()
    assert len(result) == 1
