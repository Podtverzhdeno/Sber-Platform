"""Contract tests for one truthful task catalog projection."""

from __future__ import annotations

from dataclasses import FrozenInstanceError, replace
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import pytest

from impulse.application.task_catalog import (
    TASK_CATALOG_SCHEMA_VERSION,
    ApplicationState,
    CatalogAction,
    CatalogContractError,
    CustomerSummary,
    CustomerVerification,
    EligibilityProjection,
    EligibilityStatus,
    ForecastStatus,
    MatchProjection,
    MatchReason,
    MatchStatus,
    ProjectionSource,
    SkillImpactProjection,
    StagePlanItem,
    StagePlanProjection,
    StagePlanState,
    TaskRecommendationProjection,
)

NOW = datetime(2026, 10, 22, 12, 0, tzinfo=UTC)
TASK_ID = UUID("00000000-0000-0000-0000-000000000701")


def source(kind: str = "task_brief") -> ProjectionSource:
    return ProjectionSource(kind=kind, ref="demo-task", version="3", observed_at=NOW)


def match(*, status: MatchStatus = MatchStatus.CALCULATED) -> MatchProjection:
    return MatchProjection(
        status=status,
        percent=Decimal("84") if status is MatchStatus.CALCULATED else None,
        coverage=Decimal("0.8"),
        algorithm_version="pending-policy-v1" if status is MatchStatus.CALCULATED else None,
        source_snapshot_version="evidence-12",
        calculated_at=NOW,
        reasons=(MatchReason("FORMAT_FIT", "Подходит формат", (source("profile"),)),)
        if status is MatchStatus.CALCULATED
        else (),
        missing_factors=() if status is MatchStatus.CALCULATED else ("verified_skill",),
    )


def plan() -> StagePlanProjection:
    return StagePlanProjection(
        version=2,
        stages=(
            StagePlanItem(
                key="research",
                position=1,
                title="Исследование",
                summary="Согласовать воспроизводимый baseline.",
                estimated_minutes=120,
                state=StagePlanState.PLANNED,
                expected_evidence=("baseline_report",),
            ),
            StagePlanItem(
                key="prototype",
                position=2,
                title="Прототип",
                summary="Подготовить проверяемый прототип.",
                estimated_minutes=None,
                state=StagePlanState.LOCKED,
                prerequisite_keys=("research",),
                expected_evidence=("repository", "demo"),
            ),
        ),
    )


def projection() -> TaskRecommendationProjection:
    return TaskRecommendationProjection(
        task_id=TASK_ID,
        schema_version=TASK_CATALOG_SCHEMA_VERSION,
        snapshot_version="catalog-17",
        brief_version=3,
        terms_version=4,
        title="Проверяемая рекомендательная система",
        customer=CustomerSummary(
            UUID("00000000-0000-0000-0000-000000000201"),
            "R&D Lab",
            CustomerVerification.DEMO,
        ),
        brief_summary="Создать измеримый прототип без доступа к закрытым данным.",
        competency_tags=("python", "api"),
        difficulty=None,
        duration_minutes=None,
        work_format="remote",
        places_total=3,
        places_available=2,
        deadline_at=NOW,
        eligibility=EligibilityProjection(EligibilityStatus.ELIGIBLE, ("PUBLISHED",)),
        match=match(),
        skill_impact=(
            SkillImpactProjection(
                skill_id="api-design",
                title="Проектирование API",
                status=ForecastStatus.QUALITATIVE,
                current_level="basic",
                projected_level=None,
                model_version=None,
                explanation="Задача содержит проверяемый API-артефакт.",
                sources=(source("competency_mapping"),),
            ),
        ),
        stage_plan=plan(),
        benefits=(),
        application_state=ApplicationState.NONE,
        allowed_actions=frozenset(
            {CatalogAction.OPEN_CONDITIONS, CatalogAction.APPLY, CatalogAction.BOOKMARK}
        ),
        sources=(source(),),
        generated_at=NOW,
    )


def test_one_projection_carries_card_list_and_permitted_detail_facts() -> None:
    item = projection()

    assert item.task_id == TASK_ID
    assert item.match.percent == Decimal("84")
    assert item.brief_summary.startswith("Создать")
    assert [stage.key for stage in item.stage_plan.stages] == ["research", "prototype"]
    assert item.stable_tie_breaker == str(TASK_ID)
    assert not hasattr(item, "task_progress")
    assert not hasattr(item.stage_plan.stages[0], "completed")


def test_projection_is_immutable_and_does_not_become_evidence_on_view_or_apply() -> None:
    item = projection()

    with pytest.raises(FrozenInstanceError):
        item.application_state = ApplicationState.SUBMITTED  # type: ignore[misc]
    assert item.skill_impact[0].verification_required is True


@pytest.mark.parametrize("value", [Decimal("-1"), Decimal("101")])
def test_calculated_match_is_bounded(value: Decimal) -> None:
    with pytest.raises(CatalogContractError, match=r"0\.\.100"):
        replace(match(), percent=value)


def test_insufficient_match_is_not_serialized_as_zero() -> None:
    insufficient = match(status=MatchStatus.INSUFFICIENT_DATA)

    assert insufficient.percent is None
    assert insufficient.missing_factors == ("verified_skill",)
    with pytest.raises(CatalogContractError, match="must not serialize"):
        replace(insufficient, percent=Decimal("0"))


def test_stage_plan_only_accepts_ordered_planned_or_locked_nodes() -> None:
    stages = plan().stages
    with pytest.raises(CatalogContractError, match="contiguous"):
        StagePlanProjection(version=1, stages=(replace(stages[0], position=2),))
    with pytest.raises(CatalogContractError, match="reference this plan"):
        StagePlanProjection(
            version=1,
            stages=(replace(stages[0], prerequisite_keys=("missing",)),),
        )
    with pytest.raises(CatalogContractError, match="must precede"):
        StagePlanProjection(
            version=1,
            stages=(
                replace(stages[0], prerequisite_keys=("prototype",)),
                stages[1],
            ),
        )
    assert {stage.state for stage in stages} == {StagePlanState.PLANNED, StagePlanState.LOCKED}


def test_ineligible_task_cannot_offer_apply() -> None:
    item = projection()
    blocked = EligibilityProjection(
        EligibilityStatus.INELIGIBLE,
        ("PREREQUISITE_GAP",),
        ("verified-python",),
    )

    with pytest.raises(CatalogContractError, match="cannot expose apply"):
        replace(item, eligibility=blocked)


def test_assigned_projection_links_to_workspace_without_catalog_progress() -> None:
    item = replace(
        projection(),
        application_state=ApplicationState.ASSIGNED,
        allowed_actions=frozenset({CatalogAction.OPEN_WORKSPACE}),
    )

    assert CatalogAction.OPEN_WORKSPACE in item.allowed_actions
    assert all(
        stage.state in {StagePlanState.PLANNED, StagePlanState.LOCKED}
        for stage in item.stage_plan.stages
    )
