"""Cross-section projection tests: facts are linked, not artificially awarded."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text

from impulse.api.errors import install_error_handlers
from impulse.api.v1 import journey
from impulse.api.v1.identity import csrf_session, current_session
from impulse.api.v1.journey import _merge_courses
from impulse.application.development import EnrollmentRecord
from impulse.application.identity import AuthenticatedSession, SessionRecord, demo_personas
from impulse.bootcamp import editorial_learning
from impulse.bootcamp.editorial_learning import ImpulseCourseSummary, ImpulseStudySummary
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ActorContext, Role
from impulse.infrastructure.database import Database


def _study(*, finished: bool) -> ImpulseStudySummary:
    now = datetime.now(UTC)
    certificate_id = uuid4() if finished else None
    return ImpulseStudySummary(
        started_courses=1,
        finished_courses=int(finished),
        completed_lessons=8 if finished else 3,
        approved_practices=0,
        courses=[
            ImpulseCourseSummary(
                course_key="demo-course-1",
                title="Учебный курс",
                completed_units=8 if finished else 3,
                total_units=8,
                finished=finished,
                finished_at=now if finished else None,
                certificate_id=certificate_id,
                updated_at=now,
                practice_status="pending" if finished else None,
                practical_certificate_id=None,
            )
        ],
    )


def _role_roadmap(*, completed: bool) -> SimpleNamespace:
    return SimpleNamespace(
        track_key="python",
        policy_version=7,
        milestones=(
            SimpleNamespace(
                key="foundation",
                target_kind="course",
                target_key="demo-course-1",
            ),
            SimpleNamespace(
                key="hands-on",
                target_kind="task",
                target_key="test-task",
            ),
        ),
        completed_keys=frozenset({"foundation"}) if completed else frozenset(),
    )


def test_self_study_finish_does_not_claim_verified_course_or_milestone() -> None:
    courses = _merge_courses(
        catalog=(SimpleNamespace(key="demo-course-1", title="Учебный курс"),),
        enrollments=(EnrollmentRecord("demo-course-1", CompletionStatus.REPORTED),),
        roadmaps=(_role_roadmap(completed=False),),
        study=_study(finished=True),
    )
    assert len(courses) == 1
    course = courses[0]
    assert course.course_key == "demo-course-1"
    assert course.self_study is not None and course.self_study.finished
    assert course.self_study.practice_status == "pending"
    assert course.provider_status is CompletionStatus.REPORTED
    assert not course.provider_verified
    assert course.roadmap_links[0].milestone_completed is False
    assert course.roadmap_links[0].policy_version == 7


def test_verified_provider_and_roadmap_are_separate_authoritative_evidence() -> None:
    courses = _merge_courses(
        catalog=(SimpleNamespace(key="demo-course-1", title="Учебный курс"),),
        enrollments=(EnrollmentRecord("demo-course-1", CompletionStatus.VERIFIED),),
        roadmaps=(_role_roadmap(completed=True),),
        study=_study(finished=False),
    )
    course = courses[0]
    assert course.provider_verified
    assert course.roadmap_links[0].milestone_completed
    assert course.self_study is not None and not course.self_study.finished


def test_missing_self_study_database_does_not_fake_zero_lessons() -> None:
    courses = _merge_courses(
        catalog=(SimpleNamespace(key="demo-course-1", title="Учебный курс"),),
        enrollments=(),
        roadmaps=(_role_roadmap(completed=False),),
        study=None,
    )
    assert courses[0].self_study is None


def test_course_join_is_by_exact_canonical_key_not_similar_title() -> None:
    courses = _merge_courses(
        catalog=(
            SimpleNamespace(key="demo-course-1", title="Повторяющееся название"),
            SimpleNamespace(key="demo-course-2", title="Повторяющееся название"),
        ),
        enrollments=(EnrollmentRecord("demo-course-2", CompletionStatus.VERIFIED),),
        roadmaps=(_role_roadmap(completed=True),),
        study=_study(finished=True),
    )
    first, second = courses
    assert first.course_key == "demo-course-1"
    assert first.self_study is not None and first.self_study.finished
    assert not first.provider_verified
    assert first.roadmap_links[0].milestone_completed
    assert second.course_key == "demo-course-2"
    assert second.provider_verified
    assert second.self_study is None
    assert second.roadmap_links == []


def test_snapshot_is_self_scoped_and_denies_other_roles() -> None:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,  # Pure in-memory route test, independent of CI PostgreSQL env.
        session_secret=SecretStr("journey-test-secret-long-enough"),
    )
    with TestClient(create_app(settings)) as api:
        participant = next(person for person in demo_personas() if Role.PARTICIPANT in person.roles)
        other = next(
            person
            for person in demo_personas()
            if Role.CUSTOMER in person.roles and Role.PARTICIPANT not in person.roles
        )
        assert (
            api.post("/api/v1/auth/demo-login", json={"persona_key": participant.key}).status_code
            == 200
        )
        snapshot_response = api.get("/api/v1/me/journey/snapshot")
        assert snapshot_response.status_code == 200, snapshot_response.text
        snapshot = snapshot_response.json()
        assert snapshot["person_id"] == str(participant.person_id)
        assert snapshot["self_study_available"] is False
        assert isinstance(snapshot["projects"], list)
        assert isinstance(snapshot["courses"], list)
        assert "grade_awarded" not in snapshot
        assert (
            api.post("/api/v1/auth/demo-login", json={"persona_key": other.key}).status_code == 200
        )
        forbidden = api.get("/api/v1/me/journey/snapshot")
        assert forbidden.status_code == 404
        assert str(participant.person_id) not in forbidden.text


@pytest.mark.spec("cross-section-progress/persisted-study-joined-snapshot")
def test_postgres_course_finish_reflects_in_joined_snapshot_without_fake_awards(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Requires isolated PostgreSQL database and migrated schema")
    database = Database(url)
    learner = uuid4()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        async with database.session() as connection:
            await connection.execute(
                text(
                    "INSERT INTO persons(id, display_name, external_key) VALUES (:id, :name, :key)"
                ),
                {"id": learner, "name": "Journey QA", "key": str(learner)},
            )
        yield
        await database.close()

    async def allow_course(*_args: object) -> None:
        return None

    monkeypatch.setattr(editorial_learning, "assert_course_access", allow_course)

    async def courses() -> tuple[SimpleNamespace, ...]:
        return (SimpleNamespace(key="demo-course-1", title="Impulse: испытание"),)

    async def enrollments(_person: object) -> tuple[EnrollmentRecord, ...]:
        return (EnrollmentRecord("demo-course-1", CompletionStatus.REPORTED),)

    async def roadmaps(_actor: object) -> tuple[SimpleNamespace, ...]:
        return (_role_roadmap(completed=False),)

    async def empty(_actor: object) -> tuple[object, ...]:
        return ()

    async def seasons() -> tuple[object, ...]:
        return ()

    active_role = [Role.PARTICIPANT]

    def credentials() -> AuthenticatedSession:
        role = active_role[0]
        return AuthenticatedSession(
            actor=ActorContext(
                person_id=learner,
                display_name="Journey QA",
                active_role=role,
                assigned_roles=(role,),
                scopes=frozenset(),
                program_key="test",
                consent_scopes=frozenset(),
            ),
            session=SessionRecord(
                session_id=uuid4(),
                person_id=learner,
                token_digest="journey-sql-test",
                csrf_digest="journey-sql-csrf",
                active_role=role,
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            ),
        )

    api = FastAPI(lifespan=lifespan)
    install_error_handlers(api)
    api.include_router(editorial_learning.router, prefix="/api/v1")
    api.include_router(journey.router, prefix="/api/v1")
    api.state.database = database
    api.state.development_service = SimpleNamespace(
        store=SimpleNamespace(courses=courses, enrollments=enrollments),
        catalog_roadmaps=roadmaps,
    )
    api.state.work_service = SimpleNamespace(
        participant_work=empty,
        participant_case_evidence=empty,
    )
    api.state.recognition_service = SimpleNamespace(
        public_seasons=seasons,
    )
    api.dependency_overrides[current_session] = credentials
    api.dependency_overrides[csrf_session] = credentials

    study_path = "/api/v1/me/bootcamp/impulse-study/demo-course-1"
    snapshot_path = "/api/v1/me/journey/snapshot"
    with TestClient(api) as client:
        before = client.get(snapshot_path)
        assert before.status_code == 200, before.text
        before_course = before.json()["courses"][0]
        assert before_course["self_study"] is None
        assert before_course["provider_status"] == "reported"
        assert not before_course["provider_verified"]
        assert before_course["roadmap_links"][0]["milestone_completed"] is False

        for lesson in range(8):
            response = client.post(f"{study_path}/lessons/{lesson}/complete")
            assert response.status_code == 200, response.text
        finish = client.post(f"{study_path}/finish")
        assert finish.status_code == 200, finish.text
        certificate_id = finish.json()["certificate_id"]
        assert certificate_id
        assert client.post(f"{study_path}/finish").json()["certificate_id"] == certificate_id

        after = client.get(snapshot_path)
        assert after.status_code == 200, after.text
        result = after.json()
        course = result["courses"][0]
        assert course["self_study"]["finished"] is True
        assert course["self_study"]["completed_units"] == 8
        assert course["self_study"]["certificate_id"] == certificate_id
        assert course["provider_status"] == "reported"
        assert course["provider_verified"] is False
        assert course["roadmap_links"][0]["milestone_completed"] is False
        assert result["accepted_case_count"] == 0
        assert result["ratings"] == []
        assert result["verified_provider_course_count"] == 0

        active_role[0] = Role.CUSTOMER
        denied = client.get(snapshot_path)
        assert denied.status_code == 404
        assert str(learner) not in denied.text
