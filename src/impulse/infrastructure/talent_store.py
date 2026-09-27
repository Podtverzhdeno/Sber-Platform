"""PostgreSQL adapter for human talent pipeline events."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import insert, select

from impulse.application.talent import PipelineEvent, PipelineStage, TalentStore
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.talent import talent_pipeline_events


class SqlTalentStore(TalentStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(row: Any) -> PipelineEvent:
        return PipelineEvent(
            id=row.id,
            candidate_id=row.candidate_id,
            hr_id=row.hr_id,
            stage=PipelineStage(row.stage),
            note=row.note,
            occurred_at=row.occurred_at,
            origin=row.data_origin,
        )

    async def events(self, hr_id: UUID) -> tuple[PipelineEvent, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(talent_pipeline_events)
                    .where(talent_pipeline_events.c.hr_id == hr_id)
                    .order_by(talent_pipeline_events.c.occurred_at)
                )
            ).all()
            return tuple(self._record(row) for row in rows)

    async def add(self, event: PipelineEvent) -> PipelineEvent:
        async with self.database.session() as session:
            await session.execute(
                insert(talent_pipeline_events).values(
                    id=event.id,
                    candidate_id=event.candidate_id,
                    hr_id=event.hr_id,
                    stage=event.stage.value,
                    note=event.note,
                    occurred_at=event.occurred_at,
                    data_origin="human",
                    created_by=event.hr_id,
                )
            )
        return event
