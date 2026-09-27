"""Property and boundary tests for deterministic compensation policy."""

from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st

from impulse.domain.reward import (
    CompensationPolicyError,
    CompensationTerms,
    CriterionAssessment,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    RoundingMode,
    RubricCriterion,
)


def paid_terms(**overrides: object) -> CompensationTerms:
    values: dict[str, object] = {
        "paid": True,
        "base_amount_per_assignee": Decimal("1000.00"),
        "currency": "RUB",
        "a_multiplier": Decimal("2.5"),
        "quantum": Decimal("0.01"),
        "rounding_mode": RoundingMode.HALF_UP,
        "policy_version": 1,
        "payout_condition": "Принятый вклад и опубликованная человеком оценка.",
    }
    values.update(overrides)
    return CompensationTerms(**values)  # type: ignore[arg-type]


@given(
    base=st.decimals(min_value="0.01", max_value="1000000000", places=2),
    a_multiplier=st.decimals(min_value="2.00", max_value="3.00", places=2),
)
def test_premium_totals_use_decimal_and_published_multipliers(
    base: Decimal, a_multiplier: Decimal
) -> None:
    terms = paid_terms(base_amount_per_assignee=base, a_multiplier=a_multiplier)
    assert terms.premium_total("B") == (base * Decimal("1.5")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    assert terms.premium_total("A") == (base * a_multiplier).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


@pytest.mark.parametrize("a_multiplier", [Decimal("1.99"), Decimal("3.01")])
def test_a_multiplier_outside_published_boundary_is_rejected(a_multiplier: Decimal) -> None:
    with pytest.raises(CompensationPolicyError):
        paid_terms(a_multiplier=a_multiplier)


def test_quantum_and_rounding_are_part_of_the_snapshot() -> None:
    half_up = paid_terms(
        base_amount_per_assignee=Decimal("10.05"),
        a_multiplier=Decimal("2"),
        quantum=Decimal("0.05"),
        rounding_mode=RoundingMode.HALF_UP,
    )
    down = paid_terms(
        base_amount_per_assignee=Decimal("10.05"),
        a_multiplier=Decimal("2"),
        quantum=Decimal("0.05"),
        rounding_mode=RoundingMode.DOWN,
    )
    assert half_up.premium_total("B") == Decimal("15.10")
    assert down.premium_total("B") == Decimal("15.05")


def test_unpaid_terms_never_expose_premium_total() -> None:
    terms = CompensationTerms(
        paid=False,
        base_amount_per_assignee=None,
        currency=None,
        a_multiplier=Decimal("2"),
        quantum=Decimal("0.01"),
        rounding_mode=RoundingMode.HALF_EVEN,
        policy_version=1,
        payout_condition="Вознаграждение не предусмотрено.",
    )
    assert terms.premium_total("A") is None
    assert terms.premium_total("B") is None


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("base_amount_per_assignee", Decimal("0")),
        ("currency", "rub"),
        ("b_multiplier", Decimal("1.6")),
        ("quantum", Decimal("0")),
        ("policy_version", 0),
        ("payout_condition", " "),
    ],
)
def test_invalid_policy_is_rejected(field: str, value: object) -> None:
    with pytest.raises(CompensationPolicyError):
        paid_terms(**{field: value})


def test_binary_float_is_rejected() -> None:
    with pytest.raises(CompensationPolicyError):
        paid_terms(a_multiplier=2.5)


def rubric() -> ReviewRubric:
    return ReviewRubric(
        rubric_id=uuid4(),
        key="demo-5plus",
        version=2,
        criteria=(
            RubricCriterion("quality", "Качество результата"),
            RubricCriterion("ownership", "Самостоятельность"),
        ),
    )


def review_draft(*, origin: str = "ai_suggestion") -> Review5Plus:
    current_rubric = rubric()
    return Review5Plus.draft(
        review_id=uuid4(),
        contribution_id=uuid4(),
        contribution_version=3,
        rubric=current_rubric,
        grade=ReviewGrade.B,
        assessments=(
            CriterionAssessment("quality", "MVP воспроизводится.", ("artifact:mvp",)),
            CriterionAssessment("ownership", "Авторство подтверждено.", ("commit:42",)),
        ),
        explanation="Участник выполнил критерии B и приложил проверяемые факты.",
        draft_origin=origin,
    )


def test_review_requires_every_rubric_criterion_and_evidence() -> None:
    current_rubric = rubric()
    with pytest.raises(CompensationPolicyError, match="каждому критерию"):
        Review5Plus.draft(
            review_id=uuid4(),
            contribution_id=uuid4(),
            contribution_version=1,
            rubric=current_rubric,
            grade=ReviewGrade.A,
            assessments=(CriterionAssessment("quality", "Результат сильный.", ("artifact:mvp",)),),
            explanation="Недостаточно полного покрытия рубрики.",
            draft_origin="human",
        )
    with pytest.raises(CompensationPolicyError, match="доказательство"):
        CriterionAssessment("quality", "Результат сильный.", ())


def test_ai_draft_stays_non_final_until_explicit_human_confirmation() -> None:
    human_id = uuid4()
    draft = review_draft()
    assert draft.status is ReviewStatus.DRAFT
    proposed = draft.propose()
    assert proposed.status is ReviewStatus.PROPOSED
    assert proposed.confirmed_by is None
    with pytest.raises(CompensationPolicyError, match="ожидается human_confirmed"):
        proposed.publish(
            human_id,
            contribution_accepted=True,
            authorship_conflict_open=False,
        )
    confirmed = proposed.confirm(human_id)
    published = confirmed.publish(
        human_id,
        contribution_accepted=True,
        authorship_conflict_open=False,
    )
    assert published.status is ReviewStatus.PUBLISHED
    assert published.confirmed_by == human_id
    assert published.published_by == human_id
    assert published.review_version == 4


def test_open_authorship_conflict_blocks_review_publication() -> None:
    human_id = uuid4()
    confirmed = review_draft(origin="human").propose().confirm(human_id)
    with pytest.raises(CompensationPolicyError, match="конфликт авторства"):
        confirmed.publish(
            human_id,
            contribution_accepted=True,
            authorship_conflict_open=True,
        )


def test_review_cannot_be_published_for_unaccepted_contribution_or_another_human() -> None:
    confirmer = uuid4()
    confirmed = review_draft(origin="human").propose().confirm(confirmer)
    with pytest.raises(CompensationPolicyError, match="принятого личного вклада"):
        confirmed.publish(
            confirmer,
            contribution_accepted=False,
            authorship_conflict_open=False,
        )
    with pytest.raises(CompensationPolicyError, match="подтвердивший"):
        confirmed.publish(
            uuid4(),
            contribution_accepted=True,
            authorship_conflict_open=False,
        )
