"""Rating policy and season lifecycle tests."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from impulse.domain.recognition import (
    CohortMember,
    CohortRule,
    DiplomaThreshold,
    LeaderboardCandidate,
    RatingPolicy,
    RatingPolicyError,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    SeasonStatus,
    Standing,
    TieBreaker,
    TrophyProof,
    public_leaderboard,
    rebuild_standings,
)


def complete_policy(season_id: UUID | None = None) -> RatingPolicy:
    return RatingPolicy(
        policy_id=uuid4(),
        season_id=season_id or uuid4(),
        version=1,
        cohort=CohortRule("python-autumn", "Python · осень", "impulse-demo", ("python",), 10),
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
            policy.policy_id,
            policy.season_id,
            1,
            policy.cohort,
            (),
            policy.tie_breakers,
            policy.diploma_thresholds,
            14,
        )
    with pytest.raises(RatingPolicyError):
        RatingPolicy(
            policy.policy_id,
            policy.season_id,
            1,
            policy.cohort,
            policy.sources,
            (),
            policy.diploma_thresholds,
            14,
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


def test_rebuild_applies_corrections_ties_caps_and_cohort_boundary() -> None:
    season_id = uuid4()
    first, second, outsider = uuid4(), uuid4(), uuid4()
    policy = replace(
        complete_policy(season_id),
        cohort=CohortRule("python", "Python", "demo", ("python",), 2),
        sources=(ScoreSourceRule("project", "project", Decimal("2"), Decimal("100")),),
        tie_breakers=(TieBreaker.SUCCESSFUL_PROJECTS, TieBreaker.PERSON_ID),
    )
    now = datetime(2026, 9, 1, tzinfo=UTC)
    first_source, second_source = uuid4(), uuid4()
    original_id = uuid4()
    entries = (
        ScoreEntry(
            original_id, season_id, first, "project", first_source, "project", Decimal("60"), now
        ),
        ScoreEntry(
            uuid4(),
            season_id,
            first,
            "project",
            first_source,
            "project",
            Decimal("-10"),
            now + timedelta(days=1),
            correction_of=original_id,
            correction_reason="Accepted score was corrected.",
        ),
        ScoreEntry(
            uuid4(), season_id, second, "project", second_source, "project", Decimal("50"), now
        ),
        ScoreEntry(
            uuid4(), season_id, outsider, "project", uuid4(), "project", Decimal("500"), now
        ),
    )
    members = (
        CohortMember(first, "demo", ("python",)),
        CohortMember(second, "demo", ("python",)),
        CohortMember(outsider, "another-program", ("python",)),
    )

    result = rebuild_standings(policy, members, entries)

    assert [item.person_id for item in result] == sorted((first, second), key=str)
    assert [item.place for item in result] == [1, 2]
    assert [item.score for item in result] == [Decimal("100"), Decimal("100")]
    assert all(item.successful_projects == 1 for item in result)
    assert outsider not in {item.person_id for item in result}


def test_score_correction_requires_reason_and_original_must_be_positive() -> None:
    now = datetime.now(UTC)
    with pytest.raises(RatingPolicyError):
        ScoreEntry(uuid4(), uuid4(), uuid4(), "project", uuid4(), "project", Decimal("0"), now)
    with pytest.raises(RatingPolicyError):
        ScoreEntry(
            uuid4(),
            uuid4(),
            uuid4(),
            "project",
            uuid4(),
            "project",
            Decimal("-1"),
            now,
            correction_of=uuid4(),
        )


def test_public_leaderboard_anonymizes_without_consent_and_hides_trophies() -> None:
    season_id = uuid4()
    visible_id, hidden_id = uuid4(), uuid4()
    proof = TrophyProof("winner", "Python Hack", "https://example.test/event")
    candidates = (
        LeaderboardCandidate(
            Standing(season_id, hidden_id, 1, Decimal("120"), 2, Decimal("80"), None),
            "Hidden Person",
            rating_visible=False,
            trophies_visible=True,
            trophies=(proof,),
        ),
        LeaderboardCandidate(
            Standing(season_id, visible_id, 2, Decimal("100"), 1, Decimal("100"), None),
            "Visible Person",
            rating_visible=True,
            trophies_visible=True,
            trophies=(proof,),
        ),
    )

    result = public_leaderboard(candidates)

    assert result[0].place == 1
    assert result[0].person_id is None
    assert result[0].display_name == "Участник рейтинга"
    assert result[0].trophies == ()
    assert result[1].person_id == visible_id
    assert result[1].display_name == "Visible Person"
    assert result[1].trophies == (proof,)
    assert result[1].offers == ()
