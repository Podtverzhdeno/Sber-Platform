"""PostgreSQL persistence for rating seasons and immutable policy versions."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from impulse.api.errors import ApiError
from impulse.application.recognition import RecognitionStore
from impulse.domain.recognition import (
    CohortMember,
    CohortRule,
    DiplomaThreshold,
    LeaderboardCandidate,
    RatingPolicy,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    SeasonStatus,
    Standing,
    TieBreaker,
    TrophyProof,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.development import track_attempts, tracks
from impulse.infrastructure.models.ecosystem import (
    events,
    external_sources,
    participation_claims,
)
from impulse.infrastructure.models.identity import actor_roles, persons, visibility_settings
from impulse.infrastructure.models.recognition import (
    rating_policies,
    score_ledger,
    seasons,
    standings,
    trophies,
)


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

    async def score_entry(self, entry_id: UUID) -> ScoreEntry | None:
        async with self.database.sessions() as session:
            row = (
                (await session.execute(select(score_ledger).where(score_ledger.c.id == entry_id)))
                .mappings()
                .one_or_none()
            )
        return self._score_entry(row) if row is not None else None

    async def add_score_entry(self, entry: ScoreEntry) -> ScoreEntry:
        try:
            async with self.database.session() as session:
                await session.execute(
                    insert(score_ledger).values(
                        id=entry.entry_id,
                        season_id=entry.season_id,
                        person_id=entry.person_id,
                        source_type=entry.source_type,
                        source_id=entry.source_id,
                        rule_id=entry.rule_id,
                        points=entry.points,
                        status="correction" if entry.correction_of else "recorded",
                        data_origin="demo_runtime",
                        payload={
                            "occurred_at": entry.occurred_at.isoformat(),
                            "correction_of": (
                                str(entry.correction_of) if entry.correction_of else None
                            ),
                            "correction_reason": entry.correction_reason,
                        },
                    )
                )
        except IntegrityError as exc:
            raise ApiError(
                "DUPLICATE_SCORE_SOURCE", "Score source is already recorded.", 409
            ) from exc
        return entry

    async def score_entries(self, season_id: UUID) -> tuple[ScoreEntry, ...]:
        async with self.database.sessions() as session:
            rows = (
                (
                    await session.execute(
                        select(score_ledger)
                        .where(score_ledger.c.season_id == season_id)
                        .order_by(score_ledger.c.created_at, score_ledger.c.id)
                    )
                )
                .mappings()
                .all()
            )
        return tuple(self._score_entry(row) for row in rows)

    async def cohort_members(self, policy: RatingPolicy) -> tuple[CohortMember, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(actor_roles.c.person_id, tracks.c.slug)
                    .join(
                        track_attempts,
                        track_attempts.c.person_id == actor_roles.c.person_id,
                    )
                    .join(tracks, tracks.c.id == track_attempts.c.track_id)
                    .where(
                        actor_roles.c.role == "participant",
                        actor_roles.c.program_key == policy.cohort.program_key,
                        track_attempts.c.status == "active",
                        tracks.c.slug.in_(policy.cohort.track_keys),
                    )
                )
            ).all()
        grouped: dict[UUID, set[str]] = {}
        for person_id, track_key in rows:
            grouped.setdefault(person_id, set()).add(track_key)
        return tuple(
            CohortMember(person_id, policy.cohort.program_key, tuple(sorted(track_keys)))
            for person_id, track_keys in sorted(grouped.items(), key=lambda item: str(item[0]))
        )

    async def replace_standings(
        self, season_id: UUID, rows: tuple[Standing, ...]
    ) -> tuple[Standing, ...]:
        async with self.database.session() as session:
            await session.execute(delete(standings).where(standings.c.season_id == season_id))
            if rows:
                await session.execute(
                    insert(standings),
                    [
                        {
                            "season_id": item.season_id,
                            "person_id": item.person_id,
                            "place": item.place,
                            "score": item.score,
                            "status": "current",
                            "data_origin": "derived",
                            "payload": {
                                "successful_projects": item.successful_projects,
                                "highest_project_score": str(item.highest_project_score),
                                "earliest_achievement": (
                                    item.earliest_achievement.isoformat()
                                    if item.earliest_achievement
                                    else None
                                ),
                            },
                        }
                        for item in rows
                    ],
                )
        return rows

    async def leaderboard_candidates(self, season_id: UUID) -> tuple[LeaderboardCandidate, ...]:
        rating_visibility = visibility_settings.alias("rating_visibility")
        trophy_visibility = visibility_settings.alias("trophy_visibility")
        async with self.database.sessions() as session:
            rows = (
                (
                    await session.execute(
                        select(
                            standings,
                            persons.c.display_name,
                            rating_visibility.c.visible.label("rating_visible"),
                            trophy_visibility.c.visible.label("trophies_visible"),
                        )
                        .join(persons, persons.c.id == standings.c.person_id)
                        .outerjoin(
                            rating_visibility,
                            (rating_visibility.c.person_id == standings.c.person_id)
                            & (rating_visibility.c.scope == "public_rating"),
                        )
                        .outerjoin(
                            trophy_visibility,
                            (trophy_visibility.c.person_id == standings.c.person_id)
                            & (trophy_visibility.c.scope == "public_trophies"),
                        )
                        .where(standings.c.season_id == season_id)
                        .order_by(standings.c.place)
                    )
                )
                .mappings()
                .all()
            )
            public_trophy_people = [
                row["person_id"]
                for row in rows
                if bool(row["rating_visible"]) and bool(row["trophies_visible"])
            ]
            trophy_rows: Sequence[RowMapping] = ()
            if public_trophy_people:
                trophy_rows = (
                    (
                        await session.execute(
                            select(
                                trophies.c.person_id,
                                trophies.c.trophy_type,
                                events.c.title,
                                external_sources.c.source_url,
                            )
                            .join(
                                participation_claims,
                                participation_claims.c.id == trophies.c.participation_claim_id,
                            )
                            .join(events, events.c.id == participation_claims.c.event_id)
                            .join(
                                external_sources,
                                external_sources.c.id == events.c.source_id,
                            )
                            .where(
                                trophies.c.person_id.in_(public_trophy_people),
                                trophies.c.status != "revoked",
                                participation_claims.c.status == "verified",
                            )
                            .order_by(events.c.title, trophies.c.id)
                        )
                    )
                    .mappings()
                    .all()
                )
        proofs: dict[UUID, list[TrophyProof]] = {}
        for row in trophy_rows:
            person_id = UUID(str(row["person_id"]))
            proofs.setdefault(person_id, []).append(
                TrophyProof(
                    trophy_type=str(row["trophy_type"]),
                    title=str(row["title"]),
                    source_url=str(row["source_url"]),
                )
            )
        return tuple(
            LeaderboardCandidate(
                standing=self._standing(row),
                display_name=row["display_name"],
                rating_visible=bool(row["rating_visible"]),
                trophies_visible=bool(row["trophies_visible"]),
                trophies=tuple(proofs.get(row["person_id"], ())),
            )
            for row in rows
        )

    @staticmethod
    def _score_entry(row: RowMapping) -> ScoreEntry:
        payload = dict(row["payload"])
        correction_of = payload.get("correction_of")
        return ScoreEntry(
            entry_id=row["id"],
            season_id=row["season_id"],
            person_id=row["person_id"],
            source_type=row["source_type"],
            source_id=row["source_id"],
            rule_id=row["rule_id"],
            points=Decimal(row["points"]),
            occurred_at=datetime.fromisoformat(str(payload["occurred_at"])),
            correction_of=UUID(str(correction_of)) if correction_of else None,
            correction_reason=(
                str(payload["correction_reason"])
                if payload.get("correction_reason") is not None
                else None
            ),
        )

    @staticmethod
    def _standing(row: RowMapping) -> Standing:
        payload = dict(row["payload"])
        earliest = payload.get("earliest_achievement")
        return Standing(
            season_id=row["season_id"],
            person_id=row["person_id"],
            place=row["place"],
            score=Decimal(row["score"]),
            successful_projects=int(payload.get("successful_projects", 0)),
            highest_project_score=Decimal(str(payload.get("highest_project_score", "0"))),
            earliest_achievement=(datetime.fromisoformat(str(earliest)) if earliest else None),
        )
