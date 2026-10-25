"""Weekly rhythm counts evidence only on planned ISO weekdays, not arbitrary streak days."""

from datetime import date

from impulse.domain.engagement import WeeklyRhythm, weekly_rhythm_projection


def test_rhythm_counts_only_selected_weekdays() -> None:
    rhythm = WeeklyRhythm(
        version=1,
        preset="custom",
        active_days=frozenset({1, 4}),
        reminder_hour=18,
        reminder_window_hours=3,
        effective_from=date(2026, 10, 19),
    )
    result = weekly_rhythm_projection(
        rhythm,
        frozenset(
            {
                date(2026, 10, 19),  # Monday: selected
                date(2026, 10, 20),  # Tuesday: streak yes, rhythm no
                date(2026, 10, 22),  # Thursday: selected
                date(2026, 10, 24),  # Saturday: streak yes, rhythm no
            }
        ),
        local_today=date(2026, 10, 25),
    )
    assert result.target_days == 2
    assert result.done_days == 2


def test_rhythm_does_not_backfill_before_effective_date() -> None:
    rhythm = WeeklyRhythm(
        version=2,
        preset="workdays",
        active_days=frozenset({1, 2, 3, 4, 5}),
        reminder_hour=9,
        reminder_window_hours=2,
        effective_from=date(2026, 10, 22),
    )
    result = weekly_rhythm_projection(
        rhythm,
        frozenset({date(2026, 10, 19), date(2026, 10, 21), date(2026, 10, 22)}),
        local_today=date(2026, 10, 25),
    )
    assert result.done_days == 1
    assert result.target_days == 5
