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


def engagement_day(
    records: tuple[EngagementRecord, ...], timezone: str
) -> frozenset[date]:
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


def _covered_runs(
    covered: frozenset[date], *, local_today: date
) -> tuple[int, int]:
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
    return (
        f"Служебный сбой ({scope}) зафиксирован без расхода заморозки: {explanation}"
    )
