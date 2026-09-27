"""Rating season and published policy use cases."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from typing import Protocol, TypeVar
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role
from impulse.domain.recognition import (
    CohortMember,
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingPolicyError,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    SeasonStatus,
    Standing,
    TieBreaker,
    rebuild_standings,
)

T = TypeVar("T")


class RecognitionStore(Protocol):
    async def season(self, season_id: UUID) -> RatingSeason | None: ...
    async def add_season(self, season: RatingSeason) -> RatingSeason: ...
    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None: ...
    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy: ...
    async def save_season(self, season: RatingSeason, expected_version: int) -> RatingSeason: ...
    async def score_entry(self, entry_id: UUID) -> ScoreEntry | None: ...
    async def add_score_entry(self, entry: ScoreEntry) -> ScoreEntry: ...
    async def score_entries(self, season_id: UUID) -> tuple[ScoreEntry, ...]: ...
    async def cohort_members(self, policy: RatingPolicy) -> tuple[CohortMember, ...]: ...
    async def replace_standings(
        self, season_id: UUID, rows: tuple[Standing, ...]
    ) -> tuple[Standing, ...]: ...


class MemoryRecognitionStore:
    def __init__(self, members: tuple[CohortMember, ...] = ()) -> None:
        self._seasons: dict[UUID, RatingSeason] = {}
        self._policies: dict[UUID, tuple[RatingPolicy, ...]] = {}
        self._entries: dict[UUID, ScoreEntry] = {}
        self._members = members
        self._standings: dict[UUID, tuple[Standing, ...]] = {}

    async def season(self, season_id: UUID) -> RatingSeason | None:
        return self._seasons.get(season_id)

    async def add_season(self, season: RatingSeason) -> RatingSeason:
        if any(item.key == season.key for item in self._seasons.values()):
            raise ApiError("SEASON_KEY_EXISTS", "Ключ сезона уже используется.", 409)
        self._seasons[season.season_id] = season
        return season

    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None:
        policies = self._policies.get(season_id, ())
        return policies[-1] if policies else None

    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy:
        policies = self._policies.get(policy.season_id, ())
        expected = len(policies) + 1
        if policy.version != expected:
            raise ApiError("STALE_POLICY", "Версия политики изменилась.", 409)
        self._policies[policy.season_id] = (*policies, policy)
        return policy

    async def save_season(self, season: RatingSeason, expected_version: int) -> RatingSeason:
        current = self._seasons.get(season.season_id)
        if current is None or current.version != expected_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        self._seasons[season.season_id] = season
        return season

    async def score_entry(self, entry_id: UUID) -> ScoreEntry | None:
        return self._entries.get(entry_id)

    async def add_score_entry(self, entry: ScoreEntry) -> ScoreEntry:
        duplicate = any(
            item.season_id == entry.season_id
            and item.source_type == entry.source_type
            and item.source_id == entry.source_id
            and item.rule_id == entry.rule_id
            for item in self._entries.values()
        )
        if duplicate:
            raise ApiError("DUPLICATE_SCORE_SOURCE", "Score source is already recorded.", 409)
        self._entries[entry.entry_id] = entry
        return entry

    async def score_entries(self, season_id: UUID) -> tuple[ScoreEntry, ...]:
        return tuple(item for item in self._entries.values() if item.season_id == season_id)

    async def cohort_members(self, policy: RatingPolicy) -> tuple[CohortMember, ...]:
        return tuple(item for item in self._members if item.matches(policy.cohort))

    async def replace_standings(
        self, season_id: UUID, rows: tuple[Standing, ...]
    ) -> tuple[Standing, ...]:
        self._standings[season_id] = rows
        return rows


class RecognitionService:
    def __init__(self, store: RecognitionStore) -> None:
        self.store = store

    @staticmethod
    def _operator(actor: ActorContext) -> None:
        if actor.active_role is not Role.OPERATOR:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)

    @staticmethod
    def _policy(operation: Callable[[], T]) -> T:
        try:
            return operation()
        except RatingPolicyError as exc:
            raise ApiError("INVALID_RATING_POLICY", str(exc), 409) from exc

    async def create_season(self, actor: ActorContext, *, key: str, title: str) -> RatingSeason:
        self._operator(actor)
        season = self._policy(lambda: RatingSeason(uuid4(), key, title))
        return await self.store.add_season(season)

    async def publish_policy(
        self,
        actor: ActorContext,
        season_id: UUID,
        *,
        expected_season_version: int,
        cohort: CohortRule,
        sources: tuple[ScoreSourceRule, ...],
        tie_breakers: tuple[TieBreaker, ...],
        thresholds: tuple[DiplomaThreshold, ...],
        appeal_period_days: int,
    ) -> RatingPolicy:
        self._operator(actor)
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if season.version != expected_season_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        if season.status is not SeasonStatus.SCHEDULED:
            raise ApiError(
                "SEASON_POLICY_FROZEN",
                "После открытия исходная версия правил сезона неизменна.",
                409,
            )
        latest = await self.store.latest_policy(season_id)
        policy = self._policy(
            lambda: RatingPolicy(
                policy_id=uuid4(),
                season_id=season_id,
                version=1 if latest is None else latest.version + 1,
                cohort=cohort,
                sources=sources,
                tie_breakers=tie_breakers,
                diploma_thresholds=thresholds,
                appeal_period_days=appeal_period_days,
            )
        )
        return await self.store.add_policy(policy)

    async def open_season(
        self, actor: ActorContext, season_id: UUID, *, expected_version: int
    ) -> RatingSeason:
        self._operator(actor)
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        if season.version != expected_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        policy = await self.store.latest_policy(season_id)
        if policy is None:
            raise ApiError(
                "RATING_POLICY_INCOMPLETE",
                "Сезон нельзя открыть до публикации полных правил.",
                409,
            )
        opened = self._policy(lambda: season.open(policy))
        return await self.store.save_season(opened, expected_version)

    async def append_score(
        self,
        actor: ActorContext,
        season_id: UUID,
        *,
        person_id: UUID,
        source_type: str,
        source_id: UUID,
        rule_id: str,
        points: Decimal,
        occurred_at: datetime,
    ) -> ScoreEntry:
        self._operator(actor)
        season, policy = await self._active_policy(season_id)
        del season
        rule = next((item for item in policy.sources if item.rule_id == rule_id), None)
        if rule is None or rule.source_type != source_type:
            raise ApiError("SCORE_RULE_NOT_ALLOWED", "Source is not allowed by season policy.", 409)
        entry = self._policy(
            lambda: ScoreEntry(
                uuid4(), season_id, person_id, source_type, source_id, rule_id, points, occurred_at
            )
        )
        return await self.store.add_score_entry(entry)

    async def correct_score(
        self,
        actor: ActorContext,
        entry_id: UUID,
        *,
        points_delta: Decimal,
        reason: str,
        occurred_at: datetime,
    ) -> ScoreEntry:
        self._operator(actor)
        original = await self.store.score_entry(entry_id)
        if original is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        await self._active_policy(original.season_id, allow_frozen=True)
        correction = self._policy(
            lambda: ScoreEntry(
                entry_id=uuid4(),
                season_id=original.season_id,
                person_id=original.person_id,
                source_type=original.source_type,
                source_id=uuid4(),
                rule_id=original.rule_id,
                points=points_delta,
                occurred_at=occurred_at,
                correction_of=original.entry_id,
                correction_reason=reason,
            )
        )
        return await self.store.add_score_entry(correction)

    async def rebuild(self, actor: ActorContext, season_id: UUID) -> tuple[Standing, ...]:
        self._operator(actor)
        _, policy = await self._active_policy(season_id, allow_frozen=True)
        members = await self.store.cohort_members(policy)
        entries = await self.store.score_entries(season_id)
        rows = rebuild_standings(policy, members, entries)
        return await self.store.replace_standings(season_id, rows)

    async def _active_policy(
        self, season_id: UUID, *, allow_frozen: bool = False
    ) -> tuple[RatingSeason, RatingPolicy]:
        season = await self.store.season(season_id)
        if season is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        allowed = {SeasonStatus.OPEN, SeasonStatus.CLOSING}
        if allow_frozen:
            allowed.add(SeasonStatus.FROZEN)
        if season.status not in allowed or season.policy_version is None:
            raise ApiError("SEASON_NOT_ACTIVE", "Season does not accept score records.", 409)
        policy = await self.store.latest_policy(season_id)
        if policy is None or policy.version != season.policy_version:
            raise ApiError("RATING_POLICY_INCOMPLETE", "Bound season policy is unavailable.", 409)
        return season, policy
