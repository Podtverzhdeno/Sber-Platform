"""HTTP contract for TC-015 permitted detail and terms reads."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from impulse.api.errors import install_error_handlers
from impulse.api.v1.identity import current_session
from impulse.api.v1.task_catalog import router as task_catalog_router
from impulse.application.identity import AuthenticatedSession, SessionRecord
from impulse.application.task_catalog import (
    ApplicationState,
    CatalogAction,
    CustomerSummary,
    CustomerVerification,
    EligibilityProjection,
    EligibilityStatus,
    MatchProjection,
    MatchReason,
    MatchStatus,
    ProjectionSource,
    StagePlanProjection,
    TaskRecommendationProjection,
)
from impulse.application.task_catalog_page import TaskCatalogPageService
from impulse.application.task_catalog_visibility import TaskVisibilitySnapshot, snapshot
from impulse.application.task_terms_read import (
    TaskDetailReadService,
    TaskTermsSnapshot,
)
from impulse.domain.identity import ActorContext, ConsentScope, Role

UUID_101 = "00000000-0000-0000-0000-000000000065"
UUID_102 = "00000000-0000-0000-0000-000000000066"
UUID_104 = "00000000-0000-0000-0000-000000000068"
_NOW = datetime(2026, 10, 23, 14, 0, tzinfo=UTC)
_DEADLINE = datetime(2026, 11, 20, 18, 0, tzinfo=UTC)


def _actor(role: Role) -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Алексей Рогожин",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="task-catalog-demo",
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


def _projection(label: str) -> TaskRecommendationProjection:
    index = int(label.rsplit("-", 1)[-1])
    return TaskRecommendationProjection(
        task_id=UUID(int=index),
        schema_version=1,
        snapshot_version=f"catalog-snap-{label}",
        brief_version=3,
        terms_version=4,
        title=f"Задача {label}",
        customer=CustomerSummary(
            id=UUID(int=7), display_name="Заказчик Атлас", verification=CustomerVerification.DEMO
        ),
        brief_summary="Краткое описание публичного брифа",
        competency_tags=("python",),
        difficulty="middle",
        duration_minutes=120,
        work_format="remote",
        places_total=2,
        places_available=2,
        deadline_at=_DEADLINE,
        eligibility=EligibilityProjection(status=EligibilityStatus.ELIGIBLE, reason_codes=()),
        match=MatchProjection(
            status=MatchStatus.CALCULATED,
            percent=Decimal("74"),
            coverage=Decimal("0.8"),
            algorithm_version="interim-default-v1",
            source_snapshot_version="evidence-1",
            calculated_at=_NOW,
            reasons=(MatchReason(code="FORMAT_FIT", label="Формат подходит"),),
        ),
        skill_impact=(),
        stage_plan=StagePlanProjection(version=1, stages=()),
        benefits=(),
        application_state=ApplicationState.NONE,
        allowed_actions=frozenset({CatalogAction.APPLY, CatalogAction.OPEN_CONDITIONS}),
        sources=(ProjectionSource(kind="task_brief", ref="demo-task", version="1"),),
        generated_at=_NOW,
    )


def _terms(label: str) -> TaskTermsSnapshot:
    return TaskTermsSnapshot(
        task_id=UUID(int=int(label.rsplit("-", 1)[-1])),
        terms_version=4,
        brief_version=3,
        deliverable="MVP семантического индекса",
        acceptance_criteria=("Воспроизводимый результат", "Подтверждённый личный вклад"),
        prerequisites=("python >= 3.12",),
        selection_criteria=("Публичное резюме",),
        support_model="mentor_weekly",
        ip_terms="Результат доступен заказчику.",
        portfolio_permission="conditional",
        paid=True,
        payout_condition="После приёмки личного вклада.",
        deadline_at=_DEADLINE,
        data_constraints="Синтетические данные.",
    )


def _pairs() -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
    return (
        (_projection("task-101"), _terms("task-101")),
        (_projection("task-102"), _terms("task-102")),
    )


async def _terms_provider(
    _actor: ActorContext,
) -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
    return _pairs()


async def _gate(
    _actor: ActorContext, item: TaskRecommendationProjection
) -> TaskVisibilitySnapshot | None:
    if item.task_id == UUID(int=102):
        return snapshot(published=False)
    return None


async def _projection_provider(_actor: ActorContext) -> Sequence[TaskRecommendationProjection]:
    return [item for item, _terms in _pairs()]


def _client(role: Role) -> TestClient:
    page = TaskCatalogPageService(_projection_provider, admission_gate=_gate)
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(task_catalog_router, prefix="/api/v1")
    app.state.task_catalog_service = page
    app.state.task_catalog_terms_service = TaskDetailReadService(page, _terms_provider)
    actor_context = _actor(role)

    def override() -> AuthenticatedSession:
        return AuthenticatedSession(actor=actor_context, session=_session_record(actor_context))

    app.dependency_overrides[current_session] = override  # type: ignore[assignment]
    return TestClient(app)


def test_detail_endpoint_returns_reused_projection_document() -> None:
    response = _client(Role.PARTICIPANT).get("/api/v1/me/task-recommendations/" + UUID_101)
    assert response.status_code == 200
    payload = response.json()
    assert payload["task_id"] == UUID_101
    assert payload["brief_version"] == 3
    assert payload["terms_version"] == 4
    assert payload["customer"]["display_name"] == "Заказчик Атлас"
    assert payload["match"]["percent"] == "74"
    assert "workspace" not in payload and "assignment" not in payload


def test_detail_hidden_and_unknown_ids_render_identical_safe_404() -> None:
    api = _client(Role.PARTICIPANT)
    first = api.get("/api/v1/me/task-recommendations/" + UUID_102).json()
    second = api.get("/api/v1/me/task-recommendations/" + UUID_104).json()
    assert first == second
    assert first["code"] == "RESOURCE_NOT_FOUND"
    assert "102" not in first["message"]
    assert "Атлас" not in first["message"]


def test_terms_endpoint_loads_current_versions() -> None:
    response = _client(Role.PARTICIPANT).get(
        "/api/v1/me/task-recommendations/" + UUID_101 + "/terms"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["terms_version"] == 4
    assert payload["brief_version"] == 3
    assert payload["acceptance_criteria"] == [
        "Воспроизводимый результат",
        "Подтверждённый личный вклад",
    ]
    assert payload["portfolio_permission"] == "conditional"
    assert payload["paid"] is True
    assert payload["payout_condition"] == "После приёмки личного вклада."
    assert payload["deadline_at"] == "2026-11-20T18:00:00Z"


def test_terms_hidden_task_is_the_same_safe_404() -> None:
    api = _client(Role.PARTICIPANT)
    terms_404 = api.get("/api/v1/me/task-recommendations/" + UUID_102 + "/terms")
    detail_404 = api.get("/api/v1/me/task-recommendations/" + UUID_102).json()
    assert terms_404.status_code == 404
    assert terms_404.json()["code"] == "RESOURCE_NOT_FOUND"
    assert terms_404.json()["message"] == detail_404["message"]


def test_non_participant_role_is_forbidden_on_both_reads() -> None:
    api = _client(Role.MENTOR)
    assert api.get("/api/v1/me/task-recommendations/" + UUID_101).status_code == 403
    assert api.get("/api/v1/me/task-recommendations/" + UUID_101 + "/terms").status_code == 403


def test_missing_terms_service_state_returns_404_surface() -> None:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(task_catalog_router, prefix="/api/v1")
    actor_context = _actor(Role.PARTICIPANT)

    def override() -> AuthenticatedSession:
        return AuthenticatedSession(actor=actor_context, session=_session_record(actor_context))

    app.dependency_overrides[current_session] = override  # type: ignore[assignment]
    response = TestClient(app).get("/api/v1/me/task-recommendations/" + UUID_101 + "/terms")
    assert response.status_code == 404
