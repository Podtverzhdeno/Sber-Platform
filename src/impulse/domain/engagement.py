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


def frozen_calendar(
    calendar: EngagementCalendar,
    available: int,
    consumed: frozenset[date],
    *,
    local_today: date,
) -> FrozenEngagementCalendar:
    """Freeze extends the current streak once when yesterday was missed and stock exists.

    Freeze days are audit-visible and never count as activity: they are excluded from
    qualified_dates and appear only in frozen_dates with a dedicated reason.
    """
    latest = max(calendar.qualified_dates, default=None)
    frozen_dates: frozenset[date] = consumed
    if latest is None or latest != local_today - timedelta(days=2) or available < 1:
        if latest is not None and latest != local_today - timedelta(days=2):
            break_now = (local_today - latest).days > 1
            return FrozenEngagementCalendar(
                current_days=calendar.current_days,
                best_days=calendar.best_days,
                qualified_dates=calendar.qualified_dates,
                frozen_dates=frozen_dates,
                reason=calendar.reason,
                today_saved=calendar.today_saved,
                grace_available=calendar.grace_available,
                freeze_state="break" if break_now else "idle",
                consumed_dates=consumed,
            )
        return FrozenEngagementCalendar(
            current_days=0 if latest is None else calendar.current_days,
            best_days=calendar.best_days,
            qualified_dates=calendar.qualified_dates,
            frozen_dates=frozen_dates,
            reason=(
                calendar.reason
                if latest is not None
                else "Заморозка доступна после первых квалифицированных дней."
            ),
            today_saved=calendar.today_saved,
            grace_available=calendar.grace_available,
            freeze_state="out_of_stock" if latest is not None else calendar.freeze_state,
            consumed_dates=consumed,
        )
    extended = frozenset(calendar.qualified_dates) | {local_today - timedelta(days=1)}
    days = 0
    cursor = max(extended | frozen_dates)
    while cursor in extended or cursor in frozen_dates:
        days += 1
        cursor -= timedelta(days=1)
    return FrozenEngagementCalendar(
        current_days=days,
        best_days=max(calendar.best_days, days),
        qualified_dates=calendar.qualified_dates,
        frozen_dates=frozen_dates | {local_today - timedelta(days=1)},
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
