"""Human-controlled talent pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role


class PipelineStage(StrEnum):
    INVITATION = "invitation"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRE = "hire"


PIPELINE_ORDER = tuple(PipelineStage)


@dataclass(frozen=True, slots=True)
class PipelineEvent:
    id: UUID
    candidate_id: UUID
    hr_id: UUID
    stage: PipelineStage
    note: str
    occurred_at: datetime
    origin: str = "human"


class TalentStore(Protocol):
    async def events(self, hr_id: UUID) -> tuple[PipelineEvent, ...]: ...
    async def add(self, event: PipelineEvent) -> PipelineEvent: ...


class MemoryTalentStore:
    def __init__(self) -> None:
        self._events: list[PipelineEvent] = []

    async def events(self, hr_id: UUID) -> tuple[PipelineEvent, ...]:
        return tuple(item for item in self._events if item.hr_id == hr_id)

    async def add(self, event: PipelineEvent) -> PipelineEvent:
        self._events.append(event)
        return event


class TalentService:
    def __init__(self, store: TalentStore) -> None:
        self.store = store

    async def events(self, actor: ActorContext) -> tuple[PipelineEvent, ...]:
        self._require_hr(actor)
        return await self.store.events(actor.person_id)

    async def record(
        self, actor: ActorContext, candidate_id: UUID, stage: PipelineStage, note: str
    ) -> PipelineEvent:
        self._require_hr(actor)
        existing = [
            item
            for item in await self.store.events(actor.person_id)
            if item.candidate_id == candidate_id
        ]
        completed = {item.stage for item in existing}
        if stage in completed:
            raise ApiError("PIPELINE_STAGE_EXISTS", "This human decision is already recorded.", 409)
        expected = PIPELINE_ORDER[len(completed)] if len(completed) < len(PIPELINE_ORDER) else None
        if stage is not expected:
            raise ApiError("INVALID_PIPELINE_TRANSITION", "Record pipeline stages in order.", 409)
        return await self.store.add(
            PipelineEvent(
                id=uuid4(),
                candidate_id=candidate_id,
                hr_id=actor.person_id,
                stage=stage,
                note=note.strip(),
                occurred_at=datetime.now(UTC),
            )
        )

    @staticmethod
    def _require_hr(actor: ActorContext) -> None:
        if actor.active_role is not Role.HR or "talent-pipeline:write" not in actor.scopes:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
