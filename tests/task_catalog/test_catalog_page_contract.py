"""Contract tests for the TC-008 catalog page ordering, filters and cursor paging."""

from __future__ import annotations

import base64
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
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
from impulse.application.task_catalog_page import (
    CatalogQuery,
    CatalogQueryError,
    build_catalog_page,
)

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)


def customer(index: int) -> CustomerSummary:
    return CustomerSummary(
        id=UUID(int=index),
        display_name=f"Заказчик {index}",
        verification=CustomerVerification.DEMO,
    )


def eligibility(status: EligibilityStatus) -> EligibilityProjection:
    return EligibilityProjection(
        status=status,
        reason_codes=() if status is EligibilityStatus.ELIGIBLE else ("deadline_passed",),
    )


def match(percent: str | None) -> MatchProjection:
    if percent is None:
        return MatchProjection(
            status=MatchStatus.INSUFFICIENT_DATA,
            percent=None,
            coverage=Decimal("0.2"),
            algorithm_version=None,
            source_snapshot_version="evidence-1",
            calculated_at=NOW,
        )
    return MatchProjection(
        status=MatchStatus.CALCULATED,
        percent=Decimal(percent),
        coverage=Decimal("0.8"),
        algorithm_version="interim-default-v1",
        source_snapshot_version="evidence-1",
        calculated_at=NOW,
        reasons=(MatchReason("FORMAT_FIT", "Формат подходит", (source(),)),),
    )


def source() -> ProjectionSource:
    return ProjectionSource(kind="task_brief", ref="demo-task", version="1", observed_at=NOW)


def projection(
    label: str,
    *,
    percent: str | None,
    deadline: str | None,
    duration: int | None,
    customer_index: int = 1,
    tags: tuple[str, ...] = ("python",),
    title: str | None = None,
    difficulty: str = "middle",
    work_format: str = "remote",
    eligibility_status: EligibilityStatus = EligibilityStatus.ELIGIBLE,
) -> TaskRecommendationProjection:
    return TaskRecommendationProjection(
        task_id=UUID(int=int(label.rsplit("-", 1)[-1])),
        schema_version=1,
        snapshot_version=f"catalog-snap-{label}",
        brief_version=1,
        terms_version=1,
        title=title or f"Задача {label}",
        customer=customer(customer_index),
        brief_summary="Краткое описание публичного брифа",
        competency_tags=tags,
        difficulty=difficulty,
        duration_minutes=duration,
        work_format=work_format,
        places_total=2,
        places_available=2,
        deadline_at=datetime.fromisoformat(deadline) if deadline else None,
        eligibility=eligibility(eligibility_status),
        match=match(percent),
        skill_impact=(),
        stage_plan=StagePlanProjection(version=1, stages=()),
        benefits=(),
        application_state=ApplicationState.NONE,
        allowed_actions=(
            frozenset({CatalogAction.APPLY, CatalogAction.OPEN_CONDITIONS})
            if eligibility_status is EligibilityStatus.ELIGIBLE
            else frozenset({CatalogAction.OPEN_CONDITIONS})
        ),
        sources=(source(),),
        generated_at=NOW,
    )


def items() -> tuple[TaskRecommendationProjection, ...]:
    # Exactly the AT-01 evidence: equal-eligibility tasks with scores 92, 84 and 68.
    return (
        projection("task-101", percent="68", deadline="2026-11-10T10:00:00+00:00", duration=240),
        projection("task-102", percent="92", deadline="2026-11-05T10:00:00+00:00", duration=480),
        projection("task-103", percent="84", deadline="2026-11-12T10:00:00+00:00", duration=120),
        projection(
            "task-104",
            percent=None,
            deadline="2026-11-03T10:00:00+00:00",
            duration=90,
            eligibility_status=EligibilityStatus.INELIGIBLE,
        ),
    )


@pytest.mark.parametrize(
    ("query_sort", "expected"),
    [
        ("match-default", [92, 84, 68, None]),
        ("deadline", [None, 92, 68, 84]),
        ("duration", [None, 84, 68, 92]),
    ],
    ids=["match-desc-with-stable-deadline-ties", "deadline-asc", "duration-asc-nulls-last"],
)
def test_sort_orders_are_stable_and_documented(query_sort: str, expected: list[str | None]):
    page = build_catalog_page(items(), CatalogQuery(sort=query_sort, page_size=10))

    ordered = [item.match.percent for item in page.items]
    assert ordered == [Decimal(value) if value is not None else None for value in expected]
    assert page.total_found == 4
    assert page.total_available == 3


def test_first_page_and_cursor_continue_cover_the_same_ordering() -> None:
    query = CatalogQuery(sort="match-default", page_size=2)
    first = build_catalog_page(items(), query)

    assert [item.match.percent for item in first.items] == [Decimal("92"), Decimal("84")]
    assert first.next_cursor is not None

    second = build_catalog_page(
        items(), CatalogQuery(sort="match-default", page_size=2, cursor=first.next_cursor)
    )

    assert [item.match.percent for item in second.items] == [Decimal("68"), None]
    assert second.next_cursor is None
    assert second.total_found == 4
    assert second.total_available == 3


def test_cursor_locked_to_query_fingerprint() -> None:
    first = build_catalog_page(items(), CatalogQuery(sort="match-default", page_size=1))
    assert first.next_cursor is not None
    with pytest.raises(CatalogQueryError):
        build_catalog_page(
            items(), CatalogQuery(sort="deadline", page_size=1, cursor=first.next_cursor)
        )
    with pytest.raises(CatalogQueryError):
        build_catalog_page(
            items(), CatalogQuery(sort="match-default", page_size=1, cursor="не-курсор")
        )


def test_cursor_with_wrong_ordering_primitive_is_a_client_error() -> None:
    query = CatalogQuery(sort="duration", page_size=2)
    payload = {"key": json.dumps(["not-a-number", "task-101"]), "fp": query.fingerprint}
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    with pytest.raises(CatalogQueryError, match="ordering values"):
        build_catalog_page(items(), CatalogQuery(sort="duration", page_size=2, cursor=cursor))


def test_filters_narrow_without_losing_totals_semantics() -> None:
    page = build_catalog_page(
        items(),
        CatalogQuery(
            q="task-102",
            competency=("python",),
            difficulty="middle",
            work_format="remote",
            page_size=5,
        ),
    )

    assert page.total_found == 1
    assert page.items[0].match.percent == Decimal("92")
    assert page.items[0].task_id == UUID(int=102)
    assert page.total_available == 3


def test_customer_substring_filter_is_case_insensitive() -> None:
    page = build_catalog_page(items(), CatalogQuery(customer="заказ", page_size=5))
    assert page.total_found == 4


def test_unknown_sort_and_page_bounds_are_rejected() -> None:
    with pytest.raises(CatalogQueryError):
        CatalogQuery(sort="price")
    with pytest.raises(CatalogQueryError):
        CatalogQuery(page_size=0)
    with pytest.raises(CatalogQueryError):
        CatalogQuery(page_size=51)
    with pytest.raises(CatalogQueryError):
        CatalogQuery(cursor="")


def test_identical_queries_return_identical_ordered_ids() -> None:
    first = build_catalog_page(items(), CatalogQuery(sort="deadline", page_size=4))
    second = build_catalog_page(items(), CatalogQuery(sort="deadline", page_size=4))

    assert [item.task_id for item in first.items] == [item.task_id for item in second.items]
    assert len(first.items) == 4
    assert uuid4()  # sanity: UUID helper still valid


def test_direction_timeframe_saved_filters_and_snapshot_kpis() -> None:
    source_items = items()
    customized = tuple(
        replace(
            item,
            direction_keys=("python",) if index == 0 else ("ml",),
            bookmarked=index == 0,
        )
        for index, item in enumerate(source_items)
    )

    page = build_catalog_page(
        customized,
        CatalogQuery(direction="PYTHON", timeframe="30d", saved=True, page_size=10),
    )

    assert [item.task_id for item in page.items] == [UUID(int=101)]
    assert page.total_found == 1
    assert page.total_available == 3
    assert page.total_saved == 1
    assert page.total_calculated == 3
    assert page.snapshot_at == NOW


def test_newest_and_growth_sort_have_stable_cursor_shapes() -> None:
    source_items = items()
    customized = tuple(
        replace(
            item,
            created_at=NOW + timedelta(days=index),
            match=replace(
                item.match,
                growth_fit_percent=Decimal(value) if value is not None else None,
            ),
        )
        for index, (item, value) in enumerate(
            zip(source_items, ("50", "20", "80", None), strict=True)
        )
    )

    newest = build_catalog_page(customized, CatalogQuery(sort="newest", page_size=4))
    assert [item.task_id for item in newest.items] == [
        UUID(int=104),
        UUID(int=103),
        UUID(int=102),
        UUID(int=101),
    ]

    first = build_catalog_page(customized, CatalogQuery(sort="skill-growth", page_size=2))
    assert [item.task_id for item in first.items] == [UUID(int=103), UUID(int=101)]
    assert first.next_cursor is not None
    second = build_catalog_page(
        customized,
        CatalogQuery(sort="skill-growth", page_size=2, cursor=first.next_cursor),
    )
    assert [item.task_id for item in second.items] == [UUID(int=102), UUID(int=104)]


def test_timeframe_rejects_unknown_windows_and_excludes_missing_deadlines() -> None:
    with pytest.raises(CatalogQueryError):
        CatalogQuery(timeframe="1y")
    page = build_catalog_page(items(), CatalogQuery(timeframe="7d", page_size=10))
    assert page.items == ()
