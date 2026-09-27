"""Rating policy and season lifecycle tests."""
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingPolicyError,
    RatingSeason,
    ScoreSourceRule,
    SeasonStatus,
    TieBreaker,
)


def complete_policy(season_id: UUID | None = None) -> RatingPolicy:
    return RatingPolicy(
        policy_id=uuid4(),
        season_id=season_id or uuid4(),
        version=1,
        cohort=CohortRule(
            "python-autumn", "Python · осень", "impulse-demo", ("python",), 10
        ),
        sources=(
            ScoreSourceRule("accepted-project", "project", Decimal("1"), Decimal("600")),
            ScoreSourceRule("review-5plus", "review", Decimal("0.5"), Decimal("200")),
            ScoreSourceRule("verified-event", "event", Decimal("0.25"), Decimal("100")),
        ),
        tie_breakers=(TieBreaker.SUCCESSFUL_PROJECTS, TieBreaker.EARLIEST_ACHIEVEMENT),
        diploma_thresholds=(
            DiplomaThreshold("gold", 1, 3, "Диплом I степени"),
            DiplomaThreshold("silver", 4, 10, "Диплом II степени"),
        ),
        appeal_period_days=14,
    )


def test_complete_policy_opens_season_and_freezes_exact_version() -> None:
    season = RatingSeason(uuid4(), "autumn-2026", "Осень 2026")
    policy = complete_policy(season.season_id)

    opened = season.open(policy)

    assert opened.status is SeasonStatus.OPEN
    assert opened.policy_version == 1
    assert opened.version == 2


def test_incomplete_or_ambiguous_policy_is_rejected() -> None:
    policy = complete_policy()
    with pytest.raises(RatingPolicyError):
        RatingPolicy(
            policy.policy_id, policy.season_id, 1, policy.cohort, (),
            policy.tie_breakers, policy.diploma_thresholds, 14,
        )
    with pytest.raises(RatingPolicyError):
        RatingPolicy(
            policy.policy_id, policy.season_id, 1, policy.cohort, policy.sources,
            (), policy.diploma_thresholds, 14,
        )
    with pytest.raises(RatingPolicyError):
        RatingPolicy(
            policy.policy_id,
            policy.season_id,
            1,
            policy.cohort,
            policy.sources,
            policy.tie_breakers,
            (
                DiplomaThreshold("gold", 1, 5, "I"),
                DiplomaThreshold("silver", 5, 10, "II"),
            ),
            14,
        )


def test_weights_and_caps_require_decimal() -> None:
    with pytest.raises(RatingPolicyError):
        ScoreSourceRule("project", "project", 1, Decimal("100"))  # type: ignore[arg-type]
