"""Versioned growth formulas: interval deduplication and weighted progress."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ACTIVITY_DEFINITIONS_VERSION = 3
HOURS_DEFINITIONS_VERSION = 2
MILESTONE_DEFINITIONS_VERSION = 4
READINESS_DEFINITIONS_VERSION = 3

QUALIFIED_ACTIVITY_KINDS = (
    "course_checkpoint",
    "project_submission",
    "revision_accepted",
    "event_participation",
)


@dataclass(frozen=True, slots=True)
class MilestoneWeight:
    key: str
    mandatory: bool
    weight: Decimal | None


@dataclass(frozen=True, slots=True)
class ReadinessWeight:
    skill_key: str
    target_level: int
    weight: Decimal


@dataclass(frozen=True, slots=True)
class WeightedResult:
    """Версионированный итог формулы: (percent, coverage, partial)."""

    percent: Decimal | None
    coverage: Decimal
    partial: bool


def merge_intervals(
    intervals: tuple[tuple[datetime, datetime], ...],
) -> tuple[tuple[datetime, datetime], ...]:
    """Объединяет пересекающиеся и соприкасающиеся интервалы."""
    ordered = sorted(
        (item for item in intervals if item[0] <= item[1]),
        key=lambda item: (item[0], item[1]),
    )
    merged: list[tuple[datetime, datetime]] = []
    for start, end in ordered:
        last = merged[-1] if merged else None
        if last is not None and start <= last[1]:
            if end > last[1]:
                merged[-1] = (last[0], end)
            merged[-1] = (last[0], max(last[1], end))
        else:
            merged.append((start, end))
    return tuple(merged)


def merged_minutes(intervals: tuple[tuple[datetime, datetime], ...]) -> int:
    """Общее подтверждённое время в минутах без двойного счёта."""
    total = timedelta()
    for start, end in merge_intervals(intervals):
        total += end - start
    return max(0, int(total.total_seconds() // 60))


def weighted_completion(
    weights: tuple[MilestoneWeight, ...],
    completed_keys: frozenset[str],
) -> WeightedResult:
    """Взвешенная доля завершённых обязательных milestones."""
    mandatory = tuple(item for item in weights if item.mandatory)
    if not mandatory:
        return WeightedResult(Decimal("0"), Decimal(1), False)
    known = tuple(item for item in mandatory if item.weight is not None)
    coverage = Decimal(str(len(known) / len(mandatory)))
    if len(known) != len(mandatory):
        return WeightedResult(None, coverage, True)
    total = Decimal(0)
    for item in known:
        total += item.weight or Decimal(0)
    if total <= 0:
        return WeightedResult(None, coverage, True)
    achieved = Decimal(0)
    for item in known:
        if item.key in completed_keys:
            achieved += item.weight or Decimal(0)
    percent = min(
        (achieved / total * Decimal(100)).quantize(Decimal("0.1"), ROUND_HALF_UP),
        Decimal("100"),
    )
    return WeightedResult(percent, coverage, False)


def readiness(
    weights: tuple[ReadinessWeight, ...],
    current_levels: dict[str, int],
    known_keys: frozenset[str],
) -> WeightedResult:
    """Готовность роли: взвешенное min(current/target, 1).

    При неизвестном обязательном уровне итог — partial: percent None,
    coverage < 1. Превышение цели ограничивается 100%, но не маскирует
    остальные пробелы.
    """
    mandatory = tuple(weights)
    if not mandatory:
        return WeightedResult(Decimal("0"), Decimal(1), False)
    known = tuple(item for item in mandatory if item.skill_key in known_keys)
    coverage = Decimal(str(len(known) / len(mandatory)))
    if len(known) != len(mandatory):
        return WeightedResult(None, coverage, True)
    total = sum((item.weight for item in known), Decimal(0))
    if total <= 0:
        return WeightedResult(None, coverage, True)
    achieved = Decimal(0)
    for item in known:
        current = current_levels.get(item.skill_key)
        if current is None:
            continue
        achieved += item.weight * min(Decimal(current) / Decimal(item.target_level), Decimal(1))
    percent = min(
        (achieved / total * Decimal(100)).quantize(Decimal("0.1"), ROUND_HALF_UP),
        Decimal("100"),
    )
    return WeightedResult(percent, coverage, False)


def period_boundaries(
    *,
    now: datetime,
    timezone: str,
) -> dict[str, dict[str, str]]:
    """Границы day/week/month/year в таймзоне участника."""
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Unknown timezone") from exc
    local = now.astimezone(zone)
    day_start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timedelta(days=day_start.weekday())
    month_start = day_start.replace(day=1)
    year_start = local.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (
        datetime(month_start.year + 1, 1, 1, tzinfo=day_start.tzinfo)
        if month_start.month == 12
        else datetime(month_start.year, month_start.month + 1, 1, tzinfo=day_start.tzinfo)
    )
    buckets = {
        "day": (day_start, day_start + timedelta(days=1)),
        "week": (week_start, week_start + timedelta(days=7)),
        "month": (month_start, next_month),
        "year": (year_start, year_start + timedelta(days=730) - timedelta(days=2)),
    }
    year_end = datetime(year_start.year + 1, 1, 1, tzinfo=day_start.tzinfo)
    buckets["year"] = (year_start, year_end)
    return {
        name: {"start": start.astimezone(UTC).isoformat(), "end": end.astimezone(UTC).isoformat()}
        for name, (start, end) in buckets.items()
    }


def activity_bucket_counts(
    events: tuple[tuple[datetime, str], ...],
    *,
    boundaries: dict[str, dict[str, str]],
) -> dict[str, dict[str, int]]:
    """Разложение квалифицированных событий по period и kind."""
    zones: dict[str, tuple[datetime, datetime]] = {
        name: (
            datetime.fromisoformat(container["start"]),
            datetime.fromisoformat(container["end"]),
        )
        for name, container in boundaries.items()
    }
    result: dict[str, dict[str, int]] = {}
    for name in boundaries:
        counts = {"total": 0}
        for kind in QUALIFIED_ACTIVITY_KINDS:
            counts[kind] = 0
        result[name] = counts
    for occurred_at, kind in events:
        if kind not in QUALIFIED_ACTIVITY_KINDS:
            continue
        moment = occurred_at if occurred_at.tzinfo else occurred_at.replace(tzinfo=UTC)
        for name, (start, end) in zones.items():
            if start <= moment < end:
                result[name][kind] += 1
                result[name]["total"] += 1
    return result


__all__ = [
    "ACTIVITY_DEFINITIONS_VERSION",
    "HOURS_DEFINITIONS_VERSION",
    "MILESTONE_DEFINITIONS_VERSION",
    "QUALIFIED_ACTIVITY_KINDS",
    "READINESS_DEFINITIONS_VERSION",
    "MilestoneWeight",
    "ReadinessWeight",
    "WeightedResult",
    "activity_bucket_counts",
    "merge_intervals",
    "merged_minutes",
    "period_boundaries",
    "readiness",
    "weighted_completion",
]
