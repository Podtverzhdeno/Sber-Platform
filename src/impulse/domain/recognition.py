"""Versioned rating-season policy and lifecycle invariants."""
# ruff: noqa: RUF001

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from uuid import UUID


class RatingPolicyError(ValueError):
    """Raised when a season or its published rules violate invariants."""


class SeasonStatus(StrEnum):
    SCHEDULED = "scheduled"
    OPEN = "open"
    CLOSING = "closing"
    FROZEN = "frozen"


class TieBreaker(StrEnum):
    SUCCESSFUL_PROJECTS = "successful_projects"
    HIGHEST_PROJECT_SCORE = "highest_project_score"
    EARLIEST_ACHIEVEMENT = "earliest_achievement"
    PERSON_ID = "person_id"


def _decimal(value: object) -> Decimal:
    if not isinstance(value, Decimal):
        raise RatingPolicyError("Weight and cap must use Decimal.")
    return value


@dataclass(frozen=True, slots=True)
class CohortRule:
    key: str
    title: str
    program_key: str
    track_keys: tuple[str, ...]
    minimum_size: int

    def __post_init__(self) -> None:
        if not self.key.strip() or not self.title.strip() or not self.program_key.strip():
            raise RatingPolicyError("Когорта требует ключ, название и программу.")
        if not self.track_keys or any(not item.strip() for item in self.track_keys):
            raise RatingPolicyError("Когорта требует хотя бы одно направление.")
        if len(set(self.track_keys)) != len(self.track_keys) or self.minimum_size < 2:
            raise RatingPolicyError("Направления когорты уникальны, minimum_size не меньше двух.")


@dataclass(frozen=True, slots=True)
class ScoreSourceRule:
    rule_id: str
    source_type: str
    weight: Decimal
    cap: Decimal

    def __post_init__(self) -> None:
        if not self.rule_id.strip() or not self.source_type.strip():
            raise RatingPolicyError("Источник баллов требует rule_id и source_type.")
        if _decimal(self.weight) <= 0 or _decimal(self.cap) <= 0:
            raise RatingPolicyError("Вес и cap должны быть положительными.")


@dataclass(frozen=True, slots=True)
class DiplomaThreshold:
    level: str
    place_from: int
    place_to: int
    title: str

    def __post_init__(self) -> None:
        if not self.level.strip() or not self.title.strip():
            raise RatingPolicyError("Порог диплома требует уровень и название.")
        if self.place_from < 1 or self.place_to < self.place_from:
            raise RatingPolicyError("Диапазон мест диплома некорректен.")


@dataclass(frozen=True, slots=True)
class RatingPolicy:
    policy_id: UUID
    season_id: UUID
    version: int
    cohort: CohortRule
    sources: tuple[ScoreSourceRule, ...]
    tie_breakers: tuple[TieBreaker, ...]
    diploma_thresholds: tuple[DiplomaThreshold, ...]
    appeal_period_days: int

    def __post_init__(self) -> None:
        if self.version < 1 or self.appeal_period_days < 1:
            raise RatingPolicyError("Версия и срок апелляции должны быть положительными.")
        if not self.sources or not self.tie_breakers or not self.diploma_thresholds:
            raise RatingPolicyError(
                "До открытия нужны источники, tie-break и пороги дипломов."
            )
        rule_ids = [item.rule_id for item in self.sources]
        source_types = [item.source_type for item in self.sources]
        if len(rule_ids) != len(set(rule_ids)) or len(source_types) != len(set(source_types)):
            raise RatingPolicyError("Источники и rule_id политики должны быть уникальными.")
        if len(self.tie_breakers) != len(set(self.tie_breakers)):
            raise RatingPolicyError("Tie-break правила не должны повторяться.")
        levels = [item.level for item in self.diploma_thresholds]
        if len(levels) != len(set(levels)):
            raise RatingPolicyError("Уровни дипломов должны быть уникальными.")
        occupied: set[int] = set()
        for threshold in self.diploma_thresholds:
            places = set(range(threshold.place_from, threshold.place_to + 1))
            if occupied & places:
                raise RatingPolicyError("Диапазоны дипломов не должны пересекаться.")
            occupied.update(places)


@dataclass(frozen=True, slots=True)
class RatingSeason:
    season_id: UUID
    key: str
    title: str
    status: SeasonStatus = SeasonStatus.SCHEDULED
    version: int = 1
    policy_version: int | None = None

    def __post_init__(self) -> None:
        if not self.key.strip() or not self.title.strip() or self.version < 1:
            raise RatingPolicyError("Сезон требует ключ, название и положительную версию.")
        if self.status is not SeasonStatus.SCHEDULED and self.policy_version is None:
            raise RatingPolicyError("Активный сезон должен быть связан с версией политики.")

    def open(self, policy: RatingPolicy) -> RatingSeason:
        if self.status is not SeasonStatus.SCHEDULED:
            raise RatingPolicyError("Открыть можно только запланированный сезон.")
        if policy.season_id != self.season_id:
            raise RatingPolicyError("Политика относится к другому сезону.")
        return RatingSeason(
            season_id=self.season_id,
            key=self.key,
            title=self.title,
            status=SeasonStatus.OPEN,
            version=self.version + 1,
            policy_version=policy.version,
        )
