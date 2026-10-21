"""Career roadmap and Bootcamp policy scenarios."""

from datetime import UTC, date, datetime, timedelta

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
from impulse.domain.engagement import (
    FREEZE_INVENTORY_CAP,
    FREEZE_POLICY_VERSION,
    EngagementRecord,
    EngagementSource,
    FreezeInventory,
    WeeklyRhythm,
    WeeklyRhythmError,
    engagement_calendar,
    engagement_day,
    frozen_calendar,
    preset_active_days,
    service_block_audit,
    weekly_rhythm_projection,
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


def _record(source: EngagementSource, ref: str, day: date) -> EngagementRecord:
    return EngagementRecord(source, ref, datetime(day.year, day.month, day.day, 21, 0, tzinfo=UTC))


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_first_qualifying_action_of_each_source_accrues_exactly_one_day() -> None:
    records = (
        _record(EngagementSource.PROJECT_SUBMISSION, "contribution-1", date(2026, 10, 18)),
        _record(EngagementSource.ACCEPTED_REVISION, "revision-7", date(2026, 10, 18)),
        _record(EngagementSource.COURSE_LEARNING, "course-day-1", date(2026, 10, 19)),
        _record(EngagementSource.VERIFIED_EVENT_PARTICIPATION, "event-3", date(2026, 10, 19)),
    )
    days = engagement_day(records, "Europe/Moscow")
    assert days == frozenset({date(2026, 10, 19), date(2026, 10, 20)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 20))
    assert calendar.current_days == 2
    assert calendar.best_days == 2
    assert calendar.today_saved is True
    assert calendar.grace_available is False


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_duplicate_source_ref_never_double_accrues() -> None:
    records = (
        _record(EngagementSource.PROJECT_SUBMISSION, "contribution-1", date(2026, 10, 18)),
        _record(EngagementSource.PROJECT_SUBMISSION, "contribution-1", date(2026, 10, 19)),
    )
    days = engagement_day(records, "Europe/Moscow")
    assert days == frozenset({date(2026, 10, 19)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 19))
    assert calendar.current_days == 1
    assert calendar.best_days == 1


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_second_qualifying_action_of_same_day_does_not_extend_streak() -> None:
    records = (
        _record(EngagementSource.PROJECT_SUBMISSION, "contribution-1", date(2026, 10, 18)),
        _record(EngagementSource.ACCEPTED_REVISION, "revision-7", date(2026, 10, 18)),
    )
    days = engagement_day(records, "Europe/Moscow")
    assert days == frozenset({date(2026, 10, 19)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 19))
    assert calendar.current_days == 1


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_calendar_keeps_best_run_after_current_break() -> None:
    base = date(2026, 9, 1)
    historical = frozenset(base + timedelta(days=offset) for offset in range(5))
    far = base + timedelta(days=30)
    calendar = engagement_calendar(
        historical | {far}, local_today=base + timedelta(days=32)
    )
    assert calendar.current_days == 0
    assert calendar.best_days == 5
    assert "прервана" in calendar.reason
    assert calendar.today_saved is False


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_empty_calendar_is_not_zero_streak_lie() -> None:
    calendar = engagement_calendar(frozenset(), local_today=date(2026, 10, 20))
    assert calendar.current_days == 0
    assert calendar.best_days == 0
    assert "первое квалифицируемое" in calendar.reason


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_freeze_inventory_grants_every_seven_best_days_capped() -> None:
    assert FREEZE_POLICY_VERSION == 1
    inventory = FreezeInventory(
        granted_total=0, available=0, consumed_total=0, next_grant_best_days=7
    )
    assert inventory.grants_due(6) == 0
    assert inventory.grants_due(7) == 1
    assert inventory.grants_due(20) == 2
    stocked = FreezeInventory(
        granted_total=2, available=1, consumed_total=1, next_grant_best_days=7
    )
    assert stocked.grants_due(20) == 0
    assert FREEZE_INVENTORY_CAP == 3
    full = FreezeInventory(granted_total=3, available=3, consumed_total=0, next_grant_best_days=7)
    assert full.grants_due(70) == 0


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_frozen_calendar_auto_consumes_single_missed_day() -> None:
    days = frozenset({date(2026, 10, 16), date(2026, 10, 17), date(2026, 10, 18)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 20))
    frozen = frozen_calendar(
        calendar, available=1, consumed=frozenset(), local_today=date(2026, 10, 20)
    )
    assert frozen.freeze_state == "frozen"
    assert frozen.current_days == 4
    assert frozen.frozen_dates == frozenset({date(2026, 10, 19)})
    assert frozen.qualified_dates == days
    assert frozen.grace_available is True
    assert "не считается активностью" in frozen.reason
    extended = engagement_calendar(
        days | {date(2026, 10, 19)}, local_today=date(2026, 10, 20)
    )
    assert extended.current_days == frozen.current_days
    assert extended.best_days == frozen.best_days


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_frozen_calendar_without_stock_keeps_honest_break() -> None:
    days = frozenset({date(2026, 10, 14)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 20))
    frozen = frozen_calendar(
        calendar, available=0, consumed=frozenset(), local_today=date(2026, 10, 20)
    )
    assert frozen.freeze_state == "break"
    assert "прервана" in frozen.reason
    assert frozen.current_days == 0
    assert frozen.frozen_dates == frozenset()


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_freeze_never_marks_frozen_day_as_activity() -> None:
    days = frozenset({date(2026, 10, 18)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 21))
    frozen = frozen_calendar(
        calendar, available=0, consumed=frozenset(), local_today=date(2026, 10, 21)
    )
    assert frozen.freeze_state == "break"
    assert frozen.today_saved is False
    assert "Служебный сбой" not in frozen.reason


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_frozen_calendar_never_reapplies_already_bridged_yesterday() -> None:
    days = frozenset({date(2026, 10, 18), date(2026, 10, 19)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 21))
    frozen = frozen_calendar(
        calendar,
        available=2,
        consumed=frozenset({date(2026, 10, 20)}),
        local_today=date(2026, 10, 21),
    )
    assert frozen.freeze_state == "idle"
    assert frozen.current_days == 3
    assert "заморозки за пропущенный день" in frozen.reason
    assert frozen.qualified_dates == days


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_bridge_survives_return_day_without_best_regression() -> None:
    """B3: freeze contributes durably once the user resumes activity."""
    before_bridge = engagement_calendar(
        frozenset({date(2026, 10, 18), date(2026, 10, 19)}), local_today=date(2026, 10, 21)
    )
    bridged = frozen_calendar(
        before_bridge,
        available=1,
        consumed=frozenset(),
        local_today=date(2026, 10, 21),
    )
    assert bridged.current_days == 3
    assert bridged.best_days == 3

    resumed = frozen_calendar(
        engagement_calendar(
            frozenset({date(2026, 10, 18), date(2026, 10, 19), date(2026, 10, 21)}),
            local_today=date(2026, 10, 21),
        ),
        available=0,
        consumed=frozenset({date(2026, 10, 20)}),
        local_today=date(2026, 10, 21),
    )
    assert resumed.current_days == 4
    assert resumed.best_days == 4
    assert resumed.freeze_state == "idle"
    assert resumed.qualified_dates == frozenset(
        {date(2026, 10, 18), date(2026, 10, 19), date(2026, 10, 21)}
    )


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_service_block_audit_never_consumes_freeze_stock() -> None:
    audit = service_block_audit(scope="provider_outage", explanation="LMS недоступен")
    assert "provider_outage" in audit
    assert "LMS недоступен" in audit
    assert "без расхода заморозки" in audit


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_idle_freeze_state_when_streak_is_alive() -> None:
    days = frozenset({date(2026, 10, 19)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 20))
    frozen = frozen_calendar(
        calendar, available=2, consumed=frozenset(), local_today=date(2026, 10, 20)
    )
    assert frozen.freeze_state == "idle"
    assert frozen.current_days == calendar.current_days
    assert frozen.reason == calendar.reason


def _rhythm(
    preset: str = "workdays",
    days: frozenset[int] | None = None,
    reminder_hour: int = 18,
    window: int = 3,
    effective_from: date = date(2026, 10, 19),
    version: int = 1,
) -> WeeklyRhythm:
    return WeeklyRhythm(
        version=version,
        preset=preset,
        active_days=days if days is not None else frozenset({1, 2, 3, 4, 5}),
        reminder_hour=reminder_hour,
        reminder_window_hours=window,
        effective_from=effective_from,
    )


@pytest.mark.spec("participant-experience/weekly-rhythm")
def test_weekly_rhythm_presets_map_iso_weekdays_and_reject_bad_custom() -> None:
    assert preset_active_days("workdays") == frozenset({1, 2, 3, 4, 5})
    assert preset_active_days("weekends") == frozenset({6, 7})
    assert preset_active_days("all_week") == frozenset({1, 2, 3, 4, 5, 6, 7})
    assert preset_active_days("twice_week") == frozenset({1, 4})
    assert preset_active_days("custom", [2, 6]) == frozenset({2, 6})
    with pytest.raises(WeeklyRhythmError) as unknown:
        preset_active_days("weekdays")
    assert unknown.value.code == "VALIDATION_ERROR"
    for bad in ([0, 2], [3, 8], []):
        with pytest.raises(WeeklyRhythmError):
            preset_active_days("custom", bad)
    assert preset_active_days("custom", [1, 1, 2]) == frozenset({1, 2})


@pytest.mark.spec("participant-experience/weekly-rhythm")
def test_weekly_rhythm_validates_reminder_hour_and_window() -> None:
    with pytest.raises(WeeklyRhythmError):
        _rhythm(reminder_hour=24)
    with pytest.raises(WeeklyRhythmError):
        _rhythm(reminder_hour=-1)
    with pytest.raises(WeeklyRhythmError):
        _rhythm(window=0)
    with pytest.raises(WeeklyRhythmError):
        _rhythm(window=7)


@pytest.mark.spec("participant-experience/weekly-rhythm")
def test_weekly_rhythm_projection_counts_qualified_only_within_contract_window() -> None:
    """Rhythm progress: only qualified dates on/after effective_from; never frozen days."""
    achieved = frozenset(
        {
            date(2026, 10, 19),
            date(2026, 10, 20),
            date(2026, 10, 21),
        }
    )
    projection = weekly_rhythm_projection(_rhythm(), achieved, local_today=date(2026, 10, 22))
    assert projection.version == 1
    assert (projection.week_start, projection.week_end) == (
        date(2026, 10, 19),
        date(2026, 10, 25),
    )
    assert projection.target_days == 5
    assert projection.done_days == 3
    assert "не тождественен серии" in projection.hint
    late_contract = weekly_rhythm_projection(
        _rhythm(effective_from=date(2026, 10, 21)), achieved, local_today=date(2026, 10, 22)
    )
    assert late_contract.done_days == 1
    future = weekly_rhythm_projection(
        _rhythm(effective_from=date(2026, 10, 23)), achieved, local_today=date(2026, 10, 22)
    )
    assert future.done_days == 0


@pytest.mark.spec("participant-experience/weekly-rhythm")
def test_weekly_rhythm_projection_ignores_dates_outside_iso_week() -> None:
    achieved = frozenset({date(2026, 10, 12), date(2026, 10, 18), date(2026, 10, 19)})
    projection = weekly_rhythm_projection(_rhythm(), achieved, local_today=date(2026, 10, 22))
    assert projection.done_days == 1


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_out_of_stock_state_for_yesterday_miss() -> None:
    days = frozenset({date(2026, 10, 18)})
    calendar = engagement_calendar(days, local_today=date(2026, 10, 20))
    frozen = frozen_calendar(
        calendar, available=0, consumed=frozenset(), local_today=date(2026, 10, 20)
    )
    assert frozen.freeze_state == "out_of_stock" or frozen.freeze_state == "break"
    assert frozen.qualified_dates == frozenset({date(2026, 10, 18)})
