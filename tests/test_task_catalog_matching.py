"""Approved matching policy, freshness and property contracts for TC-010/011/046."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st

from impulse.application.task_catalog import MatchStatus
from impulse.application.task_catalog_matching import (
    FORMAT_FIT,
    GROWTH_FIT,
    ROLE_REQUIREMENTS,
    VERIFIED_COMPETENCIES,
    FactorValue,
    MatchingContext,
    calculate_task_match,
    fresh_verified_tags,
    score_factors,
)
from impulse.application.work import CaseEvidence, TaskCatalogMetadata, TaskRecord
from impulse.domain.work import TaskAggregate, TaskBrief

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)


def test_approved_weighted_example_is_84_percent() -> None:
    result = score_factors(
        (
            FactorValue(ROLE_REQUIREMENTS, Decimal("1.0")),
            FactorValue(VERIFIED_COMPETENCIES, Decimal("0.8")),
            FactorValue(GROWTH_FIT, Decimal("0.5")),
            FactorValue(FORMAT_FIT, Decimal("1.0")),
        )
    )

    assert result.status is MatchStatus.CALCULATED
    assert result.percent == Decimal("84.00")
    assert result.coverage == Decimal("1.0")
    assert result.missing_factors == ()


def test_low_coverage_is_insufficient_not_zero() -> None:
    result = score_factors(
        (
            FactorValue(ROLE_REQUIREMENTS, Decimal("1")),
            FactorValue(VERIFIED_COMPETENCIES, Decimal("0.8")),
            FactorValue(GROWTH_FIT, None),
            FactorValue(FORMAT_FIT, None),
        )
    )

    assert result.status is MatchStatus.INSUFFICIENT_DATA
    assert result.percent is None
    assert result.coverage == Decimal("0.70")
    assert result.missing_factors == (GROWTH_FIT, FORMAT_FIT)


def test_growth_fit_is_exposed_separately_from_overall_match() -> None:
    task = TaskRecord(
        project_key="project",
        task_key="task",
        title="Task",
        aggregate=TaskAggregate(uuid4(), uuid4(), TaskBrief(problem="Problem")),
        competency_tags=("python", "api"),
        catalog=TaskCatalogMetadata(direction_keys=("python",)),
    )
    context = MatchingContext(
        direction_keys=("python",),
        growth_tags=frozenset({"python"}),
        verified_tags=frozenset({"python", "api"}),
        source_snapshot_version="snapshot-1",
        format_fit=Decimal("1"),
    )

    result = calculate_task_match(task, context, calculated_at=NOW)

    assert result.growth_fit_percent == Decimal("50.00")
    assert result.percent == Decimal("90.00")
    assert tuple(reason.code for reason in result.reasons) == ("MATCH", "GROWTH", "FORMAT_FIT")


def test_prerequisite_gap_has_stable_explanation_code() -> None:
    task = TaskRecord(
        project_key="project",
        task_key="task",
        title="Task",
        aggregate=TaskAggregate(uuid4(), uuid4(), TaskBrief(problem="Problem")),
        competency_tags=("python",),
        catalog=TaskCatalogMetadata(prerequisite_tags=("api",)),
    )
    context = MatchingContext(
        direction_keys=("python",),
        growth_tags=frozenset({"python"}),
        verified_tags=frozenset({"python"}),
        source_snapshot_version="snapshot-1",
        format_fit=Decimal("1"),
    )

    result = calculate_task_match(task, context, calculated_at=NOW)

    assert "PREREQUISITE_GAP" in {reason.code for reason in result.reasons}
    gap = next(reason for reason in result.reasons if reason.code == "PREREQUISITE_GAP")
    assert "api" in gap.label
    assert {source.kind for source in gap.source_refs} == {
        "participant_matching_snapshot",
        "task_brief",
    }


def test_fresh_verified_tags_exclude_expired_evidence() -> None:
    def evidence(submitted_at: datetime, tag: str) -> CaseEvidence:
        return CaseEvidence(
            task_id=uuid4(),
            contribution_id=uuid4(),
            personal_summary="summary",
            competency_tags=(tag,),
            artifact_keys=("artifact",),
            submitted_at=submitted_at,
            reviewer_id=uuid4(),
        )

    tags = fresh_verified_tags(
        (
            evidence(NOW - timedelta(days=366), "expired"),
            evidence(NOW - timedelta(days=365), "boundary"),
            evidence(NOW, "fresh"),
        ),
        NOW,
    )

    assert tags == frozenset({"boundary", "fresh"})


@given(
    values=st.lists(
        st.one_of(
            st.none(),
            st.decimals(
                min_value=Decimal("0"),
                max_value=Decimal("1"),
                allow_nan=False,
                allow_infinity=False,
                places=4,
            ),
        ),
        min_size=4,
        max_size=4,
    )
)
def test_score_properties_hold_for_arbitrary_factor_coverage(
    values: list[Decimal | None],
) -> None:
    result = score_factors(
        tuple(
            FactorValue(code, value)
            for code, value in zip(
                (ROLE_REQUIREMENTS, VERIFIED_COMPETENCIES, GROWTH_FIT, FORMAT_FIT),
                values,
                strict=True,
            )
        )
    )

    assert Decimal("0") <= result.coverage <= Decimal("1")
    if result.status is MatchStatus.CALCULATED:
        assert result.percent is not None
        assert Decimal("0") <= result.percent <= Decimal("100")
        assert result.coverage >= Decimal("0.75")
    else:
        assert result.percent is None
        assert result.coverage < Decimal("0.75")


@pytest.mark.parametrize("value", [Decimal("-0.01"), Decimal("1.01")])
def test_factor_values_outside_unit_interval_are_rejected(value: Decimal) -> None:
    with pytest.raises(ValueError, match=r"0\.\.1"):
        FactorValue(ROLE_REQUIREMENTS, value)
