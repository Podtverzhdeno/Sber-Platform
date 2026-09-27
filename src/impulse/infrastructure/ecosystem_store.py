"""PostgreSQL adapter for events and verified external participation."""
# ruff: noqa: RUF001

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.api.errors import ApiError
from impulse.application.ecosystem import ClaimRecord, EcosystemStore, EventRecord
from impulse.domain.ecosystem import ClaimStatus, ExternalIdentity, claim_creates_trophy
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.ecosystem import (
    events,
    external_sources,
    participation_claims,
    provider_records,
)
from impulse.infrastructure.models.identity import persons
from impulse.infrastructure.models.recognition import credentials, score_ledger, trophies


def _datetime(value: object, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
    return fallback


class SqlEcosystemStore(EcosystemStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def events(self) -> tuple[EventRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(
                        events.c.event_key,
                        events.c.title,
                        events.c.deadline_at,
                        events.c.status,
                        events.c.payload,
                        external_sources.c.provider,
                        external_sources.c.source_url,
                        external_sources.c.status.label("source_status"),
                        external_sources.c.payload.label("source_payload"),
                        external_sources.c.updated_at.label("source_updated_at"),
                    )
                    .join(external_sources, external_sources.c.id == events.c.source_id)
                    .order_by(events.c.event_key)
                )
            ).mappings()
            result: list[EventRecord] = []
            for row in rows:
                payload = dict(row["payload"])
                source_payload = dict(row["source_payload"])
                result.append(
                    EventRecord(
                        key=row["event_key"],
                        title=row["title"],
                        event_type=str(payload.get("event_type", "program")),
                        organizer=str(payload.get("organizer", row["provider"])),
                        conditions=str(
                            payload.get("conditions", "Условия доступны у организатора.")
                        ),
                        source_url=row["source_url"],
                        deadline_at=row["deadline_at"],
                        starts_at=(
                            _datetime(payload["starts_at"], row["source_updated_at"])
                            if payload.get("starts_at")
                            else None
                        ),
                        status=row["status"],
                        track_keys=tuple(str(item) for item in payload.get("track_keys", [])),
                        recommendation_reason=str(
                            payload.get(
                                "recommendation_reason",
                                "Связано с выбранным профессиональным направлением.",
                            )
                        ),
                        source_checked_at=_datetime(
                            source_payload.get("checked_at"), row["source_updated_at"]
                        ),
                        source_status=row["source_status"],
                    )
                )
            return tuple(result)

    @staticmethod
    def _claim_select():
        return select(
            participation_claims.c.id,
            participation_claims.c.person_id,
            events.c.event_key,
            participation_claims.c.claim_type,
            participation_claims.c.status,
            participation_claims.c.payload,
        ).join(events, events.c.id == participation_claims.c.event_id)

    @staticmethod
    def _record(row: Any) -> ClaimRecord:
        payload = dict(row.payload)
        return ClaimRecord(
            id=row.id,
            person_id=row.person_id,
            event_key=row.event_key,
            claim_type=row.claim_type,
            status=ClaimStatus(row.status),
            provider_id=payload.get("provider_id"),
            external_id=payload.get("external_id"),
        )

    async def claims(self, person_id: UUID) -> tuple[ClaimRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    self._claim_select()
                    .where(participation_claims.c.person_id == person_id)
                    .order_by(participation_claims.c.created_at.desc())
                )
            ).all()
            return tuple(self._record(row) for row in rows)

    async def claim(self, claim_id: UUID) -> ClaimRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    self._claim_select().where(participation_claims.c.id == claim_id)
                )
            ).one_or_none()
            return self._record(row) if row is not None else None

    async def create_claim(self, person_id: UUID, event_key: str, claim_type: str) -> ClaimRecord:
        async with self.database.session() as session:
            event_id = await session.scalar(
                select(events.c.id).where(events.c.event_key == event_key)
            )
            if event_id is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            existing = (
                await session.execute(
                    self._claim_select().where(
                        participation_claims.c.person_id == person_id,
                        participation_claims.c.event_id == event_id,
                        participation_claims.c.claim_type == claim_type,
                    )
                )
            ).one_or_none()
            if existing is not None:
                return self._record(existing)
            claim_id = uuid4()
            await session.execute(
                postgres_insert(participation_claims).values(
                    id=claim_id,
                    person_id=person_id,
                    event_id=event_id,
                    claim_type=claim_type,
                    status=ClaimStatus.REPORTED.value,
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
            )
        record = await self.claim(claim_id)
        if record is None:
            raise RuntimeError("Created participation claim was not found")
        return record

    async def set_claim_status(
        self, claim_id: UUID, status: ClaimStatus, actor_id: UUID
    ) -> ClaimRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    self._claim_select()
                    .where(participation_claims.c.id == claim_id)
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            record = self._record(row)
            await session.execute(
                update(participation_claims)
                .where(participation_claims.c.id == claim_id)
                .values(
                    status=status.value,
                    version=participation_claims.c.version + 1,
                    created_by=actor_id,
                )
            )
            if claim_creates_trophy(record.claim_type, status):
                await session.execute(
                    postgres_insert(trophies)
                    .values(
                        person_id=record.person_id,
                        participation_claim_id=claim_id,
                        trophy_type=record.claim_type,
                        status="verified",
                        data_origin="demo_runtime",
                        created_by=actor_id,
                    )
                    .on_conflict_do_nothing(
                        constraint="uq_trophies_person_id_participation_claim_id_trophy_type"
                    )
                )
            if status is ClaimStatus.REVOKED:
                await self._invalidate_dependents(session, record, actor_id)
        updated = await self.claim(claim_id)
        if updated is None:
            raise RuntimeError("Updated participation claim was not found")
        return updated

    async def _invalidate_dependents(
        self, session: AsyncSession, claim: ClaimRecord, actor_id: UUID
    ) -> None:
        await session.execute(
            update(trophies)
            .where(
                trophies.c.participation_claim_id == claim.id,
                trophies.c.status != "revoked",
            )
            .values(
                status="revoked",
                version=trophies.c.version + 1,
                payload={"revocation_reason": "source_revoked", "source_claim_id": str(claim.id)},
            )
        )
        score_rows = (
            await session.execute(
                select(score_ledger).where(
                    score_ledger.c.source_type == "participation_claim",
                    score_ledger.c.source_id == claim.id,
                    score_ledger.c.points > 0,
                )
            )
        ).mappings()
        for score in score_rows:
            await session.execute(
                postgres_insert(score_ledger)
                .values(
                    season_id=score["season_id"],
                    person_id=score["person_id"],
                    source_type="participation_claim_correction",
                    source_id=claim.id,
                    rule_id=f"revoke:{score['id']}",
                    points=-Decimal(score["points"]),
                    status="correction",
                    data_origin="demo_runtime",
                    payload={"corrects_score_id": str(score["id"]), "reason": "source_revoked"},
                    created_by=actor_id,
                )
                .on_conflict_do_nothing(
                    constraint="uq_score_ledger_season_id_source_type_source_id_rule_id"
                )
            )

        credential_rows = (
            (
                await session.execute(
                    select(credentials)
                    .where(credentials.c.person_id == claim.person_id)
                    .order_by(credentials.c.season_id, credentials.c.credential_version.desc())
                )
            )
            .mappings()
            .all()
        )
        affected: dict[UUID, Any] = {}
        for credential in credential_rows:
            payload = dict(credential["payload"])
            if (
                str(claim.id) in payload.get("source_claim_ids", [])
                and credential["season_id"] not in affected
            ):
                affected[credential["season_id"]] = credential
        for season_id, credential in affected.items():
            already = any(
                row["season_id"] == season_id
                and dict(row["payload"]).get("correction_for_claim") == str(claim.id)
                for row in credential_rows
            )
            if already:
                continue
            next_version = (
                int(
                    await session.scalar(
                        select(func.max(credentials.c.credential_version)).where(
                            credentials.c.season_id == season_id,
                            credentials.c.person_id == claim.person_id,
                        )
                    )
                    or 0
                )
                + 1
            )
            await session.execute(
                postgres_insert(credentials).values(
                    season_id=season_id,
                    person_id=claim.person_id,
                    verification_id=f"revoked-{claim.id.hex}-{next_version}",
                    credential_version=next_version,
                    status="revoked",
                    data_origin="demo_runtime",
                    payload={
                        "supersedes_credential_id": str(credential["id"]),
                        "correction_for_claim": str(claim.id),
                        "reason": "source_revoked",
                    },
                    created_by=actor_id,
                )
            )

    async def import_claim(
        self,
        identity: ExternalIdentity,
        event_key: str,
        claim_type: str,
        actor_id: UUID,
    ) -> ClaimRecord:
        async with self.database.session() as session:
            existing_payload = await session.scalar(
                select(provider_records.c.payload).where(
                    provider_records.c.provider_id == identity.provider_id,
                    provider_records.c.external_id == identity.external_id,
                )
            )
            if existing_payload is not None:
                claim_id = UUID(str(existing_payload["claim_id"]))
            else:
                person_id = await session.scalar(
                    select(persons.c.id).where(
                        persons.c.external_key == identity.person_external_key
                    )
                )
                event_id = await session.scalar(
                    select(events.c.id).where(events.c.event_key == event_key)
                )
                if person_id is None:
                    raise ApiError(
                        code="IDENTITY_NOT_MATCHED",
                        message="Внешний идентификатор участника не найден.",
                        status_code=422,
                    )
                if event_id is None:
                    raise ApiError(
                        code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                    )
                claim_id = await session.scalar(
                    select(participation_claims.c.id).where(
                        participation_claims.c.person_id == person_id,
                        participation_claims.c.event_id == event_id,
                        participation_claims.c.claim_type == claim_type,
                    )
                )
                if claim_id is None:
                    claim_id = uuid4()
                    await session.execute(
                        postgres_insert(participation_claims).values(
                            id=claim_id,
                            person_id=person_id,
                            event_id=event_id,
                            claim_type=claim_type,
                            status=ClaimStatus.AWAITING_VERIFICATION.value,
                            data_origin="demo_runtime",
                            payload={
                                "provider_id": identity.provider_id,
                                "external_id": identity.external_id,
                            },
                            created_by=actor_id,
                        )
                    )
                source_id = await session.scalar(
                    select(external_sources.c.id)
                    .where(external_sources.c.provider == identity.provider_id)
                    .limit(1)
                )
                if source_id is None:
                    source_id = uuid4()
                    await session.execute(
                        postgres_insert(external_sources).values(
                            id=source_id,
                            provider=identity.provider_id,
                            source_key=f"manual:{identity.provider_id}",
                            source_url="https://example.test/manual-source",
                            status="manual",
                            data_origin="demo_runtime",
                            created_by=actor_id,
                        )
                    )
                await session.execute(
                    postgres_insert(provider_records)
                    .values(
                        provider_id=identity.provider_id,
                        external_id=identity.external_id,
                        source_id=source_id,
                        status="imported",
                        data_origin="demo_runtime",
                        payload={
                            "claim_id": str(claim_id),
                            "person_external_key": identity.person_external_key,
                        },
                        created_by=actor_id,
                    )
                    .on_conflict_do_nothing(
                        constraint="uq_provider_records_provider_id_external_id"
                    )
                )
        record = await self.claim(claim_id)
        if record is None:
            raise RuntimeError("Imported participation claim was not found")
        return record
