"""Versioned deadline-change discussion use cases for participants and customers."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from impulse.application.errors import ApiError
from impulse.application.identity import IdentityStore
from impulse.application.notifications import NotificationFeedService
from impulse.application.work import AssignmentRecord, TermsRecord, WorkStore
from impulse.domain.deadline import (
    DeadlineChangeError,
    DeadlineChangeRequest,
    DeadlineChangeStatus,
    deadline_change_superseded,
    effective_status,
    new_deadline_request,
    normalized_comment,
    transition_decision,
    validate_proposal,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.notifications import NotificationKind


class DeadlineChangeStore(Protocol):
    async def create(self, request: DeadlineChangeRequest) -> DeadlineChangeRequest: ...
    async def get(self, request_id: UUID) -> DeadlineChangeRequest | None: ...
    async def list_for_task(self, task_id: UUID) -> tuple[DeadlineChangeRequest, ...]: ...
    async def list_for_author(
        self, task_id: UUID, person_id: UUID
    ) -> tuple[DeadlineChangeRequest, ...]: ...
    async def decide(
        self,
        request: DeadlineChangeRequest,
        *,
        approve: bool,
        comment: str | None,
        decided_at: datetime,
        terms: TermsRecord | None,
    ) -> DeadlineChangeRequest: ...


class MemoryDeadlineChangeStore:
    """In-memory queue of deadline discussion requests bound to a work store."""

    def __init__(self, work: WorkStore) -> None:
        self._work = work
        self._requests: tuple[DeadlineChangeRequest, ...] = ()

    async def create(self, request: DeadlineChangeRequest) -> DeadlineChangeRequest:
        self._requests = (*self._requests, request)
        return request

    async def get(self, request_id: UUID) -> DeadlineChangeRequest | None:
        return next((item for item in self._requests if item.id == request_id), None)

    async def list_for_task(self, task_id: UUID) -> tuple[DeadlineChangeRequest, ...]:
        return tuple(item for item in self._requests if item.task_id == task_id)

    async def list_for_author(
        self, task_id: UUID, person_id: UUID
    ) -> tuple[DeadlineChangeRequest, ...]:
        return tuple(
            item
            for item in self._requests
            if item.task_id == task_id and item.requested_by == person_id
        )

    async def decide(
        self,
        request: DeadlineChangeRequest,
        *,
        approve: bool,
        comment: str | None,
        decided_at: datetime,
        terms: TermsRecord | None,
    ) -> DeadlineChangeRequest:
        if terms is not None:
            await self._work.add_terms(terms)
        updated = replace(
            request,
            status=DeadlineChangeStatus.APPROVED if approve else DeadlineChangeStatus.REJECTED,
            decision_comment=comment,
            decided_at=decided_at,
        )
        self._requests = tuple(
            updated if item.id == request.id else item for item in self._requests
        )
        return updated


class DeadlineChangeService:
    def __init__(
        self,
        store: DeadlineChangeStore,
        work: WorkStore,
        notifications: NotificationFeedService | None = None,
    ) -> None:
        self.store = store
        self.work = work
        self.notifications = notifications
        self.consent_store: IdentityStore | None = None

    def _role(self, actor: ActorContext, role: Role) -> None:
        if actor.active_role is not role:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для роли.", status_code=403
            )

    async def propose(
        self,
        actor: ActorContext,
        assignment_id: UUID,
        *,
        proposed_deadline_at: datetime,
        reason: str,
        impact: str,
        base_terms_version: int,
    ) -> DeadlineChangeRequest:
        self._role(actor, Role.PARTICIPANT)
        assignment = await self.work.assignment(assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        task = await self.work.get(assignment.task_id)
        if task is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.work.latest_terms(task.aggregate.task_id)
        if terms is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Добавьте версию условий перед изменением.",
                status_code=409,
            )
        if terms.version != base_terms_version:
            raise ApiError(
                code="STALE_DEADLINE_CHANGE",
                message="Срок проекта изменился. Обновите предложение "
                "относительно актуальной даты.",
                status_code=409,
            )
        pending = (
            item
            for item in await self.store.list_for_author(task.aggregate.task_id, actor.person_id)
            if item.status is DeadlineChangeStatus.PENDING
        )
        if any(pending):
            raise ApiError(
                code="DEADLINE_CHANGE_PENDING",
                message="У вас уже есть непринятый запрос на изменение срока.",
                status_code=409,
            )
        try:
            validate_proposal(
                assignment_status=assignment.status,
                base_terms_version=base_terms_version,
                current_deadline_at=terms.deadline_at,
                proposed_deadline_at=proposed_deadline_at,
                reason=reason,
                impact=impact,
            )
        except DeadlineChangeError as exc:
            raise ApiError(exc.code, str(exc), 409) from exc
        request = new_deadline_request(
            task_id=task.aggregate.task_id,
            requested_by=actor.person_id,
            addressee_id=task.aggregate.customer_id,
            base_terms_version=terms.version,
            proposed_deadline_at=proposed_deadline_at,
            reason=reason,
            impact=impact,
            created_at=datetime.now(UTC),
        )
        created = await self.store.create(request)
        if self.notifications is not None:
            await self.notifications.publish(
                created.addressee_id,
                NotificationKind.DEADLINE,
                "Обсуждение срока",
                "Участник предложил новый срок проекта. Рассмотрите запрос и примите решение.",
                entity_type="task",
                entity_id=created.task_id,
            )
        return created

    async def decide(
        self,
        actor: ActorContext,
        request_id: UUID,
        *,
        approve: bool,
        comment: str | None,
    ) -> DeadlineChangeRequest:
        self._role(actor, Role.CUSTOMER)
        request = await self.store.get(request_id)
        if request is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        task = await self.work.get(request.task_id)
        if (
            task is None
            or task.aggregate.customer_id != actor.person_id
            or request.addressee_id != actor.person_id
        ):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.work.latest_terms(task.aggregate.task_id)
        if terms is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Добавьте версию условий перед изменением.",
                status_code=409,
            )
        if deadline_change_superseded(request, terms.version):
            raise ApiError(
                code="STALE_DEADLINE_CHANGE",
                message="Срок проекта изменился со времени запроса. "
                "Проверьте актуальную дату в карточке проекта.",
                status_code=409,
            )
        try:
            status = transition_decision(request.status, approve)
        except DeadlineChangeError as exc:
            raise ApiError(exc.code, str(exc), 409) from exc
        trimmed = normalized_comment(comment)
        decided_at = datetime.now(UTC)
        next_terms = (
            TermsRecord(
                task.aggregate.task_id,
                0,
                request.proposed_deadline_at,
                terms.deliverable,
                terms.acceptance_criteria,
                terms.support_mode,
                terms.compensation,
            )
            if approve
            else None
        )
        updated = await self.store.decide(
            request,
            approve=approve,
            comment=trimmed,
            decided_at=decided_at,
            terms=next_terms,
        )
        if updated.status is not status:
            raise ApiError(
                code="DEADLINE_CHANGE_CONCURRENT",
                message="Запрос изменён параллельно.",
                status_code=409,
            )
        if self.notifications is not None:
            verdict = "одобрен" if approve else "отклонён"
            await self.notifications.publish(
                updated.requested_by,
                NotificationKind.DEADLINE,
                "Решение по сроку",
                f"Запрос на изменение срока проекта {verdict}.",
                entity_type="task",
                entity_id=updated.task_id,
            )
        return updated

    async def assignment_requests(
        self,
        actor: ActorContext,
        assignment_id: UUID,
    ) -> tuple[DeadlineChangeRequest, ...]:
        self._role(actor, Role.PARTICIPANT)
        assignment: AssignmentRecord | None = await self.work.assignment(assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.work.latest_terms(assignment.task_id)
        latest_version = terms.version if terms is not None else 0
        requests = await self.store.list_for_author(assignment.task_id, actor.person_id)
        return tuple(
            replace(item, status=effective_status(item, latest_version)) for item in requests
        )

    async def task_requests(
        self,
        actor: ActorContext,
        task_id: UUID,
    ) -> tuple[DeadlineChangeRequest, ...]:
        self._role(actor, Role.CUSTOMER)
        task = await self.work.get(task_id)
        if task is None or task.aggregate.customer_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.work.latest_terms(task.aggregate.task_id)
        latest_version = terms.version if terms is not None else 0
        requests = await self.store.list_for_task(task.aggregate.task_id)
        return tuple(
            replace(item, status=effective_status(item, latest_version)) for item in requests
        )
