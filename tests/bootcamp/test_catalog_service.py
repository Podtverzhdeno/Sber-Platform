"""BootcampCatalogService composes real stores into the card projection (22.15)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.competencies import FrameworkReport, SkillReport
from impulse.application.development import (
    DevelopmentService,
    EnrollmentRecord,
    MemoryDevelopmentStore,
)
from impulse.bootcamp.service import BootcampCatalogService
from impulse.domain.competencies import CompetencySkill
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ActorContext, ConsentScope, Role


class StubCompetencyReports:
    """Narrow stub matching the CompetencyReportsStore protocol."""

    def __init__(self, reports: tuple[FrameworkReport, ...]) -> None:
        self._reports = reports

    async def person_reports(self, person_id: UUID) -> tuple[FrameworkReport, ...]:
        return self._reports


def _actor(role: Role = Role.PARTICIPANT, person_id: UUID | None = None) -> ActorContext:
    pid = person_id or uuid4()
    return ActorContext(
        person_id=pid,
        display_name="Алексей Рогожин",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="bootcamp-demo",
        consent_scopes=frozenset({ConsentScope.COURSE_HONOR_BOARD}),
    )


def _skip_report(*, known: bool) -> FrameworkReport:
    skill = CompetencySkill(key="python", title="Python-разработчик")
    level = "базовый" if known else "не подтверждено"
    return FrameworkReport(
        framework_key="role:python-engineer",
        domain="role",
        version=1,
        title="Python-разработчик",
        skills=(SkillReport(skill=skill, level=level, anchors=(), excluded=()),),
        created_at=datetime.now(UTC),
    )


def _store(
    person_id: UUID, enrollments: tuple[EnrollmentRecord, ...] = ()
) -> MemoryDevelopmentStore:
    store = MemoryDevelopmentStore()
    store.enroll_as(person_id)
    store.install_enrollments(enrollments)
    return store


async def test_service_catalog_builds_explainable_cards_for_participant() -> None:
    person = uuid4()
    store = _store(person, (EnrollmentRecord("python-base", CompletionStatus.REPORTED),))
    service = BootcampCatalogService(store, StubCompetencyReports((_skip_report(known=True),)))

    cards = {card.key: card for card in await service.catalog(_actor(person_id=person))}

    pending = cards["python-base"]
    assert pending.completion_state == "reported"
    assert pending.pending_verification_note is not None
    assert pending.must_take is not None
    assert pending.must_take.current_level == "базовый"
    assert pending.access_state == "unavailable"

    standalone = cards["openspec-sdd"]
    assert standalone.completion_state == "not_started"
    assert standalone.relevant is False
    assert standalone.must_take is None


async def test_service_must_take_respects_verified_completion() -> None:
    person = uuid4()
    store = _store(person, (EnrollmentRecord("python-base", CompletionStatus.VERIFIED),))
    service = BootcampCatalogService(store, StubCompetencyReports(()))

    cards = {card.key: card for card in await service.catalog(_actor(person_id=person))}

    verified = cards["python-base"]
    assert verified.completion_state == "verified"
    assert verified.verified_evidence == "course:python-base"
    assert verified.must_take is None


async def test_service_reports_unknown_skill_levels_without_fabricating_them() -> None:
    person = uuid4()
    store = _store(person)
    service = BootcampCatalogService(store, StubCompetencyReports((_skip_report(known=False),)))

    cards = {card.key: card for card in await service.catalog(_actor(person_id=person))}

    relevant = next(card for card in cards.values() if card.relevant)
    assert relevant.must_take is not None
    assert relevant.must_take.current_known is False
    assert relevant.must_take.current_level is None


async def test_service_access_is_restricted_to_participants() -> None:
    store = _store(uuid4())
    service = BootcampCatalogService(store, StubCompetencyReports(()))

    for role in (Role.MENTOR, Role.MANAGER, Role.CUSTOMER, Role.HR, Role.OPERATOR):
        with pytest.raises(ApiError) as guard:
            await service.catalog(_actor(role, person_id=uuid4()))
        assert guard.value.status_code == 403
        assert guard.value.code == "FORBIDDEN"


def test_service_is_wired_from_existing_application_services() -> None:
    """The service only needs store-level reads, mirroring the API dependency."""
    store = MemoryDevelopmentStore()
    development = DevelopmentService(store)
    service = BootcampCatalogService(development.store)

    assert service.competencies is None
