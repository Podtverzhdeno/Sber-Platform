"""PostgreSQL persistence for rating seasons and immutable policy versions."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from impulse.api.errors import ApiError
from impulse.application.recognition import RecognitionStore
from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingSeason,
    ScoreSourceRule,
    SeasonStatus,
    TieBreaker,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.recognition import rating_policies, seasons


class SqlRecognitionStore(RecognitionStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def season(self, season_id: UUID) -> RatingSeason | None:
        async with self.database.sessions() as session:
            row = (
                (await session.execute(select(seasons).where(seasons.c.id == season_id)))
                .mappings()
                .one_or_none()
            )
        return self._season(row) if row is not None else None

    async def add_season(self, season: RatingSeason) -> RatingSeason:
        try:
            async with self.database.session() as session:
                await session.execute(insert(seasons).values(**self._season_values(season)))
        except IntegrityError as exc:
            raise ApiError("SEASON_KEY_EXISTS", "Season key is already used.", 409) from exc
        return season

    async def latest_policy(self, season_id: UUID) -> RatingPolicy | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(rating_policies)
                        .where(rating_policies.c.season_id == season_id)
                        .order_by(rating_policies.c.policy_version.desc())
                        .limit(1)
                    )
                )
                .mappings()
                .one_or_none()
            )
        return self._policy(row) if row is not None else None

    async def add_policy(self, policy: RatingPolicy) -> RatingPolicy:
        try:
            async with self.database.session() as session:
                await session.execute(insert(rating_policies).values(**self._policy_values(policy)))
        except IntegrityError as exc:
            raise ApiError("STALE_POLICY", "Policy version changed.", 409) from exc
        return policy

    async def save_season(self, season: RatingSeason, expected_version: int) -> RatingSeason:
        async with self.database.session() as session:
            result = await session.execute(
                update(seasons)
                .where(seasons.c.id == season.season_id, seasons.c.version == expected_version)
                .values(**self._season_values(season, include_id=False))
                .returning(seasons.c.id)
            )
            if result.scalar_one_or_none() is None:
                raise ApiError("STALE_SEASON", "Season changed. Refresh data.", 409)
        return season

    @staticmethod
    def _season_values(season: RatingSeason, *, include_id: bool = True) -> dict[str, object]:
        values: dict[str, object] = {
            "season_key": season.key,
            "title": season.title,
            "status": season.status.value,
            "version": season.version,
            "payload": {"policy_version": season.policy_version},
            "data_origin": "demo_runtime",
        }
        if include_id:
            values["id"] = season.season_id
        return values

    @staticmethod
    def _policy_values(policy: RatingPolicy) -> dict[str, object]:
        return {
            "id": policy.policy_id,
            "season_id": policy.season_id,
            "policy_version": policy.version,
            "version": policy.version,
            "status": "published",
            "data_origin": "demo_runtime",
            "payload": {
                "cohort": {
                    "key": policy.cohort.key,
                    "title": policy.cohort.title,
                    "program_key": policy.cohort.program_key,
                    "track_keys": list(policy.cohort.track_keys),
                    "minimum_size": policy.cohort.minimum_size,
                },
                "sources": [
                    {
                        "rule_id": item.rule_id,
                        "source_type": item.source_type,
                        "weight": str(item.weight),
                        "cap": str(item.cap),
                    }
                    for item in policy.sources
                ],
                "tie_breakers": [item.value for item in policy.tie_breakers],
                "diploma_thresholds": [
                    {
                        "level": item.level,
                        "place_from": item.place_from,
                        "place_to": item.place_to,
                        "title": item.title,
                    }
                    for item in policy.diploma_thresholds
                ],
                "appeal_period_days": policy.appeal_period_days,
            },
        }

    @staticmethod
    def _season(row: RowMapping) -> RatingSeason:
        payload = dict(row["payload"])
        policy_version = payload.get("policy_version")
        return RatingSeason(
            season_id=row["id"],
            key=row["season_key"],
            title=row["title"],
            status=SeasonStatus(row["status"]),
            version=row["version"],
            policy_version=int(policy_version) if policy_version is not None else None,
        )

    @staticmethod
    def _policy(row: RowMapping) -> RatingPolicy:
        payload = dict(row["payload"])
        cohort = payload["cohort"]
        return RatingPolicy(
            policy_id=row["id"],
            season_id=row["season_id"],
            version=row["policy_version"],
            cohort=CohortRule(
                key=str(cohort["key"]),
                title=str(cohort["title"]),
                program_key=str(cohort["program_key"]),
                track_keys=tuple(str(item) for item in cohort["track_keys"]),
                minimum_size=int(cohort["minimum_size"]),
            ),
            sources=tuple(
                ScoreSourceRule(
                    rule_id=str(item["rule_id"]),
                    source_type=str(item["source_type"]),
                    weight=Decimal(str(item["weight"])),
                    cap=Decimal(str(item["cap"])),
                )
                for item in payload["sources"]
            ),
            tie_breakers=tuple(TieBreaker(str(item)) for item in payload["tie_breakers"]),
            diploma_thresholds=tuple(
                DiplomaThreshold(
                    level=str(item["level"]),
                    place_from=int(item["place_from"]),
                    place_to=int(item["place_to"]),
                    title=str(item["title"]),
                )
                for item in payload["diploma_thresholds"]
            ),
            appeal_period_days=int(payload["appeal_period_days"]),
        )
