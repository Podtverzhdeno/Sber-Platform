"""Event catalog, participation claims and external evidence use cases."""
# ruff: noqa: RUF001

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.ecosystem import (
    ClaimStatus,
    ClaimTransitionError,
    ExternalIdentity,
    claim_creates_trophy,
    transition_claim,
)
from impulse.domain.identity import ActorContext, Role


@dataclass(frozen=True, slots=True)
class EventRecord:
    key: str
    title: str
    event_type: str
    organizer: str
    conditions: str
    source_url: str
    deadline_at: datetime | None
    starts_at: datetime | None
    status: str
    track_keys: tuple[str, ...]
    recommendation_reason: str
    source_checked_at: datetime
    source_status: str = "current"


@dataclass(frozen=True, slots=True)
class EventPage:
    items: tuple[EventRecord, ...]
    next_cursor: str | None
    has_more: bool


@dataclass(frozen=True, slots=True)
class ClaimRecord:
    id: UUID
    person_id: UUID
    event_key: str
    claim_type: str
    status: ClaimStatus
    provider_id: str | None = None
    external_id: str | None = None


class EcosystemStore(Protocol):
    async def events(self) -> tuple[EventRecord, ...]: ...

    async def claims(self, person_id: UUID) -> tuple[ClaimRecord, ...]: ...

    async def claim(self, claim_id: UUID) -> ClaimRecord | None: ...

    async def create_claim(
        self, person_id: UUID, event_key: str, claim_type: str
    ) -> ClaimRecord: ...

    async def set_claim_status(
        self, claim_id: UUID, status: ClaimStatus, actor_id: UUID
    ) -> ClaimRecord: ...

    async def import_claim(
        self,
        identity: ExternalIdentity,
        event_key: str,
        claim_type: str,
        actor_id: UUID,
    ) -> ClaimRecord: ...


class MemoryEcosystemStore:
    def __init__(self, *, people: dict[str, UUID] | None = None) -> None:
        from datetime import UTC

        checked = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
        self._events = (
            EventRecord(
                "mayaki-2026",
                "МАЯКИ 2026",
                "educational_program",
                "Сбер",
                "Отбор по заявке и мотивации участника.",
                "https://example.test/events/mayaki",
                datetime(2026, 10, 10, 20, 59, tzinfo=UTC),
                datetime(2026, 11, 1, 9, 0, tzinfo=UTC),
                "open",
                ("python", "data", "product"),
                "Даёт практику командной работы и знакомство с направлениями Сбера.",
                checked,
            ),
            EventRecord(
                "green-hack-2026",
                "Green Hack",
                "hackathon",
                "Сбер",
                "Команда от двух до пяти человек.",
                "https://example.test/events/green-hack",
                datetime(2026, 10, 20, 20, 59, tzinfo=UTC),
                datetime(2026, 11, 8, 8, 0, tzinfo=UTC),
                "open",
                ("python", "ml"),
                "Подходит для проверки навыков разработки на реальном кейсе.",
                checked,
            ),
            EventRecord(
                "research-grant-2026",
                "Грант на исследование",
                "grant",
                "Сбер и университеты-партнёры",
                "Требуется описание исследовательской гипотезы.",
                "https://example.test/events/research-grant",
                datetime(2026, 12, 1, 20, 59, tzinfo=UTC),
                None,
                "open",
                ("data", "ml"),
                "Релевантно аналитическим и ML-направлениям.",
                checked,
            ),
        )
        self.people = people or {}
        self._claims: dict[UUID, ClaimRecord] = {}
        self._provider_records: dict[tuple[str, str], UUID] = {}
        self.trophies: set[UUID] = set()
        self.corrections: list[UUID] = []

    async def events(self) -> tuple[EventRecord, ...]:
        return self._events

    async def claims(self, person_id: UUID) -> tuple[ClaimRecord, ...]:
        return tuple(item for item in self._claims.values() if item.person_id == person_id)

    async def claim(self, claim_id: UUID) -> ClaimRecord | None:
        return self._claims.get(claim_id)

    async def create_claim(self, person_id: UUID, event_key: str, claim_type: str) -> ClaimRecord:
        if event_key not in {item.key for item in self._events}:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        for item in self._claims.values():
            if (item.person_id, item.event_key, item.claim_type) == (
                person_id,
                event_key,
                claim_type,
            ):
                return item
        record = ClaimRecord(uuid4(), person_id, event_key, claim_type, ClaimStatus.REPORTED)
        self._claims[record.id] = record
        return record

    async def set_claim_status(
        self, claim_id: UUID, status: ClaimStatus, actor_id: UUID
    ) -> ClaimRecord:
        current = self._claims.get(claim_id)
        if current is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        record = ClaimRecord(
            current.id,
            current.person_id,
            current.event_key,
            current.claim_type,
            status,
            current.provider_id,
            current.external_id,
        )
        self._claims[claim_id] = record
        if claim_creates_trophy(record.claim_type, status):
            self.trophies.add(claim_id)
        if status is ClaimStatus.REVOKED:
            self.trophies.discard(claim_id)
            self.corrections.append(claim_id)
        return record

    async def import_claim(
        self,
        identity: ExternalIdentity,
        event_key: str,
        claim_type: str,
        actor_id: UUID,
    ) -> ClaimRecord:
        provider_key = (identity.provider_id, identity.external_id)
        existing_id = self._provider_records.get(provider_key)
        if existing_id is not None:
            return self._claims[existing_id]
        person_id = self.people.get(identity.person_external_key)
        if person_id is None:
            raise ApiError(
                code="IDENTITY_NOT_MATCHED",
                message="Внешний идентификатор участника не найден.",
                status_code=422,
            )
        record = await self.create_claim(person_id, event_key, claim_type)
        record = ClaimRecord(
            record.id,
            record.person_id,
            record.event_key,
            record.claim_type,
            record.status,
            identity.provider_id,
            identity.external_id,
        )
        self._claims[record.id] = record
        self._provider_records[provider_key] = record.id
        return record


class EcosystemService:
    def __init__(self, store: EcosystemStore) -> None:
        self.store = store

    @staticmethod
    def _require_role(actor: ActorContext, role: Role) -> None:
        if actor.active_role is not role:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для роли.", status_code=403
            )

    async def catalog(
        self,
        actor: ActorContext,
        *,
        track: str | None,
        event_type: str | None,
        status: str | None,
        cursor: str | None,
        limit: int,
    ) -> EventPage:
        self._require_role(actor, Role.PARTICIPANT)
        items = sorted(await self.store.events(), key=lambda item: item.key)
        if track:
            items = [item for item in items if track in item.track_keys]
        if event_type:
            items = [item for item in items if item.event_type == event_type]
        if status:
            items = [item for item in items if item.status == status]
        if cursor:
            items = [item for item in items if item.key > cursor]
        page_items = items[:limit]
        has_more = len(items) > limit
        return EventPage(
            tuple(page_items),
            page_items[-1].key if has_more and page_items else None,
            has_more,
        )

    async def participant_claims(self, actor: ActorContext) -> tuple[ClaimRecord, ...]:
        self._require_role(actor, Role.PARTICIPANT)
        return await self.store.claims(actor.person_id)

    async def report(self, actor: ActorContext, event_key: str, claim_type: str) -> ClaimRecord:
        self._require_role(actor, Role.PARTICIPANT)
        return await self.store.create_claim(actor.person_id, event_key, claim_type)

    async def submit(self, actor: ActorContext, claim_id: UUID) -> ClaimRecord:
        self._require_role(actor, Role.PARTICIPANT)
        claim = await self.store.claim(claim_id)
        if claim is None or claim.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        target = self._transition(claim.status, ClaimStatus.AWAITING_VERIFICATION)
        return await self.store.set_claim_status(claim_id, target, actor.person_id)

    async def decide(self, actor: ActorContext, claim_id: UUID, target: ClaimStatus) -> ClaimRecord:
        self._require_role(actor, Role.OPERATOR)
        claim = await self.store.claim(claim_id)
        if claim is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        next_status = self._transition(claim.status, target)
        return await self.store.set_claim_status(claim_id, next_status, actor.person_id)

    async def import_external(
        self,
        actor: ActorContext,
        identity: ExternalIdentity,
        event_key: str,
        claim_type: str,
    ) -> ClaimRecord:
        self._require_role(actor, Role.OPERATOR)
        return await self.store.import_claim(identity, event_key, claim_type, actor.person_id)

    @staticmethod
    def _transition(current: ClaimStatus, target: ClaimStatus) -> ClaimStatus:
        try:
            return transition_claim(current, target)
        except ClaimTransitionError as exc:
            raise ApiError(
                code="INVALID_CLAIM_TRANSITION", message=str(exc), status_code=409
            ) from exc
