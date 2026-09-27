"""Deterministic career-track, roadmap and learning-day policies."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from enum import StrEnum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


class TrackStatus(StrEnum):
    ACTIVE = "active"
    FROZEN = "frozen"


class CompletionStatus(StrEnum):
    REPORTED = "reported"
    VERIFIED = "verified"
    REJECTED = "rejected"


class TrackPolicyError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class TrackAttempt:
    track_key: str
    attempt_number: int
    status: TrackStatus
    completed_milestones: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class TrackSelection:
    attempts: tuple[TrackAttempt, ...]
    activated: str
    frozen: str | None
    mentor_approval_required: bool = False
    public_penalty: bool = False


def select_track(
    attempts: tuple[TrackAttempt, ...],
    track_key: str,
    *,
    freeze_track_key: str | None = None,
) -> TrackSelection:
    """Activate a track while preserving at most two active attempts and all history."""
    if not track_key:
        raise TrackPolicyError("TRACK_REQUIRED", "Направление не указано.")
    active = [attempt for attempt in attempts if attempt.status is TrackStatus.ACTIVE]
    existing = next((item for item in attempts if item.track_key == track_key), None)
    if existing is not None and existing.status is TrackStatus.ACTIVE:
        return TrackSelection(attempts=attempts, activated=track_key, frozen=None)

    needs_slot = len(active) >= 2
    if needs_slot and freeze_track_key is None:
        raise TrackPolicyError(
            "TRACK_SLOT_REQUIRED",
            "Выберите одно активное направление, которое хотите заморозить без потери прогресса.",
        )
    if freeze_track_key is not None:
        if freeze_track_key == track_key:
            raise TrackPolicyError(
                "INVALID_TRACK_SWAP", "Новое направление нельзя одновременно заморозить."
            )
        if not any(item.track_key == freeze_track_key for item in active):
            raise TrackPolicyError(
                "ACTIVE_TRACK_NOT_FOUND", "Заморозить можно только активное направление."
            )

    updated = list(attempts)
    if freeze_track_key is not None:
        updated = [
            replace(item, status=TrackStatus.FROZEN)
            if item.track_key == freeze_track_key and item.status is TrackStatus.ACTIVE
            else item
            for item in updated
        ]
    if existing is None:
        updated.append(
            TrackAttempt(
                track_key=track_key,
                attempt_number=1,
                status=TrackStatus.ACTIVE,
            )
        )
    else:
        updated = [
            replace(item, status=TrackStatus.ACTIVE) if item.track_key == track_key else item
            for item in updated
        ]
    if sum(item.status is TrackStatus.ACTIVE for item in updated) > 2:
        raise TrackPolicyError(
            "TRACK_LIMIT_EXCEEDED", "Одновременно доступны не более двух направлений."
        )
    return TrackSelection(
        attempts=tuple(updated),
        activated=track_key,
        frozen=freeze_track_key,
    )


@dataclass(frozen=True, slots=True)
class RoadmapMilestone:
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str


@dataclass(frozen=True, slots=True)
class RoadmapProjection:
    track_key: str
    policy_version: int
    milestones: tuple[RoadmapMilestone, ...]
    completed_keys: frozenset[str]
    replacement_reason: str | None = None

    @property
    def next_step(self) -> RoadmapMilestone | None:
        return next(
            (item for item in self.milestones if item.key not in self.completed_keys),
            None,
        )


def recalculate_roadmap(
    previous: RoadmapProjection | None,
    *,
    track_key: str,
    policy_version: int,
    milestones: tuple[RoadmapMilestone, ...],
) -> RoadmapProjection:
    if policy_version < 1:
        raise ValueError("policy_version must be positive")
    if any(not item.purpose or not item.skill or not item.target_key for item in milestones):
        raise ValueError("Every milestone requires purpose, skill and target")
    completed: frozenset[str] = previous.completed_keys if previous is not None else frozenset()
    current_keys = frozenset(item.key for item in milestones)
    preserved: frozenset[str] = completed & current_keys
    changed = previous is not None and previous.policy_version != policy_version
    return RoadmapProjection(
        track_key=track_key,
        policy_version=policy_version,
        milestones=tuple(sorted(milestones, key=lambda item: item.position)),
        completed_keys=preserved,
        replacement_reason=(
            "Маршрут обновлён: подтверждённые этапы сохранены, устаревшие рекомендации заменены."
            if changed
            else None
        ),
    )


@dataclass(frozen=True, slots=True)
class StreakResult:
    current_days: int
    qualified_dates: frozenset[date]
    reason: str


def local_learning_days(events: tuple[datetime, ...], timezone: str) -> frozenset[date]:
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Unknown timezone") from exc
    if any(event.tzinfo is None for event in events):
        raise ValueError("Learning events must be timezone-aware")
    return frozenset(event.astimezone(zone).date() for event in events)


def calculate_streak(qualified_dates: frozenset[date], *, local_today: date) -> StreakResult:
    if not qualified_dates:
        return StreakResult(0, qualified_dates, "Выполните учебное действие, чтобы начать серию.")
    latest = max(qualified_dates)
    if latest < local_today - timedelta(days=1):
        return StreakResult(
            0, qualified_dates, "Серия прервана: последний учебный день был раньше вчерашнего."
        )
    cursor = latest
    days = 0
    while cursor in qualified_dates:
        days += 1
        cursor -= timedelta(days=1)
    reason = (
        "Серия сохранена сегодняшним подтверждённым учебным действием."
        if latest == local_today
        else "Серия сохранена вчерашним действием; выполните шаг сегодня, чтобы продолжить."
    )
    return StreakResult(days, qualified_dates, reason)


def rating_eligible(status: CompletionStatus) -> bool:
    return status is CompletionStatus.VERIFIED
