"""Versioned rating-season policy and lifecycle invariants."""
# ruff: noqa: RUF001

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
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
            raise RatingPolicyError("До открытия нужны источники, tie-break и пороги дипломов.")
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


@dataclass(frozen=True, slots=True)
class CohortMember:
    person_id: UUID
    program_key: str
    track_keys: tuple[str, ...]

    def matches(self, cohort: CohortRule) -> bool:
        return self.program_key == cohort.program_key and bool(
            set(self.track_keys) & set(cohort.track_keys)
        )


@dataclass(frozen=True, slots=True)
class ScoreEntry:
    entry_id: UUID
    season_id: UUID
    person_id: UUID
    source_type: str
    source_id: UUID
    rule_id: str
    points: Decimal
    occurred_at: datetime
    correction_of: UUID | None = None
    correction_reason: str | None = None

    def __post_init__(self) -> None:
        _decimal(self.points)
        if not self.source_type.strip() or not self.rule_id.strip():
            raise RatingPolicyError("Score entry requires source_type and rule_id.")
        if self.occurred_at.tzinfo is None:
            raise RatingPolicyError("Score entry timestamp must include timezone.")
        if self.correction_of is None and self.points <= 0:
            raise RatingPolicyError("Original score entry must have positive points.")
        if self.correction_of is not None and (
            self.points == 0 or not (self.correction_reason or "").strip()
        ):
            raise RatingPolicyError("Correction requires non-zero points and a reason.")


@dataclass(frozen=True, slots=True)
class Standing:
    season_id: UUID
    person_id: UUID
    place: int
    score: Decimal
    successful_projects: int
    highest_project_score: Decimal
    earliest_achievement: datetime | None


def rebuild_standings(
    policy: RatingPolicy,
    members: tuple[CohortMember, ...],
    entries: tuple[ScoreEntry, ...],
) -> tuple[Standing, ...]:
    """Build a stable projection only from members of the published cohort."""
    eligible = {item.person_id for item in members if item.matches(policy.cohort)}
    rules = {item.rule_id: item for item in policy.sources}
    person_entries = {
        person_id: tuple(
            item
            for item in entries
            if item.person_id == person_id
            and item.season_id == policy.season_id
            and item.rule_id in rules
        )
        for person_id in eligible
    }
    rows: list[Standing] = []
    for person_id, items in person_entries.items():
        score = Decimal("0")
        for rule_id, rule in rules.items():
            raw = sum((item.points for item in items if item.rule_id == rule_id), Decimal("0"))
            score += min(max(raw * rule.weight, Decimal("0")), rule.cap)
        project_totals: dict[UUID, Decimal] = {}
        by_id = {item.entry_id: item for item in items}
        for item in items:
            if item.source_type == "project":
                original = by_id.get(item.correction_of) if item.correction_of else None
                source_id = original.source_id if original is not None else item.source_id
                project_totals[source_id] = (
                    project_totals.get(source_id, Decimal("0")) + item.points
                )
        positive_projects = tuple(value for value in project_totals.values() if value > 0)
        achievements = tuple(item.occurred_at for item in items if item.points > 0)
        rows.append(
            Standing(
                season_id=policy.season_id,
                person_id=person_id,
                place=0,
                score=score,
                successful_projects=len(positive_projects),
                highest_project_score=max(positive_projects, default=Decimal("0")),
                earliest_achievement=min(achievements, default=None),
            )
        )

    def key(row: Standing) -> tuple[object, ...]:
        parts: list[object] = [-row.score]
        for tie_breaker in policy.tie_breakers:
            if tie_breaker is TieBreaker.SUCCESSFUL_PROJECTS:
                parts.append(-row.successful_projects)
            elif tie_breaker is TieBreaker.HIGHEST_PROJECT_SCORE:
                parts.append(-row.highest_project_score)
            elif tie_breaker is TieBreaker.EARLIEST_ACHIEVEMENT:
                parts.append(row.earliest_achievement or datetime.max.replace(tzinfo=UTC))
            elif tie_breaker is TieBreaker.PERSON_ID:
                parts.append(str(row.person_id))
        parts.append(str(row.person_id))
        return tuple(parts)

    ordered = sorted(rows, key=key)
    return tuple(
        Standing(
            season_id=row.season_id,
            person_id=row.person_id,
            place=index,
            score=row.score,
            successful_projects=row.successful_projects,
            highest_project_score=row.highest_project_score,
            earliest_achievement=row.earliest_achievement,
        )
        for index, row in enumerate(ordered, start=1)
    )
