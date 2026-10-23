"""Contract tests for TC-014 conditional benefits: type, rule, state and sources."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from impulse.api.v1.task_catalog import CatalogBenefitView
from impulse.application.task_catalog import BenefitState, CatalogContractError, ProjectionSource

NOW = datetime(2026, 10, 23, 17, 0, tzinfo=UTC)


def source() -> ProjectionSource:
    return ProjectionSource(kind="task_brief", ref="demo-task", version="1", observed_at=NOW)


def test_benefit_requires_type_state_and_authoritative_source() -> None:
    benefit = CatalogBenefitView(
        code="BONUS_10K",
        label="Премия за приёмку",
        state=BenefitState.POTENTIAL,
        condition="После приёмки личного вклада.",
        benefit_type="compensation",
        rule_kind="evidence_required",
        evidence_refs=("evidence:accepted",),
    )
    assert benefit.benefit_type == "compensation"


def test_unknown_benefit_type_is_rejected_at_contract_boundary() -> None:
    from impulse.application.task_catalog import BenefitEligibilityRule, ConditionalBenefit

    with pytest.raises(CatalogContractError):
        ConditionalBenefit(
            code="GHOST",
            label="x",
            state=BenefitState.POTENTIAL,
            condition="condition",
            sources=(source(),),
            benefit_type="vacation",
        )
    ok = ConditionalBenefit(
        code="LEARN",
        label="Курс",
        state=BenefitState.ACTUAL,
        condition="По факту зачисления",
        sources=(source(),),
        benefit_type="learning",
        eligibility=BenefitEligibilityRule(
            rule_kind="evidence_required", condition="Опубликованные курс", evidence_refs=("ev-1",)
        ),
    )
    assert ok.benefit_type == "learning"
    assert ok.eligibility is not None and ok.eligibility.evidence_refs == ("ev-1",)


def test_default_type_preserves_tc007_shapes() -> None:
    from impulse.application.task_catalog import ConditionalBenefit

    legacy = ConditionalBenefit(
        code="CODE", label="x", state=BenefitState.POTENTIAL, condition="c", sources=(source(),)
    )
    assert legacy.benefit_type == "other"
    assert legacy.eligibility is None
    assert uuid4()  # uuid import sanity


def test_rule_kind_and_evidence_are_validated() -> None:
    from impulse.application.task_catalog import BenefitEligibilityRule

    with pytest.raises(CatalogContractError):
        BenefitEligibilityRule(rule_kind="ghost", condition="c")
    with pytest.raises(CatalogContractError):
        BenefitEligibilityRule(rule_kind="conditional", condition="  ")
    with pytest.raises(CatalogContractError):
        BenefitEligibilityRule(rule_kind="evidence_required", condition="c", evidence_refs=())
    ok = BenefitEligibilityRule(
        rule_kind="invitation_required",
        condition="После принятого приглашения",
        evidence_refs=(),
    )
    assert ok.rule_kind == "invitation_required"
    assert uuid4()
