"""Career roadmap and Bootcamp policy scenarios."""

from datetime import UTC, date, datetime

import pytest

from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    RoadmapProjection,
    TrackAttempt,
    TrackPolicyError,
    TrackStatus,
    calculate_streak,
    local_learning_days,
    rating_eligible,
    recalculate_roadmap,
    select_track,
)


def attempt(key: str, status: TrackStatus, *completed: str) -> TrackAttempt:
    return TrackAttempt(key, 1, status, frozenset(completed))


@pytest.mark.spec("career-roadmap/second-track")
def test_participant_can_choose_two_tracks_without_mentor_approval() -> None:
    result = select_track((attempt("python", TrackStatus.ACTIVE),), "data")
    assert [item.track_key for item in result.attempts if item.status is TrackStatus.ACTIVE] == [
        "python",
        "data",
    ]
    assert not result.mentor_approval_required


@pytest.mark.spec("career-roadmap/change-interest")
def test_third_track_requires_explicit_freeze_and_preserves_history_without_penalty() -> None:
    current = (
        attempt("python", TrackStatus.ACTIVE, "foundation"),
        attempt("data", TrackStatus.ACTIVE),
    )
    with pytest.raises(TrackPolicyError, match="Выберите") as missing_choice:
        select_track(current, "product")
    assert missing_choice.value.code == "TRACK_SLOT_REQUIRED"

    result = select_track(current, "product", freeze_track_key="python")
    python = next(item for item in result.attempts if item.track_key == "python")
    assert python.status is TrackStatus.FROZEN
    assert python.completed_milestones == frozenset({"foundation"})
    assert result.frozen == "python"
    assert not result.public_penalty


@pytest.mark.spec("career-roadmap/return-after-month")
def test_frozen_track_reactivates_with_completed_progress() -> None:
    current = (
        attempt("python", TrackStatus.FROZEN, "foundation"),
        attempt("data", TrackStatus.ACTIVE),
        attempt("product", TrackStatus.ACTIVE),
    )
    result = select_track(current, "python", freeze_track_key="product")
    restored = next(item for item in result.attempts if item.track_key == "python")
    assert restored.status is TrackStatus.ACTIVE
    assert restored.completed_milestones == frozenset({"foundation"})


@pytest.mark.spec("career-roadmap/open-step")
def test_roadmap_recalculation_preserves_confirmed_steps_and_explains_replacement() -> None:
    previous = RoadmapProjection(
        track_key="python",
        policy_version=1,
        milestones=(),
        completed_keys=frozenset({"foundation", "obsolete"}),
    )
    milestones = (
        RoadmapMilestone(
            "foundation", 1, "Основы", "Понять базовый синтаксис", "Python", "course", "python-base"
        ),
        RoadmapMilestone("api", 2, "API", "Собрать рабочий сервис", "FastAPI", "course", "fastapi"),
    )
    result = recalculate_roadmap(
        previous,
        track_key="python",
        policy_version=2,
        milestones=milestones,
    )
    assert result.completed_keys == frozenset({"foundation"})
    assert result.next_step == milestones[1]
    assert result.next_step is not None
    assert result.next_step.purpose == "Собрать рабочий сервис"
    assert result.replacement_reason is not None


def test_learning_day_uses_participant_timezone_and_deduplicates_day() -> None:
    events = (
        datetime(2026, 9, 27, 18, 0, tzinfo=UTC),
        datetime(2026, 9, 27, 19, 0, tzinfo=UTC),
        datetime(2026, 9, 27, 22, 0, tzinfo=UTC),
        datetime(2026, 9, 28, 22, 0, tzinfo=UTC),
    )
    days = local_learning_days(events, "Europe/Moscow")
    assert days == frozenset({date(2026, 9, 27), date(2026, 9, 28), date(2026, 9, 29)})
    assert calculate_streak(days, local_today=date(2026, 9, 29)).current_days == 3


def test_streak_explains_break_and_only_verified_completion_is_rating_eligible() -> None:
    result = calculate_streak(frozenset({date(2026, 9, 20)}), local_today=date(2026, 9, 27))
    assert result.current_days == 0
    assert "прервана" in result.reason
    assert rating_eligible(CompletionStatus.VERIFIED)
    assert not rating_eligible(CompletionStatus.REPORTED)
    assert not rating_eligible(CompletionStatus.REJECTED)
