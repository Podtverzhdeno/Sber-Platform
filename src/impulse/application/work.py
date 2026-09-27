"""Customer task drafting, moderation, support and publication use cases."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role
from impulse.domain.work import (
    SupportAssignment,
    TaskAggregate,
    TaskBrief,
    TaskPolicyError,
)


@dataclass(frozen=True, slots=True)
class TaskRecord:
    project_key: str
    task_key: str
    title: str
    aggregate: TaskAggregate


@dataclass(frozen=True, slots=True)
class TermsRecord:
    task_id: UUID
    version: int
    deadline_at: datetime
    deliverable: str
    acceptance_criteria: tuple[str, ...]
    support_mode: str | None


@dataclass(frozen=True, slots=True)
class MarketplaceTask:
    task: TaskRecord
    terms: TermsRecord
    accepted_terms_version: int | None = None


class WorkStore(Protocol):
    async def create(self, record: TaskRecord) -> TaskRecord: ...
    async def get(self, task_id: UUID) -> TaskRecord | None: ...
    async def save(self, record: TaskRecord) -> TaskRecord: ...
    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]: ...
    async def add_terms(self, terms: TermsRecord) -> TermsRecord: ...
    async def latest_terms(self, task_id: UUID) -> TermsRecord | None: ...
    async def published_tasks(self) -> tuple[TaskRecord, ...]: ...
    async def accepted_terms_version(self, person_id: UUID, task_id: UUID) -> int | None: ...
    async def accept_terms(self, person_id: UUID, task_id: UUID, version: int) -> None: ...


class MemoryWorkStore:
    def __init__(self) -> None:
        self._records: dict[UUID, TaskRecord] = {}
        self._terms: dict[UUID, tuple[TermsRecord, ...]] = {}
        self._acceptances: dict[tuple[UUID, UUID], int] = {}

    async def create(self, record: TaskRecord) -> TaskRecord:
        if any(
            item.project_key == record.project_key and item.task_key == record.task_key
            for item in self._records.values()
        ):
            raise ApiError(
                code="TASK_KEY_EXISTS", message="Ключ задачи уже используется.", status_code=409
            )
        self._records[record.aggregate.task_id] = record
        return record

    async def get(self, task_id: UUID) -> TaskRecord | None:
        return self._records.get(task_id)

    async def save(self, record: TaskRecord) -> TaskRecord:
        if record.aggregate.task_id not in self._records:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        self._records[record.aggregate.task_id] = record
        return record

    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]:
        return tuple(
            item for item in self._records.values() if item.aggregate.customer_id == customer_id
        )

    async def add_terms(self, terms: TermsRecord) -> TermsRecord:
        current = self._terms.get(terms.task_id, ())
        next_terms = TermsRecord(
            terms.task_id,
            len(current) + 1,
            terms.deadline_at,
            terms.deliverable,
            terms.acceptance_criteria,
            terms.support_mode,
        )
        self._terms[terms.task_id] = (*current, next_terms)
        return next_terms

    async def latest_terms(self, task_id: UUID) -> TermsRecord | None:
        versions = self._terms.get(task_id, ())
        return versions[-1] if versions else None

    async def published_tasks(self) -> tuple[TaskRecord, ...]:
        return tuple(
            item for item in self._records.values() if item.aggregate.status.value == "published"
        )

    async def accepted_terms_version(self, person_id: UUID, task_id: UUID) -> int | None:
        return self._acceptances.get((person_id, task_id))

    async def accept_terms(self, person_id: UUID, task_id: UUID, version: int) -> None:
        self._acceptances[(person_id, task_id)] = version


class WorkService:
    def __init__(self, store: WorkStore) -> None:
        self.store = store

    @staticmethod
    def _role(actor: ActorContext, role: Role) -> None:
        if actor.active_role is not role:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для роли.", status_code=403
            )

    @staticmethod
    def _policy[T](operation: Callable[[], T]) -> T:
        try:
            return operation()
        except TaskPolicyError as exc:
            field_errors = (
                {field: ["Обязательное условие не выполнено."] for field in exc.missing_fields}
                if exc.missing_fields
                else None
            )
            raise ApiError(
                code=exc.code,
                message=str(exc),
                status_code=409,
                field_errors=field_errors,
            ) from exc

    async def create_draft(
        self,
        actor: ActorContext,
        *,
        project_key: str,
        task_key: str,
        title: str,
        brief: TaskBrief,
        nominated_mentor_id: UUID | None,
    ) -> TaskRecord:
        self._role(actor, Role.CUSTOMER)
        record = await self.store.create(
            TaskRecord(
                project_key,
                task_key,
                title,
                TaskAggregate(
                    uuid4(),
                    actor.person_id,
                    brief,
                    nominated_mentor_id=nominated_mentor_id,
                ),
            )
        )
        if brief.deadline_at is not None:
            await self.store.add_terms(
                TermsRecord(
                    record.aggregate.task_id,
                    0,
                    brief.deadline_at,
                    brief.deliverable,
                    brief.acceptance_criteria,
                    None,
                )
            )
        return record

    async def customer_tasks(self, actor: ActorContext) -> tuple[TaskRecord, ...]:
        self._role(actor, Role.CUSTOMER)
        return await self.store.customer_tasks(actor.person_id)

    async def submit(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.CUSTOMER)
        record = await self._owned(actor, task_id)
        aggregate = self._policy(record.aggregate.submit)
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate)
        )

    async def moderate(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(record.aggregate.approve_moderation)
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate)
        )

    async def assign_support(
        self, actor: ActorContext, task_id: UUID, support: SupportAssignment
    ) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(lambda: record.aggregate.assign_support(support))
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate)
        )

    async def publish(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(record.aggregate.publish)
        latest = await self.store.latest_terms(task_id)
        if latest is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Добавьте версию условий перед публикацией.",
                status_code=409,
            )
        support_mode = aggregate.support.mode.value if aggregate.support else None
        if latest.support_mode != support_mode:
            latest = await self.store.add_terms(
                TermsRecord(
                    task_id,
                    0,
                    latest.deadline_at,
                    latest.deliverable,
                    latest.acceptance_criteria,
                    support_mode,
                )
            )
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate)
        )

    async def revise_terms(
        self,
        actor: ActorContext,
        task_id: UUID,
        *,
        deadline_at: datetime,
        deliverable: str,
        acceptance_criteria: tuple[str, ...],
    ) -> TermsRecord:
        self._role(actor, Role.CUSTOMER)
        record = await self._owned(actor, task_id)
        support_mode = (
            record.aggregate.support.mode.value if record.aggregate.support is not None else None
        )
        return await self.store.add_terms(
            TermsRecord(
                task_id,
                0,
                deadline_at,
                deliverable,
                acceptance_criteria,
                support_mode,
            )
        )

    async def marketplace(self, actor: ActorContext) -> tuple[MarketplaceTask, ...]:
        self._role(actor, Role.PARTICIPANT)
        result: list[MarketplaceTask] = []
        for task in await self.store.published_tasks():
            terms = await self.store.latest_terms(task.aggregate.task_id)
            if terms is None:
                continue
            result.append(
                MarketplaceTask(
                    task,
                    terms,
                    await self.store.accepted_terms_version(
                        actor.person_id, task.aggregate.task_id
                    ),
                )
            )
        return tuple(result)

    async def task_detail(self, actor: ActorContext, task_id: UUID) -> MarketplaceTask:
        self._role(actor, Role.PARTICIPANT)
        task = await self._required(task_id)
        if task.aggregate.status.value != "published":
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.store.latest_terms(task_id)
        if terms is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return MarketplaceTask(
            task,
            terms,
            await self.store.accepted_terms_version(actor.person_id, task_id),
        )

    async def accept_terms(
        self, actor: ActorContext, task_id: UUID, terms_version: int
    ) -> MarketplaceTask:
        detail = await self.task_detail(actor, task_id)
        if detail.terms.version != terms_version:
            raise ApiError(
                code="TERMS_CHANGED",
                message="Условия изменились. Откройте актуальную версию и подтвердите её.",
                status_code=409,
            )
        await self.store.accept_terms(actor.person_id, task_id, terms_version)
        return MarketplaceTask(detail.task, detail.terms, terms_version)

    async def _required(self, task_id: UUID) -> TaskRecord:
        record = await self.store.get(task_id)
        if record is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return record

    async def _owned(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        record = await self._required(task_id)
        if record.aggregate.customer_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return record
