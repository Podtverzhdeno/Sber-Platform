"""PostgreSQL adapter for operator cases."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import insert, select, update

from impulse.api.errors import ApiError
from impulse.application.operations import CaseDecision, CaseStatus, OperationsCase, OperationsStore
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.operations import case_decisions, operations_cases


class SqlOperationsStore(OperationsStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _case(row: Any) -> OperationsCase:
        payload = dict(row.payload)
        return OperationsCase(
            row.id,
            row.case_type,
            row.title,
            row.priority,
            CaseStatus(row.status),
            row.version,
            tuple(payload.get("source_refs", [])),
            tuple(payload.get("dependency_refs", [])),
            row.due_at,
            row.updated_at,
        )

    async def cases(self) -> tuple[OperationsCase, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(operations_cases).order_by(operations_cases.c.created_at)
                )
            ).all()
            return tuple(self._case(row) for row in rows)

    async def case(self, case_id: UUID) -> OperationsCase | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(operations_cases).where(operations_cases.c.id == case_id)
                )
            ).one_or_none()
            return self._case(row) if row is not None else None

    async def decisions(self, case_id: UUID) -> tuple[CaseDecision, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(case_decisions)
                    .where(case_decisions.c.case_id == case_id)
                    .order_by(case_decisions.c.created_at)
                )
            ).all()
            return tuple(
                CaseDecision(
                    row.id,
                    row.case_id,
                    row.case_version,
                    row.actor_id,
                    row.outcome,
                    row.reason,
                    row.created_at,
                )
                for row in rows
            )

    async def decide(self, item: OperationsCase, decision: CaseDecision) -> OperationsCase:
        async with self.database.session() as session:
            changed = await session.scalar(
                update(operations_cases)
                .where(
                    operations_cases.c.id == item.id,
                    operations_cases.c.version == decision.case_version,
                )
                .values(
                    status=CaseStatus.RESOLVED.value,
                    version=decision.case_version + 1,
                    updated_at=decision.created_at,
                )
                .returning(operations_cases.c.id)
            )
            if changed is None:
                raise ApiError("STALE_CASE", "Case changed; reload before deciding.", 409)
            await session.execute(
                insert(case_decisions).values(
                    id=decision.id,
                    case_id=decision.case_id,
                    case_version=decision.case_version,
                    actor_id=decision.actor_id,
                    outcome=decision.outcome,
                    reason=decision.reason,
                    data_origin="human",
                    created_by=decision.actor_id,
                )
            )
        updated = await self.case(item.id)
        if updated is None:
            raise RuntimeError("Updated case disappeared")
        return updated
