"""Bootcamp course detail projection scenarios (openspec 22.16)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.api.errors import ApiError
from impulse.application.competencies import FrameworkReport, SkillReport
from impulse.application.development import (
    COURSE_CERTIFICATE_REGISTRY,
    CourseMilestoneFact,
    CourseRecord,
    DevelopmentService,
    EnrollmentRecord,
    MemoryDevelopmentStore,
    build_course_detail,
)
from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.competencies import (
    CompetencyEvidence,
    CompetencySkill,
    LevelAnchor,
)
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ActorContext, ConsentScope, Role


def _course() -> CourseRecord:
    return CourseRecord(
        key="python-base",
        title="Python: основа",
        track_keys=("python",),
        source_url="https://example.test/python",
        availability="available",
        access_note="по записи",
    )


def _actor(person_id: UUID | None = None):
    pid = person_id or uuid4()
    return ActorContext(
        person_id=pid,
        display_name="Алексей Рогожин",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="bootcamp-demo",
        consent_scopes=frozenset({ConsentScope.COURSE_HONOR_BOARD}),
    )


def _report(
    title: str,
    level: str,
    anchors: tuple[LevelAnchor, ...] = (),
) -> FrameworkReport:
    skill = CompetencySkill(key="python", title=title)
    return FrameworkReport(
        framework_key="role:python-engineer",
        domain="role",
        version=1,
        title="Python-разработчик",
        skills=(SkillReport(skill=skill, level=level, anchors=anchors, excluded=()),),
        created_at=datetime.now(UTC),
    )


class StubCompetencyReports:
    def __init__(self, reports: tuple[FrameworkReport, ...]) -> None:
        self.reports = reports

    async def person_reports(self, person_id: UUID) -> tuple[FrameworkReport, ...]:
        _ = person_id
        return self.reports


@pytest.mark.spec("bootcamp-course-detail/projection")
async def test_projection_forecasts_program_competency_until_checkpoint() -> None:
    projection = build_course_detail(
        _course(),
        program=COURSE_CERTIFICATE_REGISTRY["python-base"],
        enrollment_status=None,
        milestones=(
            CourseMilestoneFact(
                key="foundation",
                position=1,
                title="Освоить основу",
                purpose="Создать базу для первой практической задачи.",
                skill="Python",
                completed=False,
            ),
        ),
        skill_levels={"Spec-driven development": "уверенный"},
    )

    assert projection.objective == "Создать базу для первой практической задачи."
    assert projection.next_step == "Освоить основу"
    assert projection.artifact == "Итоговое задание курса"
    assert projection.program_competencies == (
        ("Синтаксис и идиомы Python", "базовый", "Итоговое задание курса"),
    )
    assert projection.enrollment_status is None
    assert projection.verified is False

    cycle = projection.cycle
    assert len(cycle) == 1
    point = cycle[0]
    assert point.competency == "Синтаксис и идиомы Python"
    assert point.current_level == "не подтверждено"
    assert point.projected_level == "базовый"
    assert point.target_level == "базовый"
    assert point.projected_confirmed is False
    assert point.evidence == "Итоговое задание курса"


@pytest.mark.spec("bootcamp-course-detail/projection")
async def test_projection_confirms_endorsed_levels() -> None:
    projection = build_course_detail(
        _course(),
        program=COURSE_CERTIFICATE_REGISTRY["python-base"],
        enrollment_status=CompletionStatus.REPORTED,
        milestones=(
            CourseMilestoneFact(
                key="foundation",
                position=1,
                title="Освоить основу",
                purpose="Создать базу для первой практической задачи.",
                skill="Python",
                completed=False,
            ),
        ),
        skill_levels={"Синтаксис и идиомы Python": "базовый"},
        course_endorsed={"Синтаксис и идиомы Python": "базовый"},
    )

    point = projection.cycle[0]
    assert point.current_level == "базовый"
    assert point.projected_level == "базовый"
    assert point.projected_confirmed is True
    assert projection.enrollment_status == "reported"
    assert projection.verified is False


@pytest.mark.spec("bootcamp-course-detail/projection")
async def test_projection_with_verified_enrollment_and_no_program() -> None:
    projection = build_course_detail(
        _course(),
        program=None,
        enrollment_status=CompletionStatus.VERIFIED,
        milestones=(
            CourseMilestoneFact(
                key="foundation",
                position=1,
                title="Освоить основу",
                purpose="Создать базу для первой практической задачи.",
                skill="Python",
                completed=False,
            ),
            CourseMilestoneFact(
                key="practice",
                position=2,
                title="Первое задание",
                purpose="Применить базу.",
                skill="Python",
                completed=True,
            ),
        ),
    )

    assert projection.cycle == ()
    assert projection.artifact is None
    assert projection.specialization is None
    assert projection.verified is True
    assert projection.enrollment_status == "verified"
    assert projection.next_step == "Освоить основу"


async def test_service_collects_endorsed_anchors_and_milestones() -> None:
    person = uuid4()
    store = MemoryDevelopmentStore()
    store.enroll_as(person)
    store.install_enrollments((EnrollmentRecord("python-base", CompletionStatus.VERIFIED),))
    service = DevelopmentService(store)
    anchor = LevelAnchor(
        row=CompetencyEvidence(
            person_id=person,
            competency_key="python",
            source_kind="course",
            source_ref="course:python-base",
            level="базовый",
            observed_at=datetime.now(UTC),
        ),
        reason="Курс подтверждён",
    )
    service.competency_service = StubCompetencyReports(
        (_report("Синтаксис и идиомы Python", "базовый", (anchor,)),)
    )

    detail = await service.course_detail(_actor(person_id=person), "python-base")

    assert detail.verified is True
    assert detail.enrollment_status == "verified"
    assert detail.objective == "Создать базу для первой практической задачи."
    assert detail.next_step == "Освоить основу"
    assert detail.milestone_title == "Освоить основу"
    assert len(detail.cycle) == 1
    confirmed = [item for item in detail.cycle if item.projected_confirmed]
    assert len(confirmed) == 1
    assert confirmed[0].current_level == "базовый"
    assert confirmed[0].projected_level == "базовый"


async def test_service_unknown_course_raises_404() -> None:
    service = DevelopmentService(MemoryDevelopmentStore())
    service.competency_service = StubCompetencyReports(())

    with pytest.raises(ApiError) as error:
        await service.course_detail(_actor(), "not-a-course")

    assert error.value.status_code == 404


def test_course_detail_api_returns_program_structure() -> None:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("development-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryDevelopmentStore()
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(store),
    )
    client = TestClient(app)
    with client:
        login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert login.status_code == 200

        response = client.get("/api/v1/me/courses/python-base/detail")
        assert response.status_code == 200
        payload = response.json()
        assert payload["course_key"] == "python-base"
        assert payload["title"] == "Python: основа"
        assert payload["specialization"] == "Python / Data / ML"
        assert payload["workload_hours"] == 40
        assert payload["program_competencies"] == [
            ["Синтаксис и идиомы Python", "базовый", "Итоговое задание курса"]
        ]
        assert len(payload["cycle"]) == 1

        unknown = client.get("/api/v1/me/courses/not-a-course/detail")
        assert unknown.status_code == 404
        assert unknown.json()["code"] == "RESOURCE_NOT_FOUND"
