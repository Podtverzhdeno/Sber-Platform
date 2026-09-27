"""Rating season and published policy use cases."""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol, TypeVar
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role
from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingPolicyError,
    RatingSeason,
    ScoreSourceRule,
    SeasonStatus,
    TieBreaker,
)

T = TypeVar("T")


class RecognitionStore(Protocol):
    async def season(self, season_id: UUID) -> RatingSeason | None: ...
    async def add_season(self, season: RatingSeason) -> RatingSeason: ...
    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None: ...
    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy: ...
    async def save_season(
        self, season: RatingSeason, expected_version: int
    ) -> RatingSeason: ...


class MemoryRecognitionStore:
    def __init__(self) -> None:
        self._seasons: dict[UUID, RatingSeason] = {}
        self._policies: dict[UUID, tuple[RatingPolicy, ...]] = {}

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

    async def save_season(
        self, season: RatingSeason, expected_version: int
    ) -> RatingSeason:
        current = self._seasons.get(season.season_id)
        if current is None or current.version != expected_version:
            raise ApiError("STALE_SEASON", "Сезон изменился. Обновите данные.", 409)
        self._seasons[season.season_id] = season
        return season


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

    async def create_season(
        self, actor: ActorContext, *, key: str, title: str
    ) -> RatingSeason:
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
