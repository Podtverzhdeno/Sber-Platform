"""Contract validation of the TC-018 synthetic fixture set."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from synthetic_fixtures import (
    FIXTURES,
    FIXTURES_BY_KEY,
    SupportModel,
    SyntheticTaskTerms,
    task_uuid,
)

from impulse.application.task_catalog import (
    ApplicationState,
    BenefitState,
    CatalogAction,
    CatalogContractError,
    EligibilityStatus,
    MatchStatus,
    StagePlanState,
)

REQUIRED_COVERED_KEYS = (
    "eligible-high-coverage",
    "eligible-low-coverage",
    "ineligible-prerequisite-gap",
    "unknown-eligibility",
    "no-deadline",
    "paid-seven-stages",
    "unpaid-seven-stages",
)


def test_fixture_set_is_unique_and_deterministic() -> None:
    keys = [fixture.key for fixture in FIXTURES]
    assert len(keys) == len(set(keys))
    assert FIXTURES_BY_KEY.keys() >= set(REQUIRED_COVERED_KEYS)
    for fixture in FIXTURES:
        assert fixture.projection.task_id == task_uuid(fixture.key)
        assert fixture.projection.snapshot_version == "evidence-synthetic-000"
        assert fixture.projection.generated_at == datetime(2026, 10, 22, 12, 0, tzinfo=UTC)


def test_every_fixture_satisfies_the_catalog_contract() -> None:
    for fixture in FIXTURES:
        projection = fixture.projection
        assert isinstance(fixture.terms, SyntheticTaskTerms)
        assert projection.brief_version >= 1 and projection.terms_version >= 1
        assert projection.sources
        assert projection.stage_plan.stages
        # the same payload family stays honest under contract invariants
        if projection.eligibility.status is not EligibilityStatus.ELIGIBLE:
            assert CatalogAction.APPLY not in projection.allowed_actions
        if projection.application_state is ApplicationState.ASSIGNED:
            assert CatalogAction.OPEN_WORKSPACE in projection.allowed_actions


def test_covered_eligibility_dimensions() -> None:
    statuses = {fixture.projection.eligibility.status for fixture in FIXTURES}
    expected = {
        EligibilityStatus.ELIGIBLE,
        EligibilityStatus.INELIGIBLE,
        EligibilityStatus.UNKNOWN,
    }
    assert statuses == expected


def test_covered_score_coverage_extremes() -> None:
    by_key = FIXTURES_BY_KEY
    high = by_key["eligible-high-coverage"].projection.match
    low = by_key["eligible-low-coverage"].projection.match
    assert high.status is MatchStatus.CALCULATED and high.coverage > Decimal("0.5")
    assert low.status is MatchStatus.CALCULATED and Decimal("0") < low.coverage <= Decimal("0.5")
    unknown = by_key["unknown-eligibility"].projection.match
    assert unknown.status is MatchStatus.INSUFFICIENT_DATA
    assert unknown.percent is None
    assert unknown.missing_factors


def test_covered_deadlines() -> None:
    deadlines = [fixture.projection.deadline_at for fixture in FIXTURES]
    assert any(deadline is None for deadline in deadlines)
    cutoff = datetime(2026, 11, 1, tzinfo=UTC)
    assert any(d is not None and d > cutoff for d in deadlines)
    assert any(d is not None and d <= cutoff for d in deadlines)


def test_covered_support_models() -> None:
    supports = {fixture.terms.support for fixture in FIXTURES}
    assert supports == set(SupportModel)


def test_covered_paid_and_unpaid_terms() -> None:
    paid_flags = {fixture.terms.paid for fixture in FIXTURES}
    assert paid_flags == {True, False}


@pytest.mark.parametrize("stage_count", (3, 5, 7))
def test_covered_stage_plan_sizes(stage_count: int) -> None:
    plans = [
        fixture.projection.stage_plan
        for fixture in FIXTURES
        if len(fixture.projection.stage_plan.stages) == stage_count
    ]
    assert plans, f"no fixture covers a {stage_count}-stage plan"
    for plan in plans:
        assert [stage.position for stage in plan.stages] == list(range(1, stage_count + 1))
        assert all(stage.state is StagePlanState.PLANNED for stage in plan.stages)


def test_covered_terms_versions() -> None:
    version_pairs = {
        (fixture.projection.brief_version, fixture.projection.terms_version) for fixture in FIXTURES
    }
    assert (1, 1) in version_pairs
    assert (2, 3) in version_pairs
    assert len({pair[1] for pair in version_pairs}) > 1


def test_covered_application_states() -> None:
    states = {fixture.projection.application_state for fixture in FIXTURES}
    assert states == set(ApplicationState)


def test_action_sets_follow_application_state() -> None:
    by_state = {
        fixture.projection.application_state: fixture.projection.allowed_actions
        for fixture in FIXTURES
        if fixture.projection.application_state is not ApplicationState.NONE
    }
    all_actions = {action for actions in by_state.values() for action in actions}
    assert CatalogAction.APPLY not in all_actions
    assert CatalogAction.OPEN_APPLICATION in by_state[ApplicationState.SUBMITTED]
    assert CatalogAction.OPEN_APPLICATION in by_state[ApplicationState.UNDER_REVIEW]
    assert CatalogAction.OPEN_WORKSPACE in by_state[ApplicationState.ASSIGNED]
    assert by_state[ApplicationState.UNAVAILABLE] == frozenset(
        {CatalogAction.OPEN_CONDITIONS, CatalogAction.BOOKMARK, CatalogAction.SHARE}
    )


def test_benefits_stay_potential_or_actual_with_sources() -> None:
    for fixture in FIXTURES:
        for benefit in fixture.projection.benefits:
            assert benefit.state in (BenefitState.POTENTIAL, BenefitState.ACTUAL)
            assert benefit.sources


def test_no_real_personal_data_in_labels() -> None:
    banned_fragments = ("@", "http", "https", "+7", "тел.")
    for fixture in FIXTURES:
        text = " ".join(
            (
                fixture.projection.title,
                fixture.projection.brief_summary,
                fixture.projection.customer.display_name,
                *(stage.summary for stage in fixture.projection.stage_plan.stages),
            )
        ).lower()
        assert not any(fragment in text for fragment in banned_fragments)
        # fixture customers are explicitly synthetic demo personas
        assert "синтетический" in fixture.projection.customer.display_name.lower()


def test_fixture_cannot_violate_contract_through_public_builder() -> None:
    from synthetic_fixtures import build_raw_projection

    with pytest.raises((CatalogContractError, ValueError)):
        build_raw_projection(
            "invalid-stage-count",
            title="Недопустимый план",
            brief_summary="Некорректный fixture",
            eligibility=None,  # type: ignore[arg-type]
            match=None,  # type: ignore[arg-type]
            stage_count=4,
            application_state=ApplicationState.NONE,
            deadline=None,
            brief_version=1,
            terms_version=1,
            difficulty=None,
            duration_minutes=None,
            places_total=1,
            places_available=None,
            work_format="удалённо",
            allowed_actions=frozenset({CatalogAction.OPEN_CONDITIONS}),
            customer=None,  # type: ignore[arg-type]
            skill_impact=(),
        )
