"""Contract tests for TC-015 permitted detail and terms reads."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest

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
from impulse.application.task_catalog_visibility import (
    TaskVisibilityError,
    TaskVisibilitySnapshot,
    VisibilityFactError,
    snapshot,
)
from impulse.application.task_terms_read import (
    TaskDetailReadService,
    TaskTermsError,
    TaskTermsSnapshot,
)
from impulse.domain.identity import ActorContext, ConsentScope, Role

NOW = datetime(2026, 10, 23, 14, 0, tzinfo=UTC)
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


def projection(label: str) -> TaskRecommendationProjection:
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


def terms(label: str, *, paid: bool = True) -> TaskTermsSnapshot:
    return TaskTermsSnapshot(
        task_id=UUID(int=int(label.rsplit("-", 1)[-1])),
        terms_version=4,
        brief_version=3,
        deliverable="MVP семантического индекса",
        prerequisites=("python >= 3.12",),
        selection_criteria=("Публичное резюме и короткий шаг отбора",),
        support_model="mentor_weekly" if paid else "none",
        ip_terms="Результат доступен заказчику.",
        portfolio_permission="conditional" if paid else "none",
        paid=paid,
        payout_condition="После приёмки личного вклада." if paid else None,
        deadline_at=DEADLINE,
        data_constraints="Синтетические данные.",
    )


def pairs() -> Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]:
    return (
        (projection("task-101"), terms("task-101")),
        (projection("task-102"), terms("task-102", paid=False)),
        (projection("task-103"), terms("task-103")),
    )


async def provider(_actor: ActorContext) -> Sequence[tuple[TaskRecommendationProjection, Any]]:
    return pairs()


async def gate(
    _actor: ActorContext, item: TaskRecommendationProjection
) -> TaskVisibilitySnapshot | None:
    if item.task_id == UUID(int=102):
        return snapshot(published=False)
    return None


def service(
    with_gate: bool = False,
) -> TaskDetailReadService:
    page = TaskCatalogPageService(
        lambda a: _pairs_projection_provider(a),
        admission_gate=gate if with_gate else None,
    )
    return TaskDetailReadService(page, provider)


async def _pairs_projection_provider(
    _actor: ActorContext,
) -> Sequence[TaskRecommendationProjection]:
    return [item for item, _terms in pairs()]


def test_terms_snapshot_validates_explicit_conditions() -> None:
    ok = terms("task-101")
    assert ok.terms_version == 4
    assert ok.portfolio_permission == "conditional"
    with pytest.raises(TaskTermsError):
        TaskTermsSnapshot(
            task_id=UUID(int=104),
            terms_version=1,
            brief_version=1,
            deliverable="x",
            prerequisites=("p",),
            selection_criteria=("s",),
            support_model="none",
            ip_terms="ip",
            portfolio_permission="none",
            paid=True,
            payout_condition=None,
            deadline_at=DEADLINE,
        )


def test_terms_snapshot_rejects_incomplete_versions_and_support() -> None:
    kwargs: dict[str, Any] = {
        "task_id": UUID(int=105),
        "terms_version": 0,
        "brief_version": 1,
        "deliverable": "d",
        "prerequisites": ("p",),
        "selection_criteria": ("s",),
        "support_model": "none",
        "ip_terms": "ip",
        "portfolio_permission": "none",
        "paid": False,
        "payout_condition": None,
        "deadline_at": None,
    }
    with pytest.raises(TaskTermsError):
        TaskTermsSnapshot(**kwargs)
    kwargs["terms_version"] = 1
    kwargs["support_model"] = "  "
    with pytest.raises(TaskTermsError):
        TaskTermsSnapshot(**kwargs)
    kwargs["support_model"] = "none"
    kwargs["portfolio_permission"] = "ghost"
    with pytest.raises(TaskTermsError):
        TaskTermsSnapshot(**kwargs)


def test_detail_reuses_visibility_authority_safe_not_found() -> None:
    gated = service(with_gate=True)
    import asyncio

    found = asyncio.run(gated.detail(actor(), UUID(int=103)))
    assert found.task_id == UUID(int=103)
    for hidden_task_id in (UUID(int=102), UUID(int=104)):
        with pytest.raises(TaskVisibilityError):
            asyncio.run(gated.detail(actor(), hidden_task_id))
    plain = service()
    hidden_detail = asyncio.run(plain.detail(actor(), UUID(int=102)))
    assert hidden_detail.task_id == UUID(int=102)


def test_terms_read_honors_object_level_visibility() -> None:
    import asyncio

    gated = service(with_gate=True)
    opened = asyncio.run(gated.terms(actor(), UUID(int=101)))
    assert opened.task_id == UUID(int=101)
    assert opened.paid is True
    with pytest.raises(TaskVisibilityError):
        asyncio.run(gated.terms(actor(), UUID(int=102)))


def test_terms_read_does_not_distinguish_unknown_from_hidden() -> None:
    import asyncio

    gated = service(with_gate=True)
    with pytest.raises(TaskVisibilityError):
        asyncio.run(gated.terms(actor(), UUID(int=102)))
    with pytest.raises(TaskVisibilityError):
        asyncio.run(gated.terms(actor(), UUID(int=104)))


def test_terms_of_hidden_task_via_plain_page_service_still_readable() -> None:
    import asyncio

    plain = service()
    opened = asyncio.run(plain.terms(actor(), UUID(int=102)))
    assert opened.paid is False
    assert opened.support_model == "none"


def test_safety_error_is_typed_contract_error() -> None:
    assert issubclass(TaskTermsError, Exception)
    with pytest.raises(VisibilityFactError):
        TaskVisibilitySnapshot(("ghost_gate",))


def test_unpaid_terms_resemble_explicit_none_values() -> None:
    unpaid = terms("task-102", paid=False)
    assert unpaid.support_model == "none"
    assert unpaid.portfolio_permission == "none"
    assert unpaid.payout_condition is None
    assert unpaid.paid is False
