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
    AcceptanceDecision,
    ApplicationStatus,
    AssignmentStatus,
    ContributionStatus,
    SupportAssignment,
    TaskAggregate,
    TaskBrief,
    TaskPolicyError,
    accept_application,
    decide_contribution,
    open_authorship_dispute,
    start_assignment,
    submit_assignment,
    validate_personal_contribution,
)


@dataclass(frozen=True, slots=True)
class TaskRecord:
    project_key: str
    task_key: str
    title: str
    aggregate: TaskAggregate
    places: int = 1


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


@dataclass(frozen=True, slots=True)
class ApplicationRecord:
    id: UUID
    task_id: UUID
    person_id: UUID
    accepted_terms_version: int
    status: ApplicationStatus
    version: int = 1


@dataclass(frozen=True, slots=True)
class AssignmentRecord:
    id: UUID
    task_id: UUID
    person_id: UUID
    application_id: UUID
    status: AssignmentStatus


@dataclass(frozen=True, slots=True)
class CheckpointRecord:
    key: str
    title: str
    status: str = "planned"


@dataclass(frozen=True, slots=True)
class TeamArtifactRecord:
    key: str
    uri: str


@dataclass(frozen=True, slots=True)
class ContributionRecord:
    id: UUID
    assignment_id: UUID
    version: int
    personal_summary: str
    artifact_keys: tuple[str, ...]
    status: ContributionStatus = ContributionStatus.SUBMITTED


@dataclass(frozen=True, slots=True)
class AcceptanceRecord:
    id: UUID
    contribution_id: UUID
    contribution_version: int
    decision: AcceptanceDecision
    reason: str
    deadline_at: datetime | None
    owner_id: UUID | None


@dataclass(frozen=True, slots=True)
class DisputeRecord:
    id: UUID
    contribution_id: UUID
    conflicting_contribution_id: UUID | None
    status: str
    reason: str
    deadline_at: datetime
    owner: str = "operations"
    review_blocked: bool = True
    payout_blocked: bool = True


@dataclass(frozen=True, slots=True)
class WorkItem:
    assignment: AssignmentRecord
    task: TaskRecord
    terms: TermsRecord
    contributions: tuple[ContributionRecord, ...]
    decisions: tuple[AcceptanceRecord, ...]


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
    async def apply(
        self, person_id: UUID, task_id: UUID, terms_version: int
    ) -> ApplicationRecord: ...
    async def applications(self, task_id: UUID) -> tuple[ApplicationRecord, ...]: ...
    async def application(self, application_id: UUID) -> ApplicationRecord | None: ...
    async def accept_application(
        self, application_id: UUID, expected_version: int, places: int
    ) -> AssignmentRecord: ...
    async def assignment(self, assignment_id: UUID) -> AssignmentRecord | None: ...
    async def start_assignment(self, assignment_id: UUID) -> AssignmentRecord: ...
    async def add_checkpoint(
        self, task_id: UUID, checkpoint: CheckpointRecord
    ) -> CheckpointRecord: ...
    async def add_team_artifact(
        self, task_id: UUID, artifact: TeamArtifactRecord
    ) -> TeamArtifactRecord: ...
    async def submit_contribution(
        self, assignment_id: UUID, summary: str, artifacts: tuple[TeamArtifactRecord, ...]
    ) -> ContributionRecord: ...
    async def contribution(self, contribution_id: UUID) -> ContributionRecord | None: ...
    async def decide_contribution(
        self,
        contribution_id: UUID,
        decided_by: UUID,
        decision: AcceptanceDecision,
        reason: str,
        deadline_at: datetime | None,
        owner_id: UUID | None,
    ) -> AcceptanceRecord: ...
    async def open_authorship_dispute(
        self,
        person_id: UUID,
        contribution_id: UUID,
        conflicting_contribution_id: UUID | None,
        reason: str,
        deadline_at: datetime,
    ) -> DisputeRecord: ...
    async def dispute(self, dispute_id: UUID) -> DisputeRecord | None: ...
    async def assignments_for_person(self, person_id: UUID) -> tuple[AssignmentRecord, ...]: ...
    async def assignments_for_task(self, task_id: UUID) -> tuple[AssignmentRecord, ...]: ...
    async def contributions_for_assignment(
        self, assignment_id: UUID
    ) -> tuple[ContributionRecord, ...]: ...
    async def acceptance_for_contribution(
        self, contribution_id: UUID
    ) -> AcceptanceRecord | None: ...


class MemoryWorkStore:
    def __init__(self) -> None:
        self._records: dict[UUID, TaskRecord] = {}
        self._terms: dict[UUID, tuple[TermsRecord, ...]] = {}
        self._acceptances: dict[tuple[UUID, UUID], int] = {}
        self._applications: dict[UUID, ApplicationRecord] = {}
        self._assignments: dict[UUID, AssignmentRecord] = {}
        self._checkpoints: dict[UUID, tuple[CheckpointRecord, ...]] = {}
        self._team_artifacts: dict[UUID, tuple[TeamArtifactRecord, ...]] = {}
        self._contributions: dict[UUID, tuple[ContributionRecord, ...]] = {}
        self._acceptance_decisions: dict[UUID, AcceptanceRecord] = {}
        self._disputes: dict[UUID, DisputeRecord] = {}

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

    async def apply(self, person_id: UUID, task_id: UUID, terms_version: int) -> ApplicationRecord:
        for current in self._applications.values():
            if (current.person_id, current.task_id) == (person_id, task_id):
                if current.status is ApplicationStatus.TERMS_ACCEPTED:
                    updated = ApplicationRecord(
                        current.id,
                        task_id,
                        person_id,
                        terms_version,
                        ApplicationStatus.APPLIED,
                        current.version + 1,
                    )
                    self._applications[current.id] = updated
                    return updated
                return current
        record = ApplicationRecord(
            uuid4(), task_id, person_id, terms_version, ApplicationStatus.APPLIED
        )
        self._applications[record.id] = record
        return record

    async def applications(self, task_id: UUID) -> tuple[ApplicationRecord, ...]:
        return tuple(item for item in self._applications.values() if item.task_id == task_id)

    async def application(self, application_id: UUID) -> ApplicationRecord | None:
        return self._applications.get(application_id)

    async def accept_application(
        self, application_id: UUID, expected_version: int, places: int
    ) -> AssignmentRecord:
        application = self._applications[application_id]
        staffed = sum(item.task_id == application.task_id for item in self._assignments.values())
        try:
            status = accept_application(
                application.status,
                expected_version=expected_version,
                actual_version=application.version,
                staffed_count=staffed,
                places=places,
            )
        except TaskPolicyError as exc:
            raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
        self._applications[application_id] = ApplicationRecord(
            application.id,
            application.task_id,
            application.person_id,
            application.accepted_terms_version,
            status,
            application.version + 1,
        )
        assignment = AssignmentRecord(
            uuid4(),
            application.task_id,
            application.person_id,
            application.id,
            AssignmentStatus.STAFFED,
        )
        self._assignments[assignment.id] = assignment
        return assignment

    async def assignment(self, assignment_id: UUID) -> AssignmentRecord | None:
        return self._assignments.get(assignment_id)

    async def start_assignment(self, assignment_id: UUID) -> AssignmentRecord:
        current = self._assignments[assignment_id]
        try:
            status = start_assignment(current.status)
        except TaskPolicyError as exc:
            raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
        updated = AssignmentRecord(
            current.id,
            current.task_id,
            current.person_id,
            current.application_id,
            status,
        )
        self._assignments[assignment_id] = updated
        return updated

    async def add_checkpoint(self, task_id: UUID, checkpoint: CheckpointRecord) -> CheckpointRecord:
        self._checkpoints[task_id] = (*self._checkpoints.get(task_id, ()), checkpoint)
        return checkpoint

    async def add_team_artifact(
        self, task_id: UUID, artifact: TeamArtifactRecord
    ) -> TeamArtifactRecord:
        self._team_artifacts[task_id] = (*self._team_artifacts.get(task_id, ()), artifact)
        return artifact

    async def submit_contribution(
        self, assignment_id: UUID, summary: str, artifacts: tuple[TeamArtifactRecord, ...]
    ) -> ContributionRecord:
        assignment = self._assignments[assignment_id]
        next_status = submit_assignment(assignment.status)
        current = self._contributions.get(assignment_id, ())
        record = ContributionRecord(
            uuid4(), assignment_id, len(current) + 1, summary, tuple(item.key for item in artifacts)
        )
        self._contributions[assignment_id] = (*current, record)
        self._assignments[assignment_id] = AssignmentRecord(
            assignment.id,
            assignment.task_id,
            assignment.person_id,
            assignment.application_id,
            next_status,
        )
        return record

    async def contribution(self, contribution_id: UUID) -> ContributionRecord | None:
        return next(
            (
                item
                for versions in self._contributions.values()
                for item in versions
                if item.id == contribution_id
            ),
            None,
        )

    async def decide_contribution(
        self,
        contribution_id: UUID,
        decided_by: UUID,
        decision: AcceptanceDecision,
        reason: str,
        deadline_at: datetime | None,
        owner_id: UUID | None,
    ) -> AcceptanceRecord:
        contribution = await self.contribution(contribution_id)
        if contribution is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        contribution_status, assignment_status = decide_contribution(
            contribution.status, decision, reason=reason, deadline_at=deadline_at
        )
        assignment = self._assignments[contribution.assignment_id]
        updated = ContributionRecord(
            contribution.id,
            contribution.assignment_id,
            contribution.version,
            contribution.personal_summary,
            contribution.artifact_keys,
            contribution_status,
        )
        versions = self._contributions[contribution.assignment_id]
        self._contributions[contribution.assignment_id] = tuple(
            updated if item.id == contribution_id else item for item in versions
        )
        self._assignments[assignment.id] = AssignmentRecord(
            assignment.id,
            assignment.task_id,
            assignment.person_id,
            assignment.application_id,
            assignment_status,
        )
        record = AcceptanceRecord(
            uuid4(), contribution.id, contribution.version, decision, reason, deadline_at, owner_id
        )
        self._acceptance_decisions[contribution.id] = record
        return record

    async def open_authorship_dispute(
        self,
        person_id: UUID,
        contribution_id: UUID,
        conflicting_contribution_id: UUID | None,
        reason: str,
        deadline_at: datetime,
    ) -> DisputeRecord:
        targets = tuple(
            item for item in (contribution_id, conflicting_contribution_id) if item is not None
        )
        for target_id in targets:
            contribution = await self.contribution(target_id)
            if contribution is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            disputed = open_authorship_dispute(
                contribution.status, reason=reason, deadline_at=deadline_at
            )
            versions = self._contributions[contribution.assignment_id]
            self._contributions[contribution.assignment_id] = tuple(
                ContributionRecord(
                    item.id,
                    item.assignment_id,
                    item.version,
                    item.personal_summary,
                    item.artifact_keys,
                    disputed,
                )
                if item.id == target_id
                else item
                for item in versions
            )
            assignment = self._assignments[contribution.assignment_id]
            self._assignments[assignment.id] = AssignmentRecord(
                assignment.id,
                assignment.task_id,
                assignment.person_id,
                assignment.application_id,
                AssignmentStatus.DISPUTED,
            )
        record = DisputeRecord(
            uuid4(), contribution_id, conflicting_contribution_id, "open", reason, deadline_at
        )
        self._disputes[record.id] = record
        return record

    async def dispute(self, dispute_id: UUID) -> DisputeRecord | None:
        return self._disputes.get(dispute_id)

    async def assignments_for_person(self, person_id: UUID) -> tuple[AssignmentRecord, ...]:
        return tuple(item for item in self._assignments.values() if item.person_id == person_id)

    async def assignments_for_task(self, task_id: UUID) -> tuple[AssignmentRecord, ...]:
        return tuple(item for item in self._assignments.values() if item.task_id == task_id)

    async def contributions_for_assignment(
        self, assignment_id: UUID
    ) -> tuple[ContributionRecord, ...]:
        return self._contributions.get(assignment_id, ())

    async def acceptance_for_contribution(self, contribution_id: UUID) -> AcceptanceRecord | None:
        return self._acceptance_decisions.get(contribution_id)


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
        places: int = 1,
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
                places,
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
            TaskRecord(record.project_key, record.task_key, record.title, aggregate, record.places)
        )

    async def moderate(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(record.aggregate.approve_moderation)
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate, record.places)
        )

    async def assign_support(
        self, actor: ActorContext, task_id: UUID, support: SupportAssignment
    ) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(lambda: record.aggregate.assign_support(support))
        return await self.store.save(
            TaskRecord(record.project_key, record.task_key, record.title, aggregate, record.places)
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
            TaskRecord(record.project_key, record.task_key, record.title, aggregate, record.places)
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

    async def apply(self, actor: ActorContext, task_id: UUID) -> ApplicationRecord:
        detail = await self.task_detail(actor, task_id)
        if detail.accepted_terms_version != detail.terms.version:
            raise ApiError(
                code="TERMS_NOT_ACCEPTED",
                message="Подтвердите актуальную версию условий перед откликом.",
                status_code=409,
            )
        return await self.store.apply(actor.person_id, task_id, detail.terms.version)

    async def task_applications(
        self, actor: ActorContext, task_id: UUID
    ) -> tuple[ApplicationRecord, ...]:
        self._role(actor, Role.CUSTOMER)
        await self._owned(actor, task_id)
        return await self.store.applications(task_id)

    async def accept_candidate(
        self, actor: ActorContext, application_id: UUID, expected_version: int
    ) -> AssignmentRecord:
        self._role(actor, Role.CUSTOMER)
        application = await self.store.application(application_id)
        if application is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        task = await self._owned(actor, application.task_id)
        return await self.store.accept_application(application_id, expected_version, task.places)

    async def start_work(self, actor: ActorContext, assignment_id: UUID) -> AssignmentRecord:
        self._role(actor, Role.PARTICIPANT)
        assignment = await self.store.assignment(assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return await self.store.start_assignment(assignment_id)

    async def add_checkpoint(
        self, actor: ActorContext, task_id: UUID, checkpoint: CheckpointRecord
    ) -> CheckpointRecord:
        self._role(actor, Role.CUSTOMER)
        await self._owned(actor, task_id)
        return await self.store.add_checkpoint(task_id, checkpoint)

    async def add_team_artifact(
        self, actor: ActorContext, task_id: UUID, artifact: TeamArtifactRecord
    ) -> TeamArtifactRecord:
        self._role(actor, Role.CUSTOMER)
        await self._owned(actor, task_id)
        return await self.store.add_team_artifact(task_id, artifact)

    async def submit_contribution(
        self,
        actor: ActorContext,
        assignment_id: UUID,
        personal_summary: str,
        artifacts: tuple[TeamArtifactRecord, ...],
    ) -> ContributionRecord:
        self._role(actor, Role.PARTICIPANT)
        assignment = await self.store.assignment(assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if assignment.status is not AssignmentStatus.IN_PROGRESS:
            raise ApiError(
                code="ASSIGNMENT_NOT_IN_PROGRESS",
                message="Сначала начните работу над назначением.",
                status_code=409,
            )
        try:
            summary = validate_personal_contribution(personal_summary)
        except TaskPolicyError as exc:
            raise ApiError(
                code=exc.code,
                message=str(exc),
                status_code=409,
                field_errors={"personal_summary": ["Требуется личное описание вклада."]},
            ) from exc
        return await self.store.submit_contribution(assignment_id, summary, artifacts)

    async def decide_submitted_contribution(
        self,
        actor: ActorContext,
        contribution_id: UUID,
        *,
        decision: AcceptanceDecision,
        reason: str,
        deadline_at: datetime | None,
    ) -> AcceptanceRecord:
        self._role(actor, Role.CUSTOMER)
        contribution = await self.store.contribution(contribution_id)
        if contribution is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        assignment = await self.store.assignment(contribution.assignment_id)
        if assignment is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        await self._owned(actor, assignment.task_id)
        self._policy(
            lambda: decide_contribution(
                contribution.status,
                decision,
                reason=reason,
                deadline_at=deadline_at,
            )
        )
        owner_id = (
            assignment.person_id if decision is AcceptanceDecision.REVISION_REQUESTED else None
        )
        return await self.store.decide_contribution(
            contribution_id,
            actor.person_id,
            decision,
            " ".join(reason.split()),
            deadline_at,
            owner_id,
        )

    async def dispute_authorship(
        self,
        actor: ActorContext,
        contribution_id: UUID,
        *,
        conflicting_contribution_id: UUID | None,
        reason: str,
        deadline_at: datetime,
    ) -> DisputeRecord:
        self._role(actor, Role.PARTICIPANT)
        contribution = await self.store.contribution(contribution_id)
        if contribution is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        assignment = await self.store.assignment(contribution.assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        self._policy(
            lambda: open_authorship_dispute(
                contribution.status, reason=reason, deadline_at=deadline_at
            )
        )
        if conflicting_contribution_id is not None:
            if conflicting_contribution_id == contribution_id:
                raise ApiError(
                    code="INVALID_AUTHORSHIP_CONFLICT",
                    message="Конфликтующий вклад должен отличаться от вашего.",
                    status_code=409,
                )
            conflicting = await self.store.contribution(conflicting_contribution_id)
            conflicting_assignment = (
                await self.store.assignment(conflicting.assignment_id)
                if conflicting is not None
                else None
            )
            if (
                conflicting is None
                or conflicting_assignment is None
                or conflicting_assignment.task_id != assignment.task_id
            ):
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            self._policy(
                lambda: open_authorship_dispute(
                    conflicting.status, reason=reason, deadline_at=deadline_at
                )
            )
        return await self.store.open_authorship_dispute(
            actor.person_id,
            contribution_id,
            conflicting_contribution_id,
            " ".join(reason.split()),
            deadline_at,
        )

    async def participant_dispute(self, actor: ActorContext, dispute_id: UUID) -> DisputeRecord:
        self._role(actor, Role.PARTICIPANT)
        dispute = await self.store.dispute(dispute_id)
        if dispute is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        contribution = await self.store.contribution(dispute.contribution_id)
        assignment = (
            await self.store.assignment(contribution.assignment_id)
            if contribution is not None
            else None
        )
        if assignment is None or assignment.person_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return dispute

    async def participant_work(self, actor: ActorContext) -> tuple[WorkItem, ...]:
        self._role(actor, Role.PARTICIPANT)
        return await self._work_items(await self.store.assignments_for_person(actor.person_id))

    async def participant_preview(self, actor: ActorContext, task_id: UUID) -> tuple[WorkItem, ...]:
        self._role(actor, Role.CUSTOMER)
        await self._owned(actor, task_id)
        return await self._work_items(await self.store.assignments_for_task(task_id))

    async def _work_items(self, assignments: tuple[AssignmentRecord, ...]) -> tuple[WorkItem, ...]:
        result: list[WorkItem] = []
        for assignment in assignments:
            task = await self._required(assignment.task_id)
            terms = await self.store.latest_terms(assignment.task_id)
            if terms is None:
                continue
            contributions = await self.store.contributions_for_assignment(assignment.id)
            decisions: list[AcceptanceRecord] = []
            for contribution in contributions:
                decision = await self.store.acceptance_for_contribution(contribution.id)
                if decision is not None:
                    decisions.append(decision)
            result.append(
                WorkItem(
                    assignment,
                    task,
                    terms,
                    contributions,
                    tuple(decisions),
                )
            )
        return tuple(result)

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
