"""End-to-end Impulse lesson persistence, award separation, and review authorization."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import text

from impulse.api.errors import ApiError, install_error_handlers
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession, SessionRecord
from impulse.bootcamp import editorial_learning, impulse_levels
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.identity import ActorContext, Role
from impulse.infrastructure.database import Database

API = "/api/v1/me/bootcamp/impulse-study/demo-course-1"


def actor(person_id: UUID, role: Role) -> ActorContext:
    scopes: frozenset[str] = (
        frozenset({"verification:write"}) if role is Role.OPERATOR else frozenset()
    )
    return ActorContext(
        person_id=person_id,
        display_name="Test learner",
        active_role=role,
        assigned_roles=(role,),
        scopes=scopes,
        program_key="test",
        consent_scopes=frozenset(),
    )


def session(person_id: UUID, role: Role) -> AuthenticatedSession:
    return AuthenticatedSession(
        actor=actor(person_id, role),
        session=SessionRecord(
            session_id=uuid4(),
            person_id=person_id,
            token_digest="test-digest",
            csrf_digest="test-csrf-digest",
            active_role=role,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )


@pytest.mark.spec("bootcamp/impulse-study-persistence")
def test_study_progress_requires_order_and_practice_requires_review(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("PostgreSQL integration test requires TEST_DATABASE_URL")
    database = Database(url)
    learner, operator = uuid4(), uuid4()

    async def create_people() -> None:
        async with database.session() as db:
            for person, label in ((learner, "learner"), (operator, "reviewer")):
                await db.execute(
                    text(
                        "INSERT INTO persons(id, display_name, external_key) "
                        "VALUES (:id, :name, :key)"
                    ),
                    {"id": person, "name": label, "key": str(person)},
                )

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        # Keep all asyncpg connections in TestClient's single event loop.
        await create_people()
        yield
        await database.close()

    async def accessible(*_args: object) -> None:
        return None

    monkeypatch.setattr(editorial_learning, "assert_course_access", accessible)
    app = FastAPI(lifespan=lifespan)
    install_error_handlers(app)
    app.include_router(editorial_learning.router, prefix="/api/v1")
    app.include_router(impulse_levels.router, prefix="/api/v1")
    app.state.database = database

    @app.get("/test/qualified")
    async def qualification_evidence() -> list[dict[str, str]]:
        async with database.sessions() as db:
            rows = (
                (
                    await db.execute(
                        text(
                            "SELECT source_ref, local_date FROM qualification_events "
                            "WHERE person_id = :person AND source = 'course_learning' "
                            "ORDER BY source_ref"
                        ),
                        {"person": learner},
                    )
                )
                .mappings()
                .all()
            )
        return [
            {"source_ref": str(row["source_ref"]), "local_date": row["local_date"].isoformat()}
            for row in rows
        ]

    async def course_catalog() -> tuple[SimpleNamespace, ...]:
        return (
            SimpleNamespace(key="demo-course-1", title="Практикум Impulse", track_keys=("python",)),
        )

    async def attempts(_person: UUID) -> tuple[TrackAttempt, ...]:
        return (TrackAttempt("python", 1, TrackStatus.ACTIVE),)

    app.state.development_service = SimpleNamespace(
        store=SimpleNamespace(courses=course_catalog, attempts=attempts)
    )
    active_role = [Role.PARTICIPANT]

    def credentials() -> AuthenticatedSession:
        if active_role[0] is Role.OPERATOR:
            return session(operator, Role.OPERATOR)
        return session(learner, Role.PARTICIPANT)

    app.dependency_overrides[current_session] = credentials
    app.dependency_overrides[csrf_session] = credentials

    with TestClient(app) as client:
        level_url = "/api/v1/me/bootcamp/impulse-level?track=python"
        advance_url = "/api/v1/me/bootcamp/impulse-level/advance?track=python"
        initial_level = client.get(level_url)
        assert initial_level.status_code == 200, initial_level.text
        assert (
            initial_level.json()["level"],
            initial_level.json()["required_courses"],
        ) == (0, 1)
        assert not initial_level.json()["advance_ready"]
        assert client.get(API).json()["completed_units"] == 0
        assert client.get("/test/qualified").json() == []
        initial = client.get("/api/v1/me/bootcamp/impulse-study/summary")
        assert initial.status_code == 200
        assert initial.json()["started_courses"] == 0
        out_of_order = client.post(API + "/lessons/3/complete")
        assert out_of_order.status_code == 409
        assert client.post(API + "/finish").status_code == 409
        assert client.post(API + "/practice", json={"description": "A" * 80}).status_code == 409
        assert client.get("/test/qualified").json() == []

        for lesson in range(8):
            response = client.post(API + f"/lessons/{lesson}/complete")
            assert response.status_code == 200, response.text
            assert response.json()["completed_units"] == lesson + 1
        assert client.post(API + "/lessons/0/complete").json()["completed_units"] == 8
        lesson_events = client.get("/test/qualified").json()
        assert len(lesson_events) == 8
        assert {event["source_ref"] for event in lesson_events} == {
            f"impulse-study:demo-course-1:lesson:{index}" for index in range(8)
        }
        # All lessons today count as one qualified day, not eight streak days.
        assert len({event["local_date"] for event in lesson_events}) == 1
        lessons_summary = client.get("/api/v1/me/bootcamp/impulse-study/summary").json()
        assert lessons_summary["started_courses"] == 1
        assert lessons_summary["completed_lessons"] == 8
        assert lessons_summary["finished_courses"] == 0
        assert lessons_summary["courses"][0]["title"] == "Практикум Impulse"
        completed = client.post(API + "/finish")
        assert completed.status_code == 200, completed.text
        first = completed.json()["certificate_id"]
        assert first is not None
        assert client.post(API + "/finish").json()["certificate_id"] == first
        events_after_finish = client.get("/test/qualified").json()
        assert len(events_after_finish) == 9
        assert {event["source_ref"] for event in events_after_finish} - {
            event["source_ref"] for event in lesson_events
        } == {"impulse-study:demo-course-1:finish"}
        assert len({event["local_date"] for event in events_after_finish}) == 1
        assert client.get(API).json()["finished"] is True
        finished_summary = client.get("/api/v1/me/bootcamp/impulse-study/summary").json()
        assert finished_summary["finished_courses"] == 1
        assert finished_summary["approved_practices"] == 0
        assert finished_summary["courses"][0]["finished"] is True
        courses_only = client.get(level_url).json()
        assert (
            courses_only["completed_courses"],
            courses_only["credited_practices"],
        ) == (1, 0)
        assert not courses_only["advance_ready"]
        assert client.post(advance_url).status_code == 409

        invalid = client.post(API + "/practice", json={"description": "small"})
        assert invalid.status_code == 422
        submitted = client.post(
            API + "/practice",
            json={
                "description": "S" * 80,
                "artifact_url": "https://example.com/review",
                "practice_task_key": "lesson:4",
            },
        )
        assert submitted.status_code == 200
        assert submitted.json()["practice_status"] == "pending"
        assert submitted.json()["practice_task_key"] == "lesson:4"
        assert submitted.json()["practical_certificate_id"] is None
        credited = client.get("/api/v1/me/bootcamp/impulse-study/summary").json()
        assert credited["credited_practices"] == 1
        assert credited["approved_practices"] == 0
        assert credited["courses"][0]["practice_submitted_at"] is not None
        assert credited["courses"][0]["practice_task_key"] == "lesson:4"
        # Immediate learning credit without the organizer approving a certificate.
        ready = client.get(level_url).json()
        assert ready["completed_courses"] == ready["required_courses"] == 1
        assert ready["approved_practices"] == 0
        assert ready["credited_practices"] == 1
        assert ready["advance_ready"] is True
        advanced = client.post(advance_url)
        assert advanced.status_code == 200, advanced.text
        assert advanced.json()["level"] == 1
        assert advanced.json()["completed_courses"] == 0
        assert advanced.json()["advance_ready"] is False
        assert len(advanced.json()["history"]) == 1
        assert advanced.json()["history"][0]["credited_practices"] == 1
        assert advanced.json()["history"][0]["approved_practices"] == 0
        assert client.get(level_url).json()["level"] == 1
        # A repeated submission is still one credited practice, with no fake certificate.
        duplicate = client.post(
            API + "/practice", json={"description": "T" * 80, "practice_task_key": "lesson:2"}
        )
        assert duplicate.status_code == 200
        assert duplicate.json()["practical_certificate_id"] is None
        assert duplicate.json()["practice_task_key"] == "lesson:2"
        assert (
            client.get("/api/v1/me/bootcamp/impulse-study/summary").json()["credited_practices"]
            == 1
        )
        invalid_task = client.post(
            API + "/practice",
            json={
                "description": "Invalid practice task number" * 3,
                "practice_task_key": "lesson:8",
            },
        )
        assert invalid_task.status_code == 422
        assert client.get(API).json()["practice_task_key"] == "lesson:2"
        path = f"/api/v1/bootcamp/impulse-study/demo-course-1/practice/{learner}/review"
        assert client.post(path, json={"decision": "approved"}).status_code == 403

        active_role[0] = Role.OPERATOR
        approved = client.post(path, json={"decision": "approved"})
        assert approved.status_code == 200, approved.text
        assert approved.json()["practice_status"] == "approved"
        practical = approved.json()["practical_certificate_id"]
        assert practical is not None and practical != first
        assert client.get("/api/v1/me/bootcamp/impulse-study/summary").status_code == 403
        assert (
            client.post(path, json={"decision": "approved"}).json()["practical_certificate_id"]
            == practical
        )

        active_role[0] = Role.PARTICIPANT
        read = client.get(API)
        assert read.status_code == 200
        assert read.json()["certificate_id"] == first
        assert read.json()["practical_certificate_id"] == practical
        final_summary = client.get("/api/v1/me/bootcamp/impulse-study/summary").json()
        assert final_summary["started_courses"] == 1
        assert final_summary["finished_courses"] == 1
        assert final_summary["completed_lessons"] == 8
        assert final_summary["approved_practices"] == 1
        assert final_summary["credited_practices"] == 1
        assert final_summary["courses"][0]["practical_certificate_id"] == str(practical)


@pytest.mark.spec("bootcamp/impulse-access-check")
def test_study_cannot_advance_locked_course(monkeypatch: pytest.MonkeyPatch) -> None:
    person = uuid4()

    async def catalog(*_args: object) -> list[object]:
        return [SimpleNamespace(key="demo-course-10", access_state="prerequisite_not_met")]

    monkeypatch.setattr(editorial_learning.BootcampCatalogService, "catalog", catalog)
    app = FastAPI()
    app.state.development_service = SimpleNamespace(store=object())
    app.state.competency_service = None
    request = Request({"type": "http", "app": app})
    with pytest.raises(ApiError) as exception:
        asyncio.run(
            editorial_learning.assert_course_access(
                request,
                session(person, Role.PARTICIPANT),
                "demo-course-10",
            )
        )
    assert exception.value.status_code == 409


@pytest.mark.spec("career-roadmap/optional-course-access-archive")
def test_archived_optional_track_cannot_advance_by_direct_course_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from impulse.domain.development import TrackStatus

    learner = uuid4()

    async def catalog(*_args: object) -> list[object]:
        return [SimpleNamespace(key="demo-course-13-product", access_state="available")]

    async def attempts(_person: UUID) -> tuple[object, ...]:
        return (SimpleNamespace(track_key="product", status=TrackStatus.ARCHIVED),)

    monkeypatch.setattr(editorial_learning.BootcampCatalogService, "catalog", catalog)
    app = FastAPI()
    app.state.development_service = SimpleNamespace(store=SimpleNamespace(attempts=attempts))
    app.state.competency_service = None
    request = Request({"type": "http", "app": app})
    with pytest.raises(ApiError) as error:
        asyncio.run(
            editorial_learning.assert_course_access(
                request, session(learner, Role.PARTICIPANT), "demo-course-13-product"
            )
        )
    assert error.value.code == "ROLE_NOT_SELECTED"
    assert error.value.status_code == 409
