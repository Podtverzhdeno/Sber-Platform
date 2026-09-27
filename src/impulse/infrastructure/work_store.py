"""PostgreSQL adapter for customer task drafting and publication."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from impulse.api.errors import ApiError
from impulse.application.work import TaskRecord, TermsRecord, WorkStore
from impulse.domain.work import (
    SupportAssignment,
    SupportMode,
    TaskAggregate,
    TaskBrief,
    TaskStatus,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.work import (
    applications,
    projects,
    task_terms_versions,
    tasks,
)


def _payload(record: TaskRecord) -> dict[str, object]:
    aggregate = record.aggregate
    return {
        "title": record.title,
        "brief": {
            "problem": aggregate.brief.problem,
            "deliverable": aggregate.brief.deliverable,
            "acceptance_criteria": list(aggregate.brief.acceptance_criteria),
            "deadline_at": (
                aggregate.brief.deadline_at.isoformat()
                if aggregate.brief.deadline_at is not None
                else None
            ),
            "data_constraints": aggregate.brief.data_constraints,
            "ip_terms": aggregate.brief.ip_terms,
        },
        "nominated_mentor_id": (
            str(aggregate.nominated_mentor_id)
            if aggregate.nominated_mentor_id is not None
            else None
        ),
        "support": (
            {
                "mode": aggregate.support.mode.value,
                "assignee_id": (
                    str(aggregate.support.assignee_id)
                    if aggregate.support.assignee_id is not None
                    else None
                ),
            }
            if aggregate.support is not None
            else None
        ),
    }


def _record(row: Any) -> TaskRecord:
    payload = dict(row.payload)
    brief_data = dict(payload.get("brief", {}))
    deadline_raw = brief_data.get("deadline_at")
    support_data = payload.get("support")
    support = None
    if isinstance(support_data, dict):
        support_payload = cast(dict[str, object], support_data)
        assignee_raw = support_payload.get("assignee_id")
        support = SupportAssignment(
            SupportMode(str(support_payload["mode"])),
            UUID(str(assignee_raw)) if assignee_raw else None,
        )
    nominated_raw = payload.get("nominated_mentor_id")
    return TaskRecord(
        project_key=row.project_key,
        task_key=row.task_key,
        title=str(payload.get("title", row.task_key)),
        aggregate=TaskAggregate(
            task_id=row.id,
            customer_id=row.customer_id,
            brief=TaskBrief(
                problem=str(brief_data.get("problem", "")),
                deliverable=str(brief_data.get("deliverable", "")),
                acceptance_criteria=tuple(
                    str(item) for item in brief_data.get("acceptance_criteria", [])
                ),
                deadline_at=(datetime.fromisoformat(str(deadline_raw)) if deadline_raw else None),
                data_constraints=str(brief_data.get("data_constraints", "")),
                ip_terms=str(brief_data.get("ip_terms", "")),
            ),
            status=TaskStatus(row.status),
            nominated_mentor_id=UUID(str(nominated_raw)) if nominated_raw else None,
            support=support,
        ),
    )


class SqlWorkStore(WorkStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _select():
        return select(
            tasks.c.id,
            tasks.c.customer_id,
            tasks.c.task_key,
            tasks.c.status,
            tasks.c.payload,
            projects.c.project_key,
        ).join(projects, projects.c.id == tasks.c.project_id)

    async def create(self, record: TaskRecord) -> TaskRecord:
        async with self.database.session() as session:
            project_id = await session.scalar(
                select(projects.c.id).where(projects.c.project_key == record.project_key)
            )
            if project_id is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            existing = await session.scalar(
                select(tasks.c.id).where(
                    tasks.c.project_id == project_id,
                    tasks.c.task_key == record.task_key,
                )
            )
            if existing is not None:
                raise ApiError(
                    code="TASK_KEY_EXISTS", message="Ключ задачи уже используется.", status_code=409
                )
            await session.execute(
                insert(tasks).values(
                    id=record.aggregate.task_id,
                    project_id=project_id,
                    customer_id=record.aggregate.customer_id,
                    task_key=record.task_key,
                    status=record.aggregate.status.value,
                    payload=_payload(record),
                    data_origin="demo_runtime",
                    created_by=record.aggregate.customer_id,
                )
            )
        return record

    async def get(self, task_id: UUID) -> TaskRecord | None:
        async with self.database.sessions() as session:
            row = (await session.execute(self._select().where(tasks.c.id == task_id))).one_or_none()
            return _record(row) if row is not None else None

    async def save(self, record: TaskRecord) -> TaskRecord:
        async with self.database.session() as session:
            result = await session.execute(
                update(tasks)
                .where(tasks.c.id == record.aggregate.task_id)
                .values(
                    status=record.aggregate.status.value,
                    payload=_payload(record),
                    version=tasks.c.version + 1,
                )
                .returning(tasks.c.id)
            )
            if result.scalar_one_or_none() is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
        return record

    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    self._select()
                    .where(tasks.c.customer_id == customer_id)
                    .order_by(tasks.c.created_at.desc())
                )
            ).all()
            return tuple(_record(row) for row in rows)

    async def add_terms(self, terms: TermsRecord) -> TermsRecord:
        async with self.database.session() as session:
            exists = await session.scalar(select(tasks.c.id).where(tasks.c.id == terms.task_id))
            if exists is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            next_version = (
                int(
                    await session.scalar(
                        select(func.max(task_terms_versions.c.terms_version)).where(
                            task_terms_versions.c.task_id == terms.task_id
                        )
                    )
                    or 0
                )
                + 1
            )
            await session.execute(
                insert(task_terms_versions).values(
                    task_id=terms.task_id,
                    terms_version=next_version,
                    deadline_at=terms.deadline_at,
                    status="published",
                    data_origin="demo_runtime",
                    payload={
                        "deliverable": terms.deliverable,
                        "acceptance_criteria": list(terms.acceptance_criteria),
                        "support_mode": terms.support_mode,
                    },
                )
            )
        return TermsRecord(
            terms.task_id,
            next_version,
            terms.deadline_at,
            terms.deliverable,
            terms.acceptance_criteria,
            terms.support_mode,
        )

    async def latest_terms(self, task_id: UUID) -> TermsRecord | None:
        async with self.database.sessions() as session:
            row = (
                (
                    await session.execute(
                        select(task_terms_versions)
                        .where(task_terms_versions.c.task_id == task_id)
                        .order_by(task_terms_versions.c.terms_version.desc())
                        .limit(1)
                    )
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                return None
            payload = dict(row["payload"])
            return TermsRecord(
                task_id,
                row["terms_version"],
                row["deadline_at"],
                str(payload.get("deliverable", "")),
                tuple(str(item) for item in payload.get("acceptance_criteria", [])),
                str(payload["support_mode"]) if payload.get("support_mode") else None,
            )

    async def published_tasks(self) -> tuple[TaskRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    self._select()
                    .where(tasks.c.status == TaskStatus.PUBLISHED.value)
                    .order_by(tasks.c.created_at.desc())
                )
            ).all()
            return tuple(_record(row) for row in rows)

    async def accepted_terms_version(self, person_id: UUID, task_id: UUID) -> int | None:
        async with self.database.sessions() as session:
            return await session.scalar(
                select(applications.c.accepted_terms_version).where(
                    applications.c.person_id == person_id,
                    applications.c.task_id == task_id,
                )
            )

    async def accept_terms(self, person_id: UUID, task_id: UUID, version: int) -> None:
        async with self.database.session() as session:
            await session.execute(
                insert(applications)
                .values(
                    task_id=task_id,
                    person_id=person_id,
                    accepted_terms_version=version,
                    status="terms_accepted",
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_update(
                    constraint="uq_applications_task_id_person_id",
                    set_={
                        "accepted_terms_version": version,
                        "status": "terms_accepted",
                        "version": applications.c.version + 1,
                    },
                )
            )
