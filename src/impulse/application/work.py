"""Customer task drafting, moderation, support and publication use cases."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.identity import IdentityStore
from impulse.domain.identity import ActorContext, ConsentScope, Role
from impulse.domain.reward import CompensationTerms
from impulse.domain.work import (
    AcceptanceDecision,
    ApplicationStatus,
    AssignmentStatus,
    CaseRubric,
    ContributionStatus,
    SupportAssignment,
    TaskAggregate,
    TaskBrief,
    TaskMode,
    TaskPolicyError,
    TaskStatus,
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
    mode: TaskMode = TaskMode.OPEN
    competency_tags: tuple[str, ...] = ()
    case_rubric: CaseRubric | None = None


@dataclass(frozen=True, slots=True)
class TermsRecord:
    task_id: UUID
    version: int
    deadline_at: datetime
    deliverable: str
    acceptance_criteria: tuple[str, ...]
    support_mode: str | None
    compensation: CompensationTerms


@dataclass(frozen=True, slots=True)
class MarketplaceTask:
    task: TaskRecord
    terms: TermsRecord
    accepted_terms_version: int | None = None
    invitation_status: str | None = None


@dataclass(frozen=True, slots=True)
class ApplicationRecord:
    id: UUID
    task_id: UUID
    person_id: UUID
    accepted_terms_version: int
    status: ApplicationStatus
    version: int = 1


@dataclass(frozen=True, slots=True)
class InvitationRecord:
    id: UUID
    task_id: UUID
    person_id: UUID
    terms_version: int
    status: str = "pending"
    expires_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class TeamRequestRecord:
    id: UUID
    owner_id: UUID
    version: int
    title: str
    required_tags: tuple[str, ...]
    preferred_tags: tuple[str, ...]
    relevant_case_task_ids: tuple[UUID, ...]


@dataclass(frozen=True, slots=True)
class CaseEvidence:
    task_id: UUID
    contribution_id: UUID
    personal_summary: str
    competency_tags: tuple[str, ...]
    artifact_keys: tuple[str, ...]
    submitted_at: datetime
    reviewer_id: UUID


@dataclass(frozen=True, slots=True)
class CandidateMatch:
    person_id: UUID
    display_name: str
    request_version: int
    matched_required: tuple[str, ...]
    matched_preferred: tuple[str, ...]
    evidence: tuple[CaseEvidence, ...]


@dataclass(frozen=True, slots=True)
class CandidateReservation:
    id: UUID
    owner_id: UUID
    request_id: UUID
    person_id: UUID
    evidence_contribution_id: UUID
    created_at: datetime


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
    submitted_at: datetime = field(default_factory=lambda: datetime.now(UTC))


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


@dataclass(frozen=True, slots=True)
class CustomerTaskDetail:
    task: TaskRecord
    terms: TermsRecord | None
    applications: tuple[ApplicationRecord, ...]
    assignments: tuple[AssignmentRecord, ...]
    contributions: tuple[ContributionRecord, ...]
    decisions: tuple[AcceptanceRecord, ...]


@dataclass(frozen=True, slots=True)
class ManagerResult:
    contribution_id: UUID
    task_id: UUID
    task_title: str
    personal_summary: str
    artifact_keys: tuple[str, ...]
    reused: bool


@dataclass(frozen=True, slots=True)
class ManagerInitiative:
    project_key: str
    task_id: UUID
    task_title: str
    status: str
    deadline_at: datetime | None
    accepted_results: tuple[ManagerResult, ...]


@dataclass(frozen=True, slots=True)
class ManagerOverview:
    initiatives: tuple[ManagerInitiative, ...]
    task_count: int
    accepted_result_count: int
    reused_result_count: int


class WorkStore(Protocol):
    async def create(self, record: TaskRecord) -> TaskRecord: ...
    async def get(self, task_id: UUID) -> TaskRecord | None: ...
    async def save(self, record: TaskRecord) -> TaskRecord: ...
    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]: ...
    async def add_terms(self, terms: TermsRecord) -> TermsRecord: ...
    async def latest_terms(self, task_id: UUID) -> TermsRecord | None: ...
    async def terms_version(self, task_id: UUID, version: int) -> TermsRecord | None: ...
    async def published_tasks(self) -> tuple[TaskRecord, ...]: ...
    async def accepted_terms_version(self, person_id: UUID, task_id: UUID) -> int | None: ...
    async def invitation(self, task_id: UUID, person_id: UUID) -> InvitationRecord | None: ...
    async def save_team_request(self, record: TeamRequestRecord) -> TeamRequestRecord: ...
    async def team_request(self, request_id: UUID) -> TeamRequestRecord | None: ...
    async def save_reservation(self, record: CandidateReservation) -> CandidateReservation: ...
    async def reservations(self, owner_id: UUID) -> tuple[CandidateReservation, ...]: ...
    async def invite(
        self, task_id: UUID, person_id: UUID, terms_version: int, expires_at: datetime
    ) -> InvitationRecord: ...
    async def decide_invitation(
        self, task_id: UUID, person_id: UUID, status: str
    ) -> InvitationRecord: ...
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
        self._invitations: dict[tuple[UUID, UUID], InvitationRecord] = {}
        self._team_requests: dict[UUID, tuple[TeamRequestRecord, ...]] = {}
        self._reservations: dict[tuple[UUID, UUID, UUID], CandidateReservation] = {}
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

    async def invitation(self, task_id: UUID, person_id: UUID) -> InvitationRecord | None:
        return self._invitations.get((task_id, person_id))

    async def save_team_request(self, record: TeamRequestRecord) -> TeamRequestRecord:
        existing = self._team_requests.get(record.id, ())
        if record.version != len(existing) + 1:
            raise ApiError(
                code="STALE_TEAM_REQUEST", message="Запрос команды изменился.", status_code=409
            )
        self._team_requests[record.id] = (*existing, record)
        return record

    async def team_request(self, request_id: UUID) -> TeamRequestRecord | None:
        versions = self._team_requests.get(request_id, ())
        return versions[-1] if versions else None

    async def save_reservation(self, record: CandidateReservation) -> CandidateReservation:
        key = (record.owner_id, record.request_id, record.person_id)
        existing = self._reservations.get(key)
        if existing is not None:
            return existing
        self._reservations[key] = record
        return record

    async def reservations(self, owner_id: UUID) -> tuple[CandidateReservation, ...]:
        return tuple(item for item in self._reservations.values() if item.owner_id == owner_id)

    async def invite(
        self, task_id: UUID, person_id: UUID, terms_version: int, expires_at: datetime
    ) -> InvitationRecord:
        key = (task_id, person_id)
        current = self._invitations.get(key)
        if (
            current is not None
            and current.status == "pending"
            and current.terms_version == terms_version
            and current.expires_at == expires_at
            and expires_at > datetime.now(UTC)
        ):
            return current
        record = InvitationRecord(
            current.id if current else uuid4(),
            task_id,
            person_id,
            terms_version,
            "pending",
            expires_at,
        )
        self._invitations[key] = record
        return record

    async def decide_invitation(
        self, task_id: UUID, person_id: UUID, status: str
    ) -> InvitationRecord:
        current = self._invitations[(task_id, person_id)]
        record = InvitationRecord(
            current.id, task_id, person_id, current.terms_version, status, current.expires_at
        )
        self._invitations[(task_id, person_id)] = record
        return record

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
            terms.compensation,
        )
        self._terms[terms.task_id] = (*current, next_terms)
        return next_terms

    async def latest_terms(self, task_id: UUID) -> TermsRecord | None:
        versions = self._terms.get(task_id, ())
        return versions[-1] if versions else None

    async def terms_version(self, task_id: UUID, version: int) -> TermsRecord | None:
        return next(
            (item for item in self._terms.get(task_id, ()) if item.version == version),
            None,
        )

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
            contribution.submitted_at,
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
                    item.submitted_at,
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
        self.consent_store: IdentityStore | None = None

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
        compensation: CompensationTerms,
        places: int = 1,
        mode: TaskMode = TaskMode.OPEN,
        competency_tags: tuple[str, ...] = (),
        case_rubric: CaseRubric | None = None,
    ) -> TaskRecord:
        self._role(actor, Role.CUSTOMER)
        normalized_tags = tuple(
            dict.fromkeys(tag.strip().casefold() for tag in competency_tags if tag.strip())
        )
        if normalized_tags and (case_rubric is None or case_rubric.missing()):
            raise ApiError(
                code="CASE_RUBRIC_REQUIRED",
                message="Для кейса нужна полная рубрика оценки.",
                status_code=409,
            )
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
                mode,
                normalized_tags,
                case_rubric,
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
                    compensation,
                )
            )
        return record

    async def customer_tasks(self, actor: ActorContext) -> tuple[TaskRecord, ...]:
        self._role(actor, Role.CUSTOMER)
        return await self.store.customer_tasks(actor.person_id)

    async def case_catalog(self, actor: ActorContext) -> tuple[TaskRecord, ...]:
        self._role(actor, Role.CUSTOMER)
        return tuple(
            task
            for task in await self.store.published_tasks()
            if task.mode is TaskMode.OPEN and task.competency_tags
        )

    async def save_team_request(
        self,
        actor: ActorContext,
        *,
        title: str,
        required_tags: tuple[str, ...],
        preferred_tags: tuple[str, ...],
        relevant_case_task_ids: tuple[UUID, ...],
        request_id: UUID | None = None,
    ) -> TeamRequestRecord:
        self._role(actor, Role.CUSTOMER)
        normalized_required = tuple(
            dict.fromkeys(tag.strip().casefold() for tag in required_tags if tag.strip())
        )
        normalized_preferred = tuple(
            dict.fromkeys(tag.strip().casefold() for tag in preferred_tags if tag.strip())
        )
        case_ids = tuple(dict.fromkeys(relevant_case_task_ids))
        if not title.strip() or not normalized_required or not case_ids:
            raise ApiError(
                code="INCOMPLETE_TEAM_REQUEST",
                message="Укажите потребность, обязательные навыки и релевантные кейсы.",
                status_code=409,
            )
        existing = await self.store.team_request(request_id) if request_id else None
        if request_id and (existing is None or existing.owner_id != actor.person_id):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        for case_id in case_ids:
            task = await self.store.get(case_id)
            if (
                task is None
                or task.aggregate.status is not TaskStatus.PUBLISHED
                or task.mode is not TaskMode.OPEN
                or not task.competency_tags
            ):
                raise ApiError(
                    code="CASE_NOT_AVAILABLE", message="Кейс недоступен.", status_code=409
                )
        return await self.store.save_team_request(
            TeamRequestRecord(
                existing.id if existing else uuid4(),
                actor.person_id,
                existing.version + 1 if existing else 1,
                title.strip(),
                normalized_required,
                normalized_preferred,
                case_ids,
            )
        )

    async def team_request(self, actor: ActorContext, request_id: UUID) -> TeamRequestRecord:
        self._role(actor, Role.CUSTOMER)
        record = await self.store.team_request(request_id)
        if record is None or record.owner_id != actor.person_id:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return record

    async def match_candidates(
        self, actor: ActorContext, request_id: UUID, *, limit: int | None = 10
    ) -> tuple[CandidateMatch, ...]:
        request = await self.team_request(actor, request_id)
        if self.consent_store is None:
            raise ApiError(
                code="CONSENT_UNAVAILABLE", message="Согласие недоступно.", status_code=503
            )
        candidates: list[CandidateMatch] = []
        for person in await self.consent_store.list_personas():
            if Role.PARTICIPANT not in person.roles or person.program_key != actor.program_key:
                continue
            scopes = await self.consent_store.granted_consents(person.person_id)
            if not {ConsentScope.TALENT_PROFILE, ConsentScope.TALENT_EVIDENCE}.issubset(scopes):
                continue
            evidence = [
                item
                for item in await self._case_evidence(person.person_id)
                if item.task_id in request.relevant_case_task_ids
            ]
            verified_tags = {tag for item in evidence for tag in item.competency_tags}
            if not set(request.required_tags).issubset(verified_tags):
                continue
            matched_preferred = tuple(tag for tag in request.preferred_tags if tag in verified_tags)
            candidates.append(
                CandidateMatch(
                    person.person_id,
                    person.display_name,
                    request.version,
                    request.required_tags,
                    matched_preferred,
                    tuple(
                        sorted(
                            evidence,
                            key=lambda item: (str(item.task_id), str(item.contribution_id)),
                        )
                    ),
                )
            )
        candidates.sort(key=lambda item: (-len(item.matched_preferred), str(item.person_id)))
        return tuple(candidates if limit is None else candidates[: min(limit, 10)])

    async def participant_case_evidence(self, actor: ActorContext) -> tuple[CaseEvidence, ...]:
        self._role(actor, Role.PARTICIPANT)
        return await self._case_evidence(actor.person_id)

    async def save_candidate(
        self, actor: ActorContext, request_id: UUID, person_id: UUID
    ) -> CandidateReservation:
        matches = await self.match_candidates(actor, request_id, limit=None)
        match = next((item for item in matches if item.person_id == person_id), None)
        if match is None or not match.evidence:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        return await self.store.save_reservation(
            CandidateReservation(
                uuid4(),
                actor.person_id,
                request_id,
                person_id,
                match.evidence[0].contribution_id,
                datetime.now(UTC),
            )
        )

    async def saved_candidates(
        self, actor: ActorContext
    ) -> tuple[tuple[CandidateReservation, CandidateMatch], ...]:
        self._role(actor, Role.CUSTOMER)
        visible: list[tuple[CandidateReservation, CandidateMatch]] = []
        matches_by_request: dict[UUID, tuple[CandidateMatch, ...]] = {}
        for reservation in await self.store.reservations(actor.person_id):
            if reservation.request_id not in matches_by_request:
                matches_by_request[reservation.request_id] = await self.match_candidates(
                    actor, reservation.request_id, limit=None
                )
            match = next(
                (
                    item
                    for item in matches_by_request[reservation.request_id]
                    if item.person_id == reservation.person_id
                ),
                None,
            )
            if match is not None:
                visible.append((reservation, match))
        return tuple(visible)

    async def _case_evidence(self, person_id: UUID) -> tuple[CaseEvidence, ...]:
        evidence: list[CaseEvidence] = []
        for assignment in await self.store.assignments_for_person(person_id):
            if assignment.status not in {AssignmentStatus.ACCEPTED, AssignmentStatus.CLOSED}:
                continue
            source = await self.store.get(assignment.task_id)
            if source is None or source.aggregate.status is not TaskStatus.PUBLISHED:
                continue
            for contribution in await self.store.contributions_for_assignment(assignment.id):
                if (
                    contribution.status is not ContributionStatus.ACCEPTED
                    or not contribution.artifact_keys
                ):
                    continue
                evidence.append(
                    CaseEvidence(
                        assignment.task_id,
                        contribution.id,
                        contribution.personal_summary,
                        source.competency_tags,
                        contribution.artifact_keys,
                        contribution.submitted_at,
                        source.aggregate.customer_id,
                    )
                )
        return tuple(
            sorted(evidence, key=lambda item: (item.submitted_at, str(item.contribution_id)))
        )

    async def customer_task_detail(self, actor: ActorContext, task_id: UUID) -> CustomerTaskDetail:
        self._role(actor, Role.CUSTOMER)
        task = await self._owned(actor, task_id)
        applications = await self.store.applications(task_id)
        assignments = await self.store.assignments_for_task(task_id)
        contributions_list: list[ContributionRecord] = []
        for assignment in assignments:
            contributions_list.extend(await self.store.contributions_for_assignment(assignment.id))
        decisions_list: list[AcceptanceRecord] = []
        for contribution in contributions_list:
            decision = await self.store.acceptance_for_contribution(contribution.id)
            if decision is not None:
                decisions_list.append(decision)
        return CustomerTaskDetail(
            task,
            await self.store.latest_terms(task_id),
            applications,
            assignments,
            tuple(contributions_list),
            tuple(decisions_list),
        )

    async def repeat_task(self, actor: ActorContext, task_id: UUID, *, task_key: str) -> TaskRecord:
        self._role(actor, Role.CUSTOMER)
        source = await self._owned(actor, task_id)
        terms = await self.store.latest_terms(task_id)
        if terms is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Для исходной задачи нет условий для повторного создания.",
                status_code=409,
            )
        return await self.create_draft(
            actor,
            project_key=source.project_key,
            task_key=task_key,
            title=source.title,
            brief=source.aggregate.brief,
            nominated_mentor_id=None,
            compensation=terms.compensation,
            places=source.places,
            mode=source.mode,
            competency_tags=source.competency_tags,
            case_rubric=source.case_rubric,
        )

    async def manager_overview(self, actor: ActorContext) -> ManagerOverview:
        self._role(actor, Role.MANAGER)
        initiatives: list[ManagerInitiative] = []
        for task in await self.store.customer_tasks(actor.person_id):
            terms = await self.store.latest_terms(task.aggregate.task_id)
            results: list[ManagerResult] = []
            for assignment in await self.store.assignments_for_task(task.aggregate.task_id):
                for contribution in await self.store.contributions_for_assignment(assignment.id):
                    if contribution.status is not ContributionStatus.ACCEPTED:
                        continue
                    results.append(
                        ManagerResult(
                            contribution_id=contribution.id,
                            task_id=task.aggregate.task_id,
                            task_title=task.title,
                            personal_summary=contribution.personal_summary,
                            artifact_keys=contribution.artifact_keys,
                            reused=any(
                                key.startswith("reuse:") for key in contribution.artifact_keys
                            ),
                        )
                    )
            initiatives.append(
                ManagerInitiative(
                    project_key=task.project_key,
                    task_id=task.aggregate.task_id,
                    task_title=task.title,
                    status=task.aggregate.status.value,
                    deadline_at=terms.deadline_at if terms else task.aggregate.brief.deadline_at,
                    accepted_results=tuple(results),
                )
            )
        accepted = sum(len(item.accepted_results) for item in initiatives)
        reused = sum(int(result.reused) for item in initiatives for result in item.accepted_results)
        return ManagerOverview(tuple(initiatives), len(initiatives), accepted, reused)

    async def submit(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.CUSTOMER)
        record = await self._owned(actor, task_id)
        aggregate = self._policy(record.aggregate.submit)
        return await self.store.save(
            TaskRecord(
                record.project_key,
                record.task_key,
                record.title,
                aggregate,
                record.places,
                record.mode,
                record.competency_tags,
                record.case_rubric,
            )
        )

    async def moderate(self, actor: ActorContext, task_id: UUID) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(record.aggregate.approve_moderation)
        return await self.store.save(
            TaskRecord(
                record.project_key,
                record.task_key,
                record.title,
                aggregate,
                record.places,
                record.mode,
                record.competency_tags,
                record.case_rubric,
            )
        )

    async def assign_support(
        self, actor: ActorContext, task_id: UUID, support: SupportAssignment
    ) -> TaskRecord:
        self._role(actor, Role.OPERATOR)
        record = await self._required(task_id)
        aggregate = self._policy(lambda: record.aggregate.assign_support(support))
        return await self.store.save(
            TaskRecord(
                record.project_key,
                record.task_key,
                record.title,
                aggregate,
                record.places,
                record.mode,
                record.competency_tags,
                record.case_rubric,
            )
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
                    latest.compensation,
                )
            )
        return await self.store.save(
            TaskRecord(
                record.project_key,
                record.task_key,
                record.title,
                aggregate,
                record.places,
                record.mode,
                record.competency_tags,
                record.case_rubric,
            )
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
        current = await self.store.latest_terms(task_id)
        if current is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED",
                message="Добавьте версию условий перед изменением.",
                status_code=409,
            )
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
                current.compensation,
            )
        )

    async def marketplace(self, actor: ActorContext) -> tuple[MarketplaceTask, ...]:
        self._role(actor, Role.PARTICIPANT)
        result: list[MarketplaceTask] = []
        for task in await self.store.published_tasks():
            invitation = (
                await self.store.invitation(task.aggregate.task_id, actor.person_id)
                if task.mode is TaskMode.INVITATION_ONLY
                else None
            )
            if task.mode is TaskMode.INVITATION_ONLY and not self._invitation_active(invitation):
                continue
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
                    (
                        (invitation.status if invitation else None)
                        if task.mode is TaskMode.INVITATION_ONLY
                        else None
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
        if task.mode is TaskMode.INVITATION_ONLY and not await self._visible_invitation(
            task_id, actor.person_id
        ):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        terms = await self.store.latest_terms(task_id)
        if terms is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        invitation = (
            await self.store.invitation(task_id, actor.person_id)
            if task.mode is TaskMode.INVITATION_ONLY
            else None
        )
        return MarketplaceTask(
            task,
            terms,
            await self.store.accepted_terms_version(actor.person_id, task_id),
            invitation.status if invitation else None,
        )

    async def _visible_invitation(self, task_id: UUID, person_id: UUID) -> bool:
        invitation = await self.store.invitation(task_id, person_id)
        return self._invitation_active(invitation)

    @staticmethod
    def _invitation_active(invitation: InvitationRecord | None) -> bool:
        return (
            invitation is not None
            and invitation.status in {"pending", "accepted"}
            and invitation.expires_at is not None
            and invitation.expires_at > datetime.now(UTC)
        )

    async def invite_candidate(
        self,
        actor: ActorContext,
        task_id: UUID,
        person_id: UUID,
        evidence_contribution_id: UUID,
        request_id: UUID,
        expires_at: datetime | None = None,
    ) -> InvitationRecord:
        self._role(actor, Role.CUSTOMER)
        task = await self._owned(actor, task_id)
        if (
            task.mode is not TaskMode.INVITATION_ONLY
            or task.aggregate.status is not TaskStatus.PUBLISHED
        ):
            raise ApiError(
                code="INVITATION_NOT_ALLOWED",
                message="Задача не открыта для приглашений.",
                status_code=409,
            )
        terms = await self.store.latest_terms(task_id)
        if terms is None:
            raise ApiError(
                code="TASK_TERMS_REQUIRED", message="Нет условий задачи.", status_code=409
            )
        invitation_expiry = min(expires_at, terms.deadline_at) if expires_at else terms.deadline_at
        if invitation_expiry <= datetime.now(UTC):
            raise ApiError(
                code="INVITATION_EXPIRED", message="Срок приглашения истёк.", status_code=409
            )
        if self.consent_store is None:
            raise ApiError(
                code="CONSENT_UNAVAILABLE", message="Согласие недоступно.", status_code=503
            )
        consents = await self.consent_store.granted_consents(person_id)
        if not {
            ConsentScope.TALENT_PROFILE,
            ConsentScope.TALENT_EVIDENCE,
            ConsentScope.TALENT_INVITATIONS,
        }.issubset(consents):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        matches = await self.match_candidates(actor, request_id, limit=None)
        match = next((item for item in matches if item.person_id == person_id), None)
        if match is None or evidence_contribution_id not in {
            item.contribution_id for item in match.evidence
        }:
            raise ApiError(
                code="RELEVANT_CASE_REQUIRED",
                message="Кандидат не подтверждён по запросу команды.",
                status_code=409,
            )
        evidence = await self.store.contribution(evidence_contribution_id)
        assignment = await self.store.assignment(evidence.assignment_id) if evidence else None
        if (
            evidence is None
            or evidence.status is not ContributionStatus.ACCEPTED
            or not evidence.artifact_keys
            or assignment is None
            or assignment.person_id != person_id
            or assignment.task_id == task_id
        ):
            raise ApiError(
                code="VERIFIED_CASE_REQUIRED",
                message="Подтверждённый кейс обязателен.",
                status_code=409,
            )
        assignments = await self.store.assignments_for_task(task_id)
        if len(assignments) >= task.places:
            raise ApiError(code="TASK_FULL", message="Места задачи уже заняты.", status_code=409)
        return await self.store.invite(task_id, person_id, terms.version, invitation_expiry)

    async def decide_invitation(
        self, actor: ActorContext, task_id: UUID, *, accepted: bool
    ) -> InvitationRecord:
        self._role(actor, Role.PARTICIPANT)
        invitation = await self.store.invitation(task_id, actor.person_id)
        if invitation is None or invitation.status != "pending":
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if not self._invitation_active(invitation):
            raise ApiError(
                code="INVITATION_EXPIRED", message="Срок приглашения истёк.", status_code=409
            )
        task = await self._required(task_id)
        terms = await self.store.latest_terms(task_id)
        if task.aggregate.status is not TaskStatus.PUBLISHED or terms is None:
            raise ApiError(
                code="INVITATION_EXPIRED", message="Приглашение недоступно.", status_code=409
            )
        if invitation.terms_version != terms.version:
            raise ApiError(code="TERMS_CHANGED", message="Условия изменились.", status_code=409)
        if accepted and len(await self.store.assignments_for_task(task_id)) >= task.places:
            raise ApiError(code="TASK_FULL", message="Места задачи уже заняты.", status_code=409)
        return await self.store.decide_invitation(
            task_id, actor.person_id, "accepted" if accepted else "declined"
        )

    async def revoke_invitation(
        self, actor: ActorContext, task_id: UUID, person_id: UUID
    ) -> InvitationRecord:
        self._role(actor, Role.CUSTOMER)
        await self._owned(actor, task_id)
        invitation = await self.store.invitation(task_id, person_id)
        if invitation is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if invitation.status == "revoked":
            return invitation
        return await self.store.decide_invitation(task_id, person_id, "revoked")

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
        if detail.task.mode is TaskMode.INVITATION_ONLY:
            invitation = await self.store.invitation(task_id, actor.person_id)
            if invitation is None or invitation.status != "accepted":
                raise ApiError(
                    code="INVITATION_NOT_ACCEPTED",
                    message="Сначала примите приглашение.",
                    status_code=409,
                )
            if not self._invitation_active(invitation):
                raise ApiError(
                    code="INVITATION_EXPIRED", message="Срок приглашения истёк.", status_code=409
                )
            if invitation.terms_version != detail.terms.version:
                raise ApiError(code="TERMS_CHANGED", message="Условия изменились.", status_code=409)
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
