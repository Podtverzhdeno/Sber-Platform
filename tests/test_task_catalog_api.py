"""HTTP contract GET /me/task-recommendations (openspec task-catalog-v2 TC-008)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
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
from impulse.domain.identity import ActorContext, ConsentScope, Role

_NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)


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


def _projection(label: str, *, percent: str | None, eligible: bool) -> TaskRecommendationProjection:
    index = int(label.rsplit("-", 1)[-1])
    return TaskRecommendationProjection(
        task_id=UUID(int=index),
        schema_version=1,
        snapshot_version=f"catalog-snap-{label}",
        brief_version=1,
        terms_version=1,
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
        deadline_at=None,
        eligibility=EligibilityProjection(
            status=EligibilityStatus.ELIGIBLE if eligible else EligibilityStatus.INELIGIBLE,
            reason_codes=() if eligible else ("deadline_passed",),
        ),
        match=MatchProjection(
            status=MatchStatus.CALCULATED if percent else MatchStatus.INSUFFICIENT_DATA,
            percent=Decimal(percent) if percent else None,
            coverage=Decimal("0.8"),
            algorithm_version="interim-default-v1" if percent else None,
            source_snapshot_version="evidence-1",
            calculated_at=_NOW,
            reasons=((MatchReason(code="FORMAT_FIT", label="Формат подходит"),) if percent else ()),
        ),
        skill_impact=(),
        stage_plan=StagePlanProjection(version=1, stages=()),
        benefits=(),
        application_state=ApplicationState.NONE,
        allowed_actions=frozenset(
            {CatalogAction.APPLY, CatalogAction.OPEN_CONDITIONS}
            if eligible
            else {CatalogAction.OPEN_CONDITIONS}
        ),
        sources=(ProjectionSource(kind="task_brief", ref="demo-task", version="1"),),
        generated_at=_NOW,
    )


def _catalog_items() -> Sequence[TaskRecommendationProjection]:
    return (
        _projection("task-101", percent="68", eligible=True),
        _projection("task-102", percent="92", eligible=True),
        _projection("task-103", percent="84", eligible=True),
        _projection("task-104", percent=None, eligible=False),
    )


def _client(role: Role, service: TaskCatalogPageService | None = None) -> TestClient:
    async def _provider(_: ActorContext) -> Any:
        return _catalog_items()

    app = FastAPI()
    install_error_handlers(app)
    app.include_router(task_catalog_router, prefix="/api/v1")
    app.state.task_catalog_service = service or TaskCatalogPageService(_provider)
    actor = _actor(role)

    def override() -> AuthenticatedSession:
        return AuthenticatedSession(actor=actor, session=_session_record(actor))

    app.dependency_overrides[current_session] = override  # type: ignore[assignment]
    return TestClient(app)


def test_participant_receives_page_with_totals_and_first_item() -> None:
    response = _client(Role.PARTICIPANT).get(
        "/api/v1/me/task-recommendations", params={"sort": "match-default", "page_size": 2}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_found"] == 4
    assert payload["total_available"] == 3
    assert len(payload["items"]) == 2
    first = payload["items"][0]
    assert first["match"]["status"] == "calculated"
    assert first["match"]["percent"] == "92"
    assert first["eligibility"]["status"] == "eligible"
    assert first["allowed_actions"] == ["apply", "open_conditions"]
    assert payload["next_cursor"] is not None


def test_cursor_continuation_keeps_identical_totals() -> None:
    api = _client(Role.PARTICIPANT)
    first = api.get(
        "/api/v1/me/task-recommendations", params={"sort": "match-default", "page_size": 2}
    ).json()
    cursor = first["next_cursor"]
    assert cursor is not None
    second = api.get(
        "/api/v1/me/task-recommendations",
        params={"sort": "match-default", "page_size": 2, "cursor": cursor},
    ).json()
    assert second["total_found"] == 4
    assert second["total_available"] == 3
    assert [item["match"]["percent"] for item in second["items"]] == ["68", None]
    assert second["next_cursor"] is None


def test_filters_change_found_total_but_not_available_total() -> None:
    response = _client(Role.PARTICIPANT).get(
        "/api/v1/me/task-recommendations", params={"sort": "deadline", "q": "task-102"}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_found"] == 1
    assert payload["total_available"] == 3


def test_unknown_sort_is_a_typed_contract_error() -> None:
    response = _client(Role.PARTICIPANT).get(
        "/api/v1/me/task-recommendations", params={"sort": "price"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "CATALOG_QUERY_INVALID"


def test_non_participant_role_gets_forbidden() -> None:
    assert _client(Role.CUSTOMER).get("/api/v1/me/task-recommendations").status_code == 403
    assert _client(Role.MENTOR).get("/api/v1/me/task-recommendations").status_code == 403


def test_page_size_bound_mirrors_contract() -> None:
    api = _client(Role.PARTICIPANT)
    assert api.get("/api/v1/me/task-recommendations", params={"page_size": 51}).status_code == 422
    assert api.get("/api/v1/me/task-recommendations", params={"page_size": 1}).status_code == 200


def test_every_catalog_filter_controls_real_api_results() -> None:
    """The filter bar must narrow actual server data, not just rewrite URL params."""
    api = _client(Role.PARTICIPANT)
    cases: tuple[tuple[dict[str, str], list[str]], ...] = (
        ({"q": "task-102"}, ["Задача task-102"]),
        (
            {"competency": "python"},
            ["Задача task-102", "Задача task-103", "Задача task-101", "Задача task-104"],
        ),
        ({"competency": "unknown-skill"}, []),
        (
            {"difficulty": "middle"},
            ["Задача task-102", "Задача task-103", "Задача task-101", "Задача task-104"],
        ),
        ({"difficulty": "advanced"}, []),
        (
            {"customer": "АТЛАС"},
            ["Задача task-102", "Задача task-103", "Задача task-101", "Задача task-104"],
        ),
        (
            {"work_format": "remote"},
            ["Задача task-102", "Задача task-103", "Задача task-101", "Задача task-104"],
        ),
        ({"work_format": "hybrid"}, []),
        ({"direction": "ml"}, []),
        ({"timeframe": "7d"}, []),
        ({"saved": "true"}, []),
        (
            {
                "sort": "match-default",
                "q": "task-102",
                "competency": "python",
                "difficulty": "middle",
                "customer": "атлас",
                "work_format": "remote",
            },
            ["Задача task-102"],
        ),
    )
    for params, expected_titles in cases:
        response = api.get("/api/v1/me/task-recommendations", params=params)
        assert response.status_code == 200, (params, response.text)
        payload = response.json()
        assert [item["title"] for item in payload["items"]] == expected_titles, params
        assert payload["total_found"] == len(expected_titles), params
        # Available tasks are counted over the authorized catalog, not
        # recalculated as a misleading number for every local filter.
        assert payload["total_available"] == 3, params

    for sort in ("deadline", "duration", "newest", "skill-growth"):
        response = api.get("/api/v1/me/task-recommendations", params={"sort": sort})
        assert response.status_code == 200, (sort, response.text)
        assert response.json()["total_found"] == 4

    invalid = api.get("/api/v1/me/task-recommendations", params={"timeframe": "14d"})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "CATALOG_QUERY_INVALID"


def test_product_filter_parameters_are_enforced_by_real_http_api() -> None:
    api = _client(Role.PARTICIPANT)
    scenarios = (
        ({"mentored": "true"}, 0),
        ({"portfolio": "true"}, 0),
        ({"available": "true"}, 3),
        ({"available": "false"}, 1),
        ({"mentored": "true", "portfolio": "true"}, 0),
    )
    for params, count in scenarios:
        response = api.get("/api/v1/me/task-recommendations", params=params)
        assert response.status_code == 200, (params, response.text)
        assert response.json()["total_found"] == count
        assert len(response.json()["items"]) == count
