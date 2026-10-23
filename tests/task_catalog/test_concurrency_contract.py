"""Contract tests for TC-016 concurrency marker, timezone guard and revalidate."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
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
from impulse.application.task_concurrency import (
    CatalogTermsMarker,
    MarkerError,
    TermsChangedConflict,
    marker_for,
    parse_submitted_token,
)
from impulse.application.task_terms_read import (
    TaskDetailReadService,
    TaskTermsError,
    TaskTermsSnapshot,
)
from impulse.domain.identity import ActorContext, ConsentScope, Role

NOW = datetime(2026, 10, 23, 16, 0, tzinfo=UTC)
DEADLINE = datetime(2026, 11, 20, 18, 0, tzinfo=UTC)


def actor(role: Role = Role.PARTICIPANT) -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Алексей Рогожин",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="task-catalog-demo",
        consent_scopes=frozenset({ConsentScope.COURSE_HONOR_BOARD}),
    )


def projection(label: str, *, snapshot_version: str = "snap-3") -> TaskRecommendationProjection:
    index = int(label.rsplit("-", 1)[-1])
    return TaskRecommendationProjection(
        task_id=UUID(int=index),
        schema_version=1,
        snapshot_version=snapshot_version,
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
        deadline_at=DEADLINE,
        eligibility=EligibilityProjection(status=EligibilityStatus.ELIGIBLE, reason_codes=()),
        match=MatchProjection(
            status=MatchStatus.CALCULATED,
            percent=Decimal("74"),
            coverage=Decimal("0.8"),
            algorithm_version="interim-default-v1",
            source_snapshot_version="evidence-1",
            calculated_at=NOW,
            reasons=(MatchReason(code="FORMAT_FIT", label="Формат подходит"),),
        ),
        skill_impact=(),
        stage_plan=StagePlanProjection(version=1, stages=()),
        benefits=(),
        application_state=ApplicationState.NONE,
        allowed_actions=frozenset({CatalogAction.APPLY, CatalogAction.OPEN_CONDITIONS}),
        sources=(ProjectionSource(kind="task_brief", ref="demo-task", version="1"),),
        generated_at=NOW,
    )


def terms(label: str) -> TaskTermsSnapshot:
    return TaskTermsSnapshot(
        task_id=UUID(int=int(label.rsplit("-", 1)[-1])),
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
        deadline_at=DEADLINE,
        data_constraints="Синтетические данные.",
    )


def pairs() -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
    return ((projection("task-101"), terms("task-101")),)


async def terms_provider(
    _actor: ActorContext,
) -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
    return pairs()


async def projection_provider(_actor: ActorContext) -> Sequence[TaskRecommendationProjection]:
    return [item for item, _terms in pairs()]


def service() -> TaskDetailReadService:
    page = TaskCatalogPageService(projection_provider)
    return TaskDetailReadService(page, terms_provider)


def test_marker_token_is_stable_and_quoted() -> None:
    marker = marker_for(terms("task-101"), projection("task-101"))
    again = marker_for(terms("task-101"), projection("task-101"))
    assert marker.token == again.token
    assert marker.token.startswith('"tc-') and marker.token.endswith('"')
    changed = marker_for(terms("task-101"), projection("task-101", snapshot_version="snap-4"))
    assert changed.token != marker.token
    assert (
        changed.token
        == marker_for(terms("task-101"), projection("task-101", snapshot_version="snap-4")).token
    )


def test_marker_rejects_naive_deadline_and_bad_versions() -> None:
    with pytest.raises(MarkerError):
        CatalogTermsMarker(
            task_id=UUID(int=101),
            terms_version=4,
            brief_version=3,
            snapshot_version="snap-3",
            deadline_at=datetime(2026, 11, 20, 18, 0),
        )
    with pytest.raises(MarkerError):
        CatalogTermsMarker(
            task_id=UUID(int=101),
            terms_version=0,
            brief_version=3,
            snapshot_version="snap-3",
            deadline_at=DEADLINE,
        )


def test_terms_snapshot_requires_aware_deadline() -> None:
    base = terms("task-101")
    with pytest.raises(TaskTermsError):
        TaskTermsSnapshot(
            task_id=base.task_id,
            terms_version=4,
            brief_version=3,
            deliverable=base.deliverable,
            prerequisites=base.prerequisites,
            selection_criteria=base.selection_criteria,
            support_model=base.support_model,
            ip_terms=base.ip_terms,
            portfolio_permission=base.portfolio_permission,
            paid=False,
            payout_condition=None,
            deadline_at=datetime(2026, 11, 20, 18, 0),
        )


def test_revalidate_matches_current_marker() -> None:
    import asyncio

    fresh = asyncio.run(service().revalidate(actor(), UUID(int=101)))
    live = marker_for(terms("task-101"), projection("task-101"))
    assert fresh.token == live.token
    submitted = asyncio.run(service().revalidate(actor(), UUID(int=101), fresh.token))
    assert submitted.token == fresh.token


def test_revalidate_yields_terms_changed_on_stale_marker() -> None:
    import asyncio

    with pytest.raises(TermsChangedConflict):
        asyncio.run(service().revalidate(actor(), UUID(int=101), '"tc-0000000000000000"'))


def test_revalidate_yields_terms_changed_on_version_drift() -> None:
    import asyncio

    fresh = asyncio.run(service().revalidate(actor(), UUID(int=101)))
    with pytest.raises(TermsChangedConflict):
        asyncio.run(
            service().revalidate(actor(), UUID(int=101), fresh.token, submitted_terms_version=3)
        )


def test_parse_submitted_token_flexible_quotes() -> None:
    assert parse_submitted_token(None) is None
    assert parse_submitted_token("  ") is None
    assert parse_submitted_token('"tc-abcdef1234567890"') == '"tc-abcdef1234567890"'
    assert parse_submitted_token("tc-abcdef1234567890") == '"tc-abcdef1234567890"'
    with pytest.raises(MarkerError):
        parse_submitted_token('"oops')


def test_revalidate_is_participant_only() -> None:
    import asyncio

    with pytest.raises(ApiError) as bound:
        asyncio.run(service().revalidate(actor(Role.MENTOR), UUID(int=101)))
    assert bound.value.status_code == 403


def test_marker_ignores_deadline_absolute_time_in_token() -> None:
    marker = marker_for(terms("task-101"), projection("task-101"))
    expirable = DEADLINE - timedelta(hours=1)
    stale = CatalogTermsMarker(
        task_id=UUID(int=101),
        terms_version=4,
        brief_version=3,
        snapshot_version="snap-3",
        deadline_at=expirable,
    )
    assert stale.token == marker.token
