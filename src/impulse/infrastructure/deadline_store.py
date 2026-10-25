"""PostgreSQL adapter for participant deadline-change discussion requests."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.application.errors import ApiError
from impulse.application.deadline import DeadlineChangeRequest, DeadlineChangeStore
from impulse.application.work import TermsRecord, WorkStore
from impulse.domain.deadline import DeadlineChangeStatus
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.reward import compensation_terms
from impulse.infrastructure.models.work import deadline_requests, task_terms_versions


def _status_value(value: str) -> DeadlineChangeStatus:
    try:
        return DeadlineChangeStatus(value)
    except ValueError as exc:
        raise ApiError("INTERNAL_STATE_ERROR", "Unknown deadline request status.", 500) from exc


def _request(row: Any) -> DeadlineChangeRequest:
    return DeadlineChangeRequest(
        id=row.id,
        task_id=row.task_id,
        requested_by=row.requested_by,
        addressee_id=row.addressee_id,
        base_terms_version=row.base_terms_version,
        proposed_deadline_at=row.proposed_deadline_at,
        reason=row.reason,
        impact=row.impact,
        status=_status_value(row.status),
        decision_comment=row.decision_comment,
        decided_at=row.decided_at,
        created_at=row.created_at,
    )


class SqlDeadlineChangeStore(DeadlineChangeStore):
    """Deadline-change requests stored next to the versioned task terms."""

    def __init__(self, database: Database, work: WorkStore | None = None) -> None:
        self.database = database
        self._work = work

    async def create(self, request: DeadlineChangeRequest) -> DeadlineChangeRequest:
        async with self.database.session() as session:
            exists = await session.scalar(
                select(task_terms_versions.c.id).where(
                    task_terms_versions.c.task_id == request.task_id
                )
            )
            if exists is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            await session.execute(
                insert(deadline_requests).values(
                    id=request.id,
                    task_id=request.task_id,
                    requested_by=request.requested_by,
                    addressee_id=request.addressee_id,
                    base_terms_version=request.base_terms_version,
                    proposed_deadline_at=request.proposed_deadline_at,
                    reason=request.reason,
                    impact=request.impact,
                    status=request.status.value,
                    created_at=request.created_at,
                    created_by=request.requested_by,
                    data_origin="demo_runtime",
                )
            )
        return request

    async def get(self, request_id: UUID) -> DeadlineChangeRequest | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(deadline_requests).where(deadline_requests.c.id == request_id)
                )
            ).one_or_none()
            return _request(row) if row is not None else None

    async def list_for_task(self, task_id: UUID) -> tuple[DeadlineChangeRequest, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(deadline_requests)
                    .where(deadline_requests.c.task_id == task_id)
                    .order_by(deadline_requests.c.created_at)
                )
            ).all()
            return tuple(_request(row) for row in rows)

    async def list_for_author(
        self, task_id: UUID, person_id: UUID
    ) -> tuple[DeadlineChangeRequest, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(deadline_requests)
                    .where(
                        deadline_requests.c.task_id == task_id,
                        deadline_requests.c.requested_by == person_id,
                    )
                    .order_by(deadline_requests.c.created_at)
                )
            ).all()
            return tuple(_request(row) for row in rows)

    async def decide(
        self,
        request: DeadlineChangeRequest,
        *,
        approve: bool,
        comment: str | None,
        decided_at: datetime,
        terms: TermsRecord | None,
    ) -> DeadlineChangeRequest:
        async with self.database.session() as session:
            current = (
                await session.execute(
                    select(deadline_requests).where(deadline_requests.c.id == request.id)
                )
            ).one_or_none()
            if current is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            if current.status != request.status.value:
                raise ApiError(
                    code="DEADLINE_CHANGE_CONCURRENT",
                    message="Запрос изменён параллельно.",
                    status_code=409,
                )
            if approve and terms is not None:
                await self._append_terms(session, request, terms)
            await session.execute(
                update(deadline_requests)
                .where(deadline_requests.c.id == request.id)
                .values(
                    status=DeadlineChangeStatus.APPROVED.value
                    if approve
                    else DeadlineChangeStatus.REJECTED.value,
                    decision_comment=comment,
                    decided_at=decided_at,
                )
            )
        updated = await self.get(request.id)
        if updated is None:
            raise ApiError(
                "INTERNAL_STATE_ERROR", "Deadline request disappeared after update.", 500
            )
        return updated

    async def _append_terms(
        self,
        session: AsyncSession,
        request: DeadlineChangeRequest,
        terms: TermsRecord,
    ) -> None:
        previous = (
            await session.execute(
                select(task_terms_versions)
                .where(task_terms_versions.c.task_id == request.task_id)
                .order_by(task_terms_versions.c.terms_version.desc())
            )
        ).first()
        if previous is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Добавьте версию условий перед изменением.",
                status_code=409,
            )
        compensation = (
            await session.execute(
                select(compensation_terms).where(
                    compensation_terms.c.task_terms_version_id == previous.id
                )
            )
        ).one_or_none()
        if compensation is None:
            raise ApiError(
                code="TASK_TERMS_COMPENSATION_MISSING",
                message="Не найдена действующая модель вознаграждения.",
                status_code=409,
            )
        terms_id = uuid4()
        await session.execute(
            insert(task_terms_versions).values(
                id=terms_id,
                task_id=request.task_id,
                terms_version=previous.terms_version + 1,
                deadline_at=request.proposed_deadline_at,
                status="published",
                data_origin="demo_runtime",
                payload=dict(previous.payload or {}),
            )
        )
        await session.execute(
            insert(compensation_terms).values(
                task_terms_version_id=terms_id,
                paid=compensation.paid,
                base_amount=compensation.base_amount,
                b_multiplier=compensation.b_multiplier,
                a_multiplier=compensation.a_multiplier,
                quantum=compensation.quantum,
                rounding_mode=compensation.rounding_mode,
                policy_version=compensation.policy_version,
                payout_condition=compensation.payout_condition,
                currency=compensation.currency,
                status="published",
                data_origin="demo_runtime",
            )
        )
