"""SQL append-only sink for the closed task-catalog analytics dictionary."""

from __future__ import annotations

from typing import Any, cast
from uuid import uuid4

from sqlalchemy import CursorResult, select
from sqlalchemy.dialects.postgresql import insert

from impulse.application.task_catalog_analytics import (
    CatalogAnalyticsConflict,
    CatalogAnalyticsEvent,
    CatalogAnalyticsStore,
)
from impulse.domain.events import safe_event_payload
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.insight import domain_events


class SqlCatalogAnalyticsStore(CatalogAnalyticsStore):
    def __init__(self, database: Database) -> None:
        self._database = database

    async def append(self, event: CatalogAnalyticsEvent) -> bool:
        event_type = f"task_catalog.{event.event_name.value}"
        payload = safe_event_payload(event.payload)
        async with self._database.session() as session:
            insert_result = await session.execute(
                insert(domain_events)
                .values(
                    id=uuid4(),
                    event_key=event.event_key,
                    event_type=event_type,
                    schema_version=1,
                    entity_type="participant_task_catalog",
                    entity_id=event.person_id,
                    entity_version=1,
                    occurred_at=event.occurred_at,
                    created_by=event.person_id,
                    data_origin="participant",
                    status="recorded",
                    provenance={"dictionary": "task-catalog-analytics-v1"},
                    payload=payload,
                )
                .on_conflict_do_nothing(constraint="uq_domain_events_event_key")
            )
            existing = (
                await session.execute(
                    select(
                        domain_events.c.event_type,
                        domain_events.c.entity_id,
                        domain_events.c.payload,
                    ).where(domain_events.c.event_key == event.event_key)
                )
            ).one()
            if (
                existing.event_type != event_type
                or existing.entity_id != event.person_id
                or existing.payload != payload
            ):
                raise CatalogAnalyticsConflict("Analytics event id has a different payload")
            # ``occurred_at`` is deliberately excluded from idempotency comparison:
            # retries have a new receive time but represent the same client event.
            return cast(CursorResult[Any], insert_result).rowcount == 0


__all__ = ["SqlCatalogAnalyticsStore"]
