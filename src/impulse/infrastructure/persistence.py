"""Optimistic mutation with atomic append-only history."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Table, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.domain.events import safe_event_payload
from impulse.infrastructure.models.insight import audit_entries, domain_events


class StaleVersionError(RuntimeError):
    def __init__(self, entity_type: str, entity_id: UUID, expected_version: int) -> None:
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.expected_version = expected_version
        super().__init__(f"Stale {entity_type} version: expected {expected_version}")


async def emit_domain_event(
    session: AsyncSession,
    *,
    event_key: str,
    event_type: str,
    entity_type: str,
    entity_id: UUID,
    entity_version: int,
    actor_id: UUID | None,
    payload: Mapping[str, object] | None = None,
) -> None:
    """Append one idempotent event inside the caller-owned transaction."""
    await session.execute(
        insert(domain_events)
        .values(
            id=uuid4(),
            event_key=event_key,
            event_type=event_type,
            schema_version=1,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_version=entity_version,
            occurred_at=datetime.now(UTC),
            created_by=actor_id,
            data_origin="human" if actor_id is not None else "system",
            payload=safe_event_payload(payload),
        )
        .on_conflict_do_nothing(constraint="uq_domain_events_event_key")
    )


async def mutate_with_history(
    session: AsyncSession,
    *,
    table: Table,
    entity_id: UUID,
    expected_version: int,
    changes: Mapping[str, object],
    actor_id: UUID | None,
    action: str,
    event_key: str,
    event_type: str,
    event_payload: Mapping[str, object] | None = None,
) -> int:
    """Update one versioned entity and append audit/event in the same transaction."""
    emitted_version = await session.scalar(
        select(domain_events.c.entity_version).where(domain_events.c.event_key == event_key)
    )
    if emitted_version is not None:
        return int(emitted_version)
    safe_payload = safe_event_payload(event_payload)
    statement = (
        update(table)
        .where(table.c.id == entity_id, table.c.version == expected_version)
        .values(**changes, version=expected_version + 1, updated_at=datetime.now(UTC))
        .returning(table.c.version)
    )
    next_version = await session.scalar(statement)
    if next_version is None:
        raise StaleVersionError(table.name, entity_id, expected_version)

    await session.execute(
        insert(audit_entries).values(
            id=uuid4(),
            action=action,
            entity_type=table.name,
            entity_id=entity_id,
            entity_version=next_version,
            actor_id=actor_id,
            created_by=actor_id,
            payload={"changed_fields": sorted(changes)},
        )
    )
    await emit_domain_event(
        session,
        event_key=event_key,
        event_type=event_type,
        entity_type=table.name,
        entity_id=entity_id,
        entity_version=next_version,
        actor_id=actor_id,
        payload=safe_payload,
    )
    return next_version
