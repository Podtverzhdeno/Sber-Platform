"""Contract tests for TC-009 visibility-before-counts and safe-404 authority."""

from __future__ import annotations

from collections.abc import Coroutine, Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
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
from impulse.application.task_catalog_page import (
    CatalogPage,
    CatalogQuery,
    TaskCatalogPageService,
    build_catalog_page,
)
from impulse.application.task_catalog_visibility import (
    VISIBLE_GATES,
    TaskVisibilityError,
    TaskVisibilitySnapshot,
    VisibilityFactError,
    deadline_cutoff,
    deadline_open,
    open_snapshot,
    snapshot,
)
from impulse.domain.identity import ActorContext, ConsentScope, Role

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
PAST = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)
FUTURE = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


def actor() -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Алексей Рогожин",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="task-catalog-demo",
        consent_scopes=frozenset({ConsentScope.COURSE_HONOR_BOARD}),
    )


def projection(label: str, *, deadline: datetime | None = FUTURE) -> TaskRecommendationProjection:
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
        deadline_at=deadline,
        eligibility=EligibilityProjection(status=EligibilityStatus.ELIGIBLE, reason_codes=()),
        match=MatchProjection(
            status=MatchStatus.CALCULATED,
            percent=Decimal("80"),
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


def items_visible() -> Sequence[TaskRecommendationProjection]:
    return (projection("task-101"), projection("task-102"), projection("task-103"))


async def gate(
    actor: ActorContext, item: TaskRecommendationProjection
) -> TaskVisibilitySnapshot | None:
    if item.task_id == UUID(int=102):
        return snapshot(published=False, invited=False)
    return None


def test_gate_codes_are_closed_vocabulary() -> None:
    assert VISIBLE_GATES == (
        "not_published",
        "foreign_tenant_or_program",
        "insufficient_invitation",
        "deadline_passed",
        "quota_exhausted",
    )
    hidden = snapshot(published=False, tenant_or_program=False, quota_open=False)
    assert not hidden.is_visible()
    assert hidden.failed_gates == (
        "not_published",
        "foreign_tenant_or_program",
        "quota_exhausted",
    )
    assert snapshot().is_visible()


def test_unknown_gate_code_rejected_and_duplicate_normalized() -> None:
    with pytest.raises(VisibilityFactError):
        TaskVisibilitySnapshot(("ghost_gate",))
    folded = TaskVisibilitySnapshot(("quota_exhausted", "quota_exhausted"))
    assert folded.failed_gates == ("quota_exhausted",)


def test_visibility_runs_before_counts() -> None:
    query = CatalogQuery(sort="deadline", page_size=10)
    visible = tuple(item for item in items_visible() if item.task_id != UUID(int=102))
    page: CatalogPage = build_catalog_page(visible, query)
    assert page.total_found == 2
    assert page.total_available == 2
    assert all(item.task_id != UUID(int=102) for item in page.items)


def test_service_drops_hidden_tasks_before_totals() -> None:
    service = TaskCatalogPageService(
        lambda _actor: _async_items(items_visible()), admission_gate=gate
    )
    page = asyncio_run(service.page(actor(), CatalogQuery(sort="match-default", page_size=10)))
    assert page.total_found == 2
    assert [item.task_id for item in page.items] == [UUID(int=101), UUID(int=103)]


def test_default_stage_enforces_projection_deadline_with_clock() -> None:
    service = TaskCatalogPageService(
        lambda _actor: _async_items(
            (projection("task-201", deadline=PAST), projection("task-202", deadline=None))
        ),
        now_provider=lambda: NOW,
    )
    page = asyncio_run(service.page(actor(), CatalogQuery(page_size=10)))
    assert [item.task_id for item in page.items] == [UUID(int=202)]
    assert page.total_found == 1
    assert page.total_available == 1

    aware = TaskCatalogPageService(
        lambda _actor: _async_items((projection("task-201", deadline=PAST),)),
        now_provider=lambda: datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
    )
    kept = asyncio_run(aware.page(actor(), CatalogQuery(page_size=10)))
    assert kept.total_found == 1


async def _async_items(
    items: Sequence[TaskRecommendationProjection],
) -> Sequence[TaskRecommendationProjection]:
    return items


def asyncio_run(awaitable: Coroutine[Any, Any, Any]) -> Any:
    import asyncio

    return asyncio.run(awaitable)


def test_require_visible_returns_hidden_free_projection_and_safe_not_found() -> None:
    service = TaskCatalogPageService(
        lambda _actor: _async_items(items_visible()), admission_gate=gate
    )
    found = asyncio_run(service.require_visible(actor(), UUID(int=103)))
    assert found.task_id == UUID(int=103)
    for hidden_task_id in (UUID(int=102), UUID(int=104)):
        with pytest.raises(TaskVisibilityError) as bound:
            asyncio_run(service.require_visible(actor(), hidden_task_id))
        leak_text = str(bound.value)
        assert "102" not in leak_text
        assert "task-103" not in leak_text
        assert "Заказчик Атлас" not in leak_text


def test_require_visible_is_participant_only() -> None:
    service = TaskCatalogPageService(lambda _actor: _async_items(items_visible()))
    guest = ActorContext(
        person_id=uuid4(),
        display_name="Заказчик Васин",
        active_role=Role.CUSTOMER,
        assigned_roles=(Role.CUSTOMER,),
        scopes=frozenset(),
        program_key="task-catalog-demo",
        consent_scopes=frozenset(),
    )
    with pytest.raises(ApiError) as bound:
        asyncio_run(service.require_visible(guest, UUID(int=103)))
    assert bound.value.code == "FORBIDDEN"
    assert bound.value.status_code == 403


def test_deadline_and_clock_helpers_are_casefold_equivalent() -> None:
    assert deadline_open(FUTURE, NOW) is True
    assert deadline_open(PAST, NOW) is False
    assert deadline_open(None, NOW) is True
    cut = deadline_cutoff(NOW)
    assert cut.tzinfo is UTC
    with pytest.raises(VisibilityFactError):
        deadline_cutoff(datetime(2026, 10, 23, 12, 0))
    pre = open_snapshot(PAST, NOW)
    assert pre.failed_gates == ("deadline_passed",)


def test_cursor_page_after_hidden_is_stable() -> None:
    service = TaskCatalogPageService(
        lambda _actor: _async_items(items_visible()), admission_gate=gate
    )
    first = asyncio_run(service.page(actor(), CatalogQuery(sort="match-default", page_size=1)))
    assert first.next_cursor is not None
    second = asyncio_run(
        service.page(
            actor(),
            CatalogQuery(sort="match-default", page_size=4, cursor=first.next_cursor),
        )
    )
    assert second.total_found == 2
    assert UUID(int=102) not in {item.task_id for item in second.items}
