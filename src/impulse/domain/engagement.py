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
