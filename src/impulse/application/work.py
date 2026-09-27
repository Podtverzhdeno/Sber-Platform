"""Customer task drafting, moderation, support and publication use cases."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
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


class WorkStore(Protocol):
    async def create(self, record: TaskRecord) -> TaskRecord: ...
    async def get(self, task_id: UUID) -> TaskRecord | None: ...
    async def save(self, record: TaskRecord) -> TaskRecord: ...
    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]: ...


class MemoryWorkStore:
    def __init__(self) -> None:
        self._records: dict[UUID, TaskRecord] = {}

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
        return await self.store.create(
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
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate)
        )

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
