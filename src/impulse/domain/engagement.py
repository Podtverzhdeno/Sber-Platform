"""Qualified engagement: one accrual day per first qualifying action."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import StrEnum
from itertools import pairwise

from impulse.domain.development import local_learning_days


class EngagementSource(StrEnum):
    """Actions that qualify a learning day; passive events never accrue."""

    COURSE_LEARNING = "course_learning"
    PROJECT_SUBMISSION = "project_submission"
    ACCEPTED_REVISION = "accepted_revision"
    VERIFIED_EVENT_PARTICIPATION = "verified_event_participation"

    @property
    def label(self) -> str:
        return {
            EngagementSource.COURSE_LEARNING: "Прогресс по курсу",
            EngagementSource.PROJECT_SUBMISSION: "Содержательная отправка в проект",
            EngagementSource.ACCEPTED_REVISION: "Принятое исправление",
            EngagementSource.VERIFIED_EVENT_PARTICIPATION: "Подтверждённое участие в событии",
        }[self]


NON_QUALIFYING_HINT = (
    "Вход, клики и сообщения не квалифицируют день; начисление требует квалифицируемых источников."
)


@dataclass(frozen=True, slots=True)
class EngagementRecord:
    source: EngagementSource
    source_ref: str
    occurred_at: datetime


@dataclass(frozen=True, slots=True)
class EngagementCalendar:
    current_days: int
    best_days: int
    qualified_dates: frozenset[date]
    reason: str
    today_saved: bool
    grace_available: bool

    def user_dates(self) -> tuple[date, ...]:
        return tuple(sorted(self.qualified_dates))

    @property
    def freeze_state(self) -> str:
        return "idle"


def _longest_run(dates: frozenset[date]) -> int:
    if not dates:
        return 0
    ordered = sorted(dates)
    best = 1
    run = 1
    for previous, current in pairwise(ordered):
        run = run + 1 if (current - previous).days == 1 else 1
        best = max(best, run)
    return best


def engagement_calendar(
    qualified_dates: frozenset[date], *, local_today: date
) -> EngagementCalendar:
    """Current streak keeps the existing «yesterday grace» contract; best run is historical."""
    if not qualified_dates:
        return EngagementCalendar(
            current_days=0,
            best_days=0,
            qualified_dates=qualified_dates,
            reason="Выполните первое квалифицируемое действие, чтобы начать серию.",
            today_saved=False,
            grace_available=False,
        )
    latest = max(qualified_dates)
    gap = (local_today - latest).days
    if gap > 1:
        return EngagementCalendar(
            current_days=0,
            best_days=_longest_run(qualified_dates),
            qualified_dates=qualified_dates,
            reason="Серия прервана: последний квалифицированный день был раньше вчерашнего.",
            today_saved=False,
            grace_available=False,
        )
    days = 0
    cursor = latest
    while cursor in qualified_dates:
        days += 1
        cursor -= timedelta(days=1)
    return EngagementCalendar(
        current_days=days,
        best_days=_longest_run(qualified_dates),
        qualified_dates=qualified_dates,
        reason=(
            "Серия сохранена сегодняшним квалифицируемым действием."
            if latest == local_today
            else "Серия сохранена вчерашним действием; квалифицируемый шаг сегодня её продолжит."
        ),
        today_saved=latest == local_today,
        grace_available=latest < local_today,
    )


def engagement_day(records: tuple[EngagementRecord, ...], timezone: str) -> frozenset[date]:
    """Local-day projection; identical source refs collapse before projection."""
    unique: dict[tuple[EngagementSource, str], datetime] = {}
    for record in records:
        unique.setdefault((record.source, record.source_ref), record.occurred_at)
    return local_learning_days(tuple(unique.values()), timezone)


FREEZE_POLICY_VERSION = 1
FREEZE_GRANT_MILESTONE_DAYS = 7
FREEZE_INVENTORY_CAP = 3


@dataclass(frozen=True, slots=True)
class FreezeInventory:
    granted_total: int
    available: int
    consumed_total: int
    next_grant_best_days: int

    def grants_due(self, best_days: int) -> int:
        """Versioned rule v1: every 7 best-run days grant one freeze, capped inventory."""
        due = min(best_days // FREEZE_GRANT_MILESTONE_DAYS, FREEZE_INVENTORY_CAP)
        return max(due - self.granted_total, 0)


@dataclass(frozen=True, slots=True)
class FrozenEngagementCalendar:
    current_days: int
    best_days: int
    qualified_dates: frozenset[date]
    frozen_dates: frozenset[date]
    reason: str
    today_saved: bool
    grace_available: bool
    freeze_state: str
    consumed_dates: frozenset[date]


def _covered_runs(covered: frozenset[date], *, local_today: date) -> tuple[int, int]:
    """Current and best runs over qualified days union persisted freeze days."""
    if not covered:
        return 0, 0
    latest = max(covered)
    current = 0
    if (local_today - latest).days <= 1:
        cursor = latest
        while cursor in covered:
            current += 1
            cursor -= timedelta(days=1)
    return current, _longest_run(covered)


def frozen_calendar(
    calendar: EngagementCalendar,
    available: int,
    consumed: frozenset[date],
    *,
    local_today: date,
) -> FrozenEngagementCalendar:
    """Freeze extends the current streak once when yesterday was missed and stock exists.

    Freeze days are audit-visible and never count as activity: they are excluded from
    qualified_dates and appear only in frozen_dates with a dedicated reason. Persisted
    frozen days still carry the streak: runs are computed over qualified dates union
    frozen dates, so a bridged miss survives the return day.
    """
    yesterday = local_today - timedelta(days=1)
    covered = frozenset(calendar.qualified_dates) | frozenset(consumed)
    covered_current, covered_best = _covered_runs(covered, local_today=local_today)
    latest = max(calendar.qualified_dates, default=None)
    auto_apply = (
        latest is not None
        and latest == local_today - timedelta(days=2)
        and available >= 1
        and yesterday not in consumed
    )
    if not auto_apply:
        covered_latest = max(covered, default=None)
        if covered_latest is None:
            state = "idle"
        else:
            gap_to_covered = (local_today - covered_latest).days
            if gap_to_covered > 1:
                state = "out_of_stock" if latest == local_today - timedelta(days=2) else "break"
            else:
                state = "idle"
        reason = (
            "Серия продолжается за счёт заморозки за пропущенный день."
            if covered_current > 0 and calendar.current_days == 0
            else calendar.reason
        )
        return FrozenEngagementCalendar(
            current_days=covered_current,
            best_days=max(calendar.best_days, covered_best),
            qualified_dates=calendar.qualified_dates,
            frozen_dates=frozenset(consumed),
            reason=reason,
            today_saved=calendar.today_saved,
            grace_available=calendar.grace_available,
            freeze_state=state,
            consumed_dates=consumed,
        )
    days = 0
    cursor = max(covered | {yesterday})
    while cursor in covered | {yesterday}:
        days += 1
        cursor -= timedelta(days=1)
    return FrozenEngagementCalendar(
        current_days=days,
        best_days=max(calendar.best_days, _longest_run(covered | {yesterday})),
        qualified_dates=calendar.qualified_dates,
        frozen_dates=frozenset(consumed) | {yesterday},
        reason=("Вчерашний день закрыт заморозкой; заморозка не считается активностью."),
        today_saved=False,
        grace_available=True,
        freeze_state="frozen",
        consumed_dates=consumed,
    )


def service_block_audit(*, scope: str, explanation: str) -> str:
    """Honest audit line for provider/outage blocks that never consume freeze stock."""
    return f"Служебный сбой ({scope}) зафиксирован без расхода заморозки: {explanation}"


WEEKLY_RHYTHM_PRESET_VERSION = 1
RHYTHM_NOT_STREAK_HINT = (
    "Недельный ритм — согласованное расписание; он не тождественен серии и не закрывает пропуски."
)


class WeeklyRhythmError(ValueError):
    """Domain-level contract violation for weekly rhythm settings."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


WORKDAYS_PRESET = "workdays"
WEEKENDS_PRESET = "weekends"
ALL_WEEK_PRESET = "all_week"
TWICE_WEEK_PRESET = "twice_week"
CUSTOM_PRESET = "custom"
WEEKLY_RHYTHM_PRESETS = (
    WORKDAYS_PRESET,
    WEEKENDS_PRESET,
    ALL_WEEK_PRESET,
    TWICE_WEEK_PRESET,
    CUSTOM_PRESET,
)


def preset_active_days(
    preset: str, custom_days: tuple[int, ...] | list[int] = ()
) -> frozenset[int]:
    """Versioned rhythm presets v1; custom requires explicit 1..7 ISO weekdays."""
    known = {
        WORKDAYS_PRESET: frozenset({1, 2, 3, 4, 5}),
        WEEKENDS_PRESET: frozenset({6, 7}),
        ALL_WEEK_PRESET: frozenset({1, 2, 3, 4, 5, 6, 7}),
        TWICE_WEEK_PRESET: frozenset({1, 4}),
    }
    if preset not in WEEKLY_RHYTHM_PRESETS:
        raise WeeklyRhythmError(
            "VALIDATION_ERROR",
            f"Неизвестный пресет недельного ритма: {preset}.",
        )
    if preset != CUSTOM_PRESET:
        return known[preset]
    days = frozenset(custom_days)
    if not days or not all(1 <= day <= 7 for day in days) or len(days) > 7:
        raise WeeklyRhythmError(
            "VALIDATION_ERROR",
            "В персональном пресете выберите от 1 до 7 дней ISO-недели.",
        )
    return days


@dataclass(frozen=True, slots=True)
class WeeklyRhythm:
    """Versioned rhythm contract; history keeps every saved version."""

    version: int
    preset: str
    active_days: frozenset[int]
    reminder_hour: int
    reminder_window_hours: int
    effective_from: date

    def __post_init__(self) -> None:
        if self.reminder_hour < 0 or self.reminder_hour > 23:
            raise WeeklyRhythmError(
                "VALIDATION_ERROR",
                "Час напоминания задаётся значением от 0 до 23.",
            )
        if self.reminder_window_hours < 1 or self.reminder_window_hours > 6:
            raise WeeklyRhythmError(
                "VALIDATION_ERROR",
                "Окно напоминания задаётся значением от 1 до 6 часов.",
            )
        if self.preset == CUSTOM_PRESET and not self.active_days:
            raise WeeklyRhythmError(
                "VALIDATION_ERROR",
                "Персональный пресет требует выбранных дней недели.",
            )


def iso_week_bounds(local_today: date) -> tuple[date, date]:
    """Monday..Sunday bounds of the ISO week containing local_today."""
    week_start = local_today - timedelta(days=local_today.weekday())
    return week_start, week_start + timedelta(days=6)


@dataclass(frozen=True, slots=True)
class WeeklyRhythmProjection:
    """Weekly rhythm progress: НЕ серия, НЕ verified progress — только договор ритма."""

    version: int
    preset: str
    active_days: frozenset[int]
    reminder_hour: int
    reminder_window_hours: int
    effective_from: date
    week_start: date
    week_end: date
    target_days: int
    done_days: int
    hint: str


def weekly_rhythm_projection(
    rhythm: WeeklyRhythm, achieved_dates: frozenset[date], *, local_today: date
) -> WeeklyRhythmProjection:
    """Progress counts only qualified dates inside the ISO week, bounded by effective_from."""
    week_start, week_end = iso_week_bounds(local_today)
    started = rhythm.effective_from <= local_today
    week_days = {week_start + timedelta(days=offset) for offset in range(7)}
    effective_days = {day for day in week_days if day >= rhythm.effective_from}
    active_in_week = achieved_dates & effective_days
    done = len(active_in_week) if started else 0
    return WeeklyRhythmProjection(
        version=rhythm.version,
        preset=rhythm.preset,
        active_days=rhythm.active_days,
        reminder_hour=rhythm.reminder_hour,
        reminder_window_hours=rhythm.reminder_window_hours,
        effective_from=rhythm.effective_from,
        week_start=week_start,
        week_end=week_end,
        target_days=len(rhythm.active_days),
        done_days=done,
        hint=RHYTHM_NOT_STREAK_HINT,
    )
