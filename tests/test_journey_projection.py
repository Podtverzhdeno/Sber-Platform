"""Cross-section projection tests: facts are linked, not artificially awarded."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.api.v1.journey import _merge_courses
from impulse.application.development import EnrollmentRecord
from impulse.application.identity import demo_personas
from impulse.bootcamp.editorial_learning import ImpulseCourseSummary, ImpulseStudySummary
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import Role


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
