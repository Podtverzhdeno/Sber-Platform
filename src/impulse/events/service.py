"""Application service for event detail and privacy-safe registration aggregates."""

from __future__ import annotations

from datetime import UTC, datetime

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext
from impulse.events.models import (
    AGGREGATE_DEFINITION_VERSION,
    CounterState,
    EventDetailRecord,
    RegistrationAggregate,
    RegistrationCounts,
)
from impulse.events.store import EventDetailStore


def registration_counter_state(counts: RegistrationCounts) -> CounterState:
    """Distinguish available numbers, honest zero and an unavailable projection."""
    if counts.started is None or counts.confirmed is None or counts.participations is None:
        return "unknown"
    if max(counts.started, counts.confirmed, counts.participations) == 0:
        return "zero"
    return "ok"


class ParticipantEventsService:
    """Published detail data with no personal identifiers in public counters."""

    def __init__(self, detail_store: EventDetailStore) -> None:
        self.detail_store = detail_store

    async def event_detail(self, _actor: ActorContext, event_key: str) -> EventDetailRecord:
        record = await self.detail_store.event_detail(event_key)
        if record is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return record

    async def registration_aggregate(
        self, _actor: ActorContext, event_key: str
    ) -> RegistrationAggregate:
        record = await self.event_detail(_actor, event_key)
        counts = await self.detail_store.registration_counts(event_key)
        return RegistrationAggregate(
            event_key=event_key,
            started_registrations=counts.started,
            confirmed_registrations=counts.confirmed,
            participations=counts.participations,
            counter_state=registration_counter_state(counts),
            computed_at=datetime.now(UTC),
            source_checked_at=record.source_checked_at,
            definition_version=AGGREGATE_DEFINITION_VERSION,
        )
