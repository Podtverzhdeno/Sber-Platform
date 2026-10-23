"""HTTP contract for TC-016 ETag markers and the pre-apply terms revalidate."""

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
from impulse.application.task_terms_read import TaskDetailReadService, TaskTermsSnapshot
from impulse.domain.identity import ActorContext, ConsentScope, Role

UUID_101 = "00000000-0000-0000-0000-000000000065"
_NOW = datetime(2026, 10, 23, 16, 0, tzinfo=UTC)
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


def _projection() -> TaskRecommendationProjection:
    return TaskRecommendationProjection(
        task_id=UUID(int=101),
        schema_version=1,
        snapshot_version="snap-3",
        brief_version=3,
        terms_version=4,
        title="Задача task-101",
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


def _terms() -> TaskTermsSnapshot:
    return TaskTermsSnapshot(
        task_id=UUID(int=101),
        terms_version=4,
        brief_version=3,
        deliverable="MVP семантического индекса",
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
    return ((_projection(), _terms()),)


async def _projection_provider(_actor: ActorContext) -> Sequence[TaskRecommendationProjection]:
    return [item for item, _terms in _pairs()]


def _client(role: Role, *, shifted_terms: int | None = None) -> TestClient:
    if shifted_terms is not None:
        fresh = _terms()
        drifted = TaskTermsSnapshot(
            task_id=fresh.task_id,
            terms_version=shifted_terms,
            brief_version=fresh.brief_version,
            deliverable=fresh.deliverable,
            prerequisites=fresh.prerequisites,
            selection_criteria=fresh.selection_criteria,
            support_model=fresh.support_model,
            ip_terms=fresh.ip_terms,
            portfolio_permission=fresh.portfolio_permission,
            paid=fresh.paid,
            payout_condition=fresh.payout_condition,
            deadline_at=fresh.deadline_at,
            data_constraints=fresh.data_constraints,
        )
        pairs_provider = [(_projection(), drifted)]
    else:
        pairs_provider = _pairs()

    async def provider(
        _actor: ActorContext,
    ) -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
        return pairs_provider

    page = TaskCatalogPageService(_projection_provider)
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(task_catalog_router, prefix="/api/v1")
    app.state.task_catalog_service = page
    app.state.task_catalog_terms_service = TaskDetailReadService(page, provider)
    actor_context = _actor(role)

    def override() -> AuthenticatedSession:
        return AuthenticatedSession(actor=actor_context, session=_session_record(actor_context))

    app.dependency_overrides[current_session] = override  # type: ignore[assignment]
    return TestClient(app)


def _detail_path() -> str:
    return "/api/v1/me/task-recommendations/" + UUID_101


def _terms_path() -> str:
    return _detail_path() + "/terms"


def test_terms_response_carries_etag_marker() -> None:
    response = _client(Role.PARTICIPANT).get(_terms_path())
    assert response.status_code == 200
    etag = response.headers.get("ETag")
    assert etag is not None and etag.startswith('"tc-') and etag.endswith('"')
    again = _client(Role.PARTICIPANT).get(_terms_path())
    assert again.headers["ETag"] == etag


def test_revalidate_accepts_fresh_token() -> None:
    api = _client(Role.PARTICIPANT)
    etag = api.get(_terms_path()).headers["ETag"]
    response = api.post(
        _terms_path() + "/revalidate", json={"version_token": etag, "terms_version": 4}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["terms_version"] == 4
    assert response.headers["ETag"] == etag


def test_revalidate_stale_token_is_terms_changed_409() -> None:
    response = _client(Role.PARTICIPANT).post(
        _terms_path() + "/revalidate", json={"version_token": '"tc-0000000000000000"'}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "TERMS_CHANGED"


def test_revalidate_version_drift_is_terms_changed_409() -> None:
    api = _client(Role.PARTICIPANT)
    etag = api.get(_terms_path()).headers["ETag"]
    drifted_api = _client(Role.PARTICIPANT, shifted_terms=5)
    response = drifted_api.post(_terms_path() + "/revalidate", json={"terms_version": 4})
    assert response.status_code == 409
    assert response.json()["code"] == "TERMS_CHANGED"
    assert response.headers.get("ETag", '"tc-newer"') != etag


def test_revalidate_hidden_task_is_safe_404() -> None:
    response = _client(Role.PARTICIPANT).post(
        "/api/v1/me/task-recommendations/00000000-0000-0000-0000-000000000068/terms/revalidate"
    )
    assert response.status_code == 404


def test_revalidate_without_body_and_role_guard() -> None:
    api = _client(Role.PARTICIPANT)
    response = api.post(_terms_path() + "/revalidate")
    assert response.status_code == 200
    other = _client(Role.MENTOR)
    assert other.post(_terms_path() + "/revalidate").status_code == 403
