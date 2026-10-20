"""HTTP contract GET /api/v1/me/bootcamp/catalog (openspec 22.15)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from impulse.api.errors import ApiError, install_error_handlers
from impulse.api.v1.identity import current_session
from impulse.application.competencies import FrameworkReport, SkillReport
from impulse.application.development import (
    DevelopmentService,
    EnrollmentRecord,
    MemoryDevelopmentStore,
)
from impulse.application.identity import AuthenticatedSession, SessionRecord
from impulse.bootcamp.api import router as bootcamp_catalog_router
from impulse.bootcamp.service import CompetencyReportsStore
from impulse.domain.competencies import CompetencySkill
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ActorContext, ConsentScope, Role


class FixedReports:
    def __init__(self, reports: tuple[FrameworkReport, ...]) -> None:
        self._reports = reports

    async def person_reports(self, person_id: UUID) -> tuple[FrameworkReport, ...]:
        return self._reports


def _actor(role: Role, person_id: UUID) -> ActorContext:
    return ActorContext(
        person_id=person_id,
        display_name="Алексей Рогожин",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="bootcamp-demo",
        consent_scopes=frozenset({ConsentScope.COURSE_HONOR_BOARD}),
    )


def _session_record(actor: ActorContext) -> SessionRecord:
    return SessionRecord(
        session_id=uuid4(),
        person_id=actor.person_id,
        token_digest="digest",
        csrf_digest="csrf-digest",
        active_role=actor.active_role,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )


def _client(
    store: MemoryDevelopmentStore,
    actor: ActorContext,
    reports: CompetencyReportsStore,
    *,
    auth_error: ApiError | None = None,
) -> TestClient:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(bootcamp_catalog_router, prefix="/api/v1")
    app.state.development_service = DevelopmentService(store)
    app.state.competency_service = reports

    def override() -> AuthenticatedSession:
        if auth_error is not None:
            raise auth_error
        return AuthenticatedSession(actor=actor, session=_session_record(actor))

    app.dependency_overrides[current_session] = override  # type: ignore[assignment]
    client = TestClient(app)
    with client:
        return client


def _skilled_store(person_id: UUID, enrollment: EnrollmentRecord | None) -> MemoryDevelopmentStore:
    store = MemoryDevelopmentStore()
    store.enroll_as(person_id)
    if enrollment is not None:
        store.install_enrollments((enrollment,))
    return store


def test_catalog_contract_reports_independent_states_per_card() -> None:
    person = uuid4()
    store = _skilled_store(person, EnrollmentRecord("python-base", CompletionStatus.REPORTED))
    report = FrameworkReport(
        framework_key="role:python-engineer",
        domain="role",
        version=1,
        title="Python-разработчик",
        skills=(
            SkillReport(
                skill=CompetencySkill(key="python", title="Python-разработчик"),
                level="базовый",
                anchors=(),
                excluded=(),
            ),
        ),
        created_at=datetime.now(UTC),
    )
    client = _client(store, _actor(Role.PARTICIPANT, person), FixedReports((report,)))

    response = client.get("/api/v1/me/bootcamp/catalog")

    assert response.status_code == 200
    cards = {card["key"]: card for card in response.json()}
    pending = cards["python-base"]
    assert pending["completion_state"] == "reported"
    assert pending["access_state"] == "unavailable"
    assert "повторно проходить тот же шаг не нужно" in pending["pending_verification_note"]
    assert pending["must_take"]["current_level"] == "базовый"
    assert "только после подтверждения checkpoint" in pending["must_take"]["projected_impact"]

    prereq = cards["agent-development"]
    assert prereq["access_state"] == "prerequisite_not_met"
    assert "OpenSpec и SDD" in prereq["access_note"]
    assert prereq["verified_evidence"] is None

    standalone = cards["openspec-sdd"]
    assert standalone["completion_state"] == "not_started"
    assert standalone["relevant"] is False
    assert standalone["relevance_reasons"] == []


def test_catalog_contract_forbids_other_roles_with_stable_envelope() -> None:
    client = _client(
        MemoryDevelopmentStore(),
        _actor(Role.MENTOR, uuid4()),
        FixedReports(()),
    )

    response = client.get("/api/v1/me/bootcamp/catalog")

    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "FORBIDDEN"
    assert "request_id" in body
    assert "traceback" not in body


def test_catalog_contract_requires_a_session() -> None:
    client = _client(
        MemoryDevelopmentStore(),
        _actor(Role.PARTICIPANT, uuid4()),
        FixedReports(()),
        auth_error=ApiError(code="AUTH_REQUIRED", message="Нет активной сессии.", status_code=401),
    )

    response = client.get("/api/v1/me/bootcamp/catalog")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"


def test_api_assembly_includes_catalog_route() -> None:
    from impulse.bootstrap.app import create_app

    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/me/bootcamp/catalog")

    assert response.status_code != 404, "catalog route must be assembled on the application"
    assert response.json()["code"] in {"AUTH_REQUIRED", "FORBIDDEN"}
