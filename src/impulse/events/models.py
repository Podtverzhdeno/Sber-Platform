"""Immutable records for the published event detail and registration projection."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

CounterState = Literal["ok", "zero", "unknown"]

RewardKind = Literal["frozen_points", "permanent_points", "certificate", "special_prize"]

AGGREGATE_DEFINITION = "confirmed_registrations"
AGGREGATE_DEFINITION_VERSION = 1
AGGREGATE_DEFINITION_TEXT = (
    "Счётчик считает уникальных участников с подтверждённой регистрацией: заявка "
    "отправлена организатору или участие уже проверено. Самостоятельно отмеченное "
    "участие не входит в основной счётчик."
)


@dataclass(frozen=True, slots=True)
class ProgramStage:
    """One visible stage or day of the published event program."""

    day: str
    title: str
    detail: str


@dataclass(frozen=True, slots=True)
class EventReward:
    """A reward the organizer publishes for this event."""

    kind: RewardKind
    label: str
    note: str = ""


@dataclass(frozen=True, slots=True)
class EventDetailRecord:
    """Full detail of one event; missing optional facts stay None for honest UI."""

    key: str
    title: str
    event_type: str
    organizer: str
    status: str
    conditions: str
    source_url: str
    source_status: str
    source_checked_at: datetime | None
    track_keys: tuple[str, ...]
    recommendation_reason: str
    description: str | None = None
    target_audience: str | None = None
    prerequisites: tuple[str, ...] | None = None
    program: tuple[ProgramStage, ...] | None = None
    expected_result: str | None = None
    participation_rules: str | None = None
    venue_format: str | None = None
    timezone: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    deadline_at: datetime | None = None
    rewards: tuple[EventReward, ...] | None = None


@dataclass(frozen=True, slots=True)
class RegistrationAggregate:
    """Privacy-safe registration numbers; no person identifiers exist in it."""

    event_key: str
    started_registrations: int | None
    confirmed_registrations: int | None
    participations: int | None
    counter_state: CounterState
    computed_at: datetime | None
    source_checked_at: datetime | None
    definition: str = AGGREGATE_DEFINITION
    definition_version: int = AGGREGATE_DEFINITION_VERSION
    definition_text: str = AGGREGATE_DEFINITION_TEXT
    contains_personal_data: bool = False


@dataclass(frozen=True, slots=True)
class RegistrationCounts:
    """Raw grouped counters; ``None`` means the provider projection is unavailable."""

    started: int | None
    confirmed: int | None
    participations: int | None
