"""Customer R&D task drafting and operator publication API."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import AnyHttpUrl, AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import (
    AcceptanceRecord,
    ApplicationRecord,
    AssignmentRecord,
    CandidateMatch,
    CandidateReservation,
    CheckpointRecord,
    ContributionRecord,
    CustomerTaskDetail,
    DisputeRecord,
    InvitationRecord,
    ManagerOverview,
    MarketplaceTask,
    TaskRecord,
    TeamArtifactRecord,
    TeamRequestRecord,
    TermsRecord,
    WorkItem,
    WorkService,
)
from impulse.domain.development import CompletionStatus
from impulse.domain.reward import CompensationTerms, RoundingMode
from impulse.domain.work import (
    AcceptanceDecision,
    ApplicationStatus,
    AssignmentStatus,
    CaseRubric,
    ContributionStatus,
    SupportAssignment,
    SupportMode,
    TaskBrief,
    TaskMode,
    TaskStatus,
)

router = APIRouter()


class CompensationRequest(BaseModel):
    paid: bool
    base_amount_per_assignee: Decimal | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    a_multiplier: Decimal
    quantum: Decimal = Decimal("0.01")
    rounding_mode: RoundingMode = RoundingMode.HALF_UP
    policy_version: int = Field(ge=1)
    payout_condition: str = Field(min_length=1, max_length=1000)


class CaseRubricRequest(BaseModel):
    version: int = Field(default=1, ge=1)
    result: str = Field(min_length=1, max_length=1000)
    reasoning: str = Field(min_length=1, max_length=1000)
    uncertainty: str = Field(min_length=1, max_length=1000)
    ai_use: str = Field(min_length=1, max_length=1000)
    defense: str = Field(min_length=1, max_length=1000)


class CreateTaskRequest(BaseModel):
    task_key: str = Field(min_length=1, max_length=96)
    title: str = Field(min_length=1, max_length=200)
    problem: str = Field(max_length=4000)
    deliverable: str = Field(max_length=4000)
    acceptance_criteria: list[str] = Field(max_length=30)
    deadline_at: AwareDatetime | None = None
    data_constraints: str = Field(max_length=4000)
    ip_terms: str = Field(max_length=4000)
    nominated_mentor_id: UUID | None = None
    places: int = Field(default=1, ge=1, le=100)
    mode: TaskMode = TaskMode.OPEN
    competency_tags: list[str] = Field(default_factory=list, max_length=20)
    case_rubric: CaseRubricRequest | None = None
    compensation: CompensationRequest


class SupportRequest(BaseModel):
    mode: SupportMode
    assignee_id: UUID | None = None


class ReviseTermsRequest(BaseModel):
    deadline_at: AwareDatetime
    deliverable: str = Field(min_length=1, max_length=4000)
    acceptance_criteria: list[str] = Field(min_length=1, max_length=30)


class AcceptTermsRequest(BaseModel):
    terms_version: int = Field(ge=1)


class AcceptApplicationRequest(BaseModel):
    expected_version: int = Field(ge=1)


class RepeatTaskRequest(BaseModel):
    task_key: str = Field(min_length=1, max_length=96)


class InviteCandidateRequest(BaseModel):
    person_id: UUID
    evidence_contribution_id: UUID
    request_id: UUID
    expires_at: AwareDatetime | None = None


class DecideInvitationRequest(BaseModel):
    accepted: bool


class TeamRequestCommand(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    required_tags: list[str] = Field(min_length=1, max_length=20)
    preferred_tags: list[str] = Field(default_factory=list, max_length=20)
    relevant_case_task_ids: list[UUID] = Field(min_length=1, max_length=30)


class TeamRequestView(BaseModel):
    id: UUID
    owner_id: UUID
    version: int
    title: str
    required_tags: list[str]
    preferred_tags: list[str]
    relevant_case_task_ids: list[UUID]


class CaseEvidenceView(BaseModel):
    task_id: UUID
    contribution_id: UUID
    personal_summary: str
    competency_tags: list[str]
    artifact_keys: list[str]
    submitted_at: AwareDatetime
    reviewer_id: UUID


class CandidateMatchView(BaseModel):
    person_id: UUID
    display_name: str
    request_version: int
    matched_required: list[str]
    matched_preferred: list[str]
    evidence: list[CaseEvidenceView]


class CandidateReservationView(BaseModel):
    id: UUID
    request_id: UUID
    person_id: UUID
    evidence_contribution_id: UUID
    created_at: AwareDatetime
    match: CandidateMatchView


class PassportSkillView(BaseModel):
    key: str
    practical_level: str
    confirmed_case_count: int


class TalentPassportView(BaseModel):
    person_id: UUID
    verified_courses: list[str]
    skills: list[PassportSkillView]
    cases: list[CaseEvidenceView]


class CheckpointRequest(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=300)


class ArtifactRequest(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    uri: AnyHttpUrl


class ContributionRequest(BaseModel):
    personal_summary: str = Field(max_length=2000)
    artifacts: list[ArtifactRequest] = Field(
        default_factory=lambda: list[ArtifactRequest](), max_length=20
    )


class ContributionDecisionRequest(BaseModel):
    decision: AcceptanceDecision
    reason: str = Field(min_length=1, max_length=2000)
    deadline_at: AwareDatetime | None = None


class AuthorshipDisputeRequest(BaseModel):
    conflicting_contribution_id: UUID | None = None
    reason: str = Field(min_length=1, max_length=2000)
    deadline_at: AwareDatetime


class TaskView(BaseModel):
    id: UUID
    project_key: str
    task_key: str
    title: str
    status: TaskStatus
    nominated_mentor_id: UUID | None
    support_mode: SupportMode | None
    support_assignee_id: UUID | None
    places: int
    mode: TaskMode = TaskMode.OPEN
    competency_tags: list[str] = Field(default_factory=list)
    case_rubric: CaseRubricRequest | None = None
    application_count: int | None = None
    assignment_count: int | None = None
    pending_result_count: int | None = None
    accepted_result_count: int | None = None
    deadline_at: AwareDatetime | None = None


class ApplicationView(BaseModel):
    id: UUID
    task_id: UUID
    person_id: UUID
    accepted_terms_version: int
    status: ApplicationStatus
    version: int


class InvitationView(BaseModel):
    id: UUID
    task_id: UUID
    person_id: UUID
    terms_version: int
    status: str
    expires_at: AwareDatetime | None


class AssignmentView(BaseModel):
    id: UUID
    task_id: UUID
    person_id: UUID
    application_id: UUID
    status: AssignmentStatus


class CheckpointView(BaseModel):
    key: str
    title: str
    status: str


class ContributionView(BaseModel):
    id: UUID
    assignment_id: UUID
    version: int
    personal_summary: str
    artifact_keys: list[str]
    status: ContributionStatus


class AcceptanceView(BaseModel):
    id: UUID
    contribution_id: UUID
    contribution_version: int
    decision: AcceptanceDecision
    reason: str
    deadline_at: AwareDatetime | None
    owner_id: UUID | None


class DisputeView(BaseModel):
    id: UUID
    contribution_id: UUID
    conflicting_contribution_id: UUID | None
    status: str
    reason: str
    deadline_at: AwareDatetime
    owner: str
    review_blocked: bool
    payout_blocked: bool


class ArtifactView(BaseModel):
    key: str
    uri: str


class CompensationView(BaseModel):
    paid: bool
    base_amount_per_assignee: Decimal | None
    currency: str | None
    b_multiplier: Decimal
    a_multiplier: Decimal
    b_total: Decimal | None
    a_total: Decimal | None
    quantum: Decimal
    rounding_mode: RoundingMode
    policy_version: int
    payout_condition: str


class TermsView(BaseModel):
    version: int
    deadline_at: AwareDatetime
    deliverable: str
    acceptance_criteria: list[str]
    support_mode: str | None
    compensation: CompensationView


class CustomerTaskDetailView(BaseModel):
    task: TaskView
    problem: str
    deliverable: str
    acceptance_criteria: list[str]
    data_constraints: str
    ip_terms: str
    terms: TermsView | None
    applications: list[ApplicationView]
    assignments: list[AssignmentView]
    contributions: list[ContributionView]
    decisions: list[AcceptanceView]


class MarketplaceTaskView(BaseModel):
    task: TaskView
    terms: TermsView
    accepted_terms_version: int | None
    invitation_status: str | None = None


class WorkItemView(BaseModel):
    assignment: AssignmentView
    task: TaskView
    terms: TermsView
    contributions: list[ContributionView]
    decisions: list[AcceptanceView]


class ManagerResultView(BaseModel):
    contribution_id: UUID
    task_id: UUID
    task_title: str
    personal_summary: str
    artifact_keys: list[str]
    reused: bool


class ManagerInitiativeView(BaseModel):
    project_key: str
    task_id: UUID
    task_title: str
    status: str
    deadline_at: AwareDatetime | None
    accepted_results: list[ManagerResultView]


class ManagerOverviewView(BaseModel):
    initiatives: list[ManagerInitiativeView]
    task_count: int
    accepted_result_count: int
    reused_result_count: int


def _service(request: Request) -> WorkService:
    return request.app.state.work_service


def _view(record: TaskRecord) -> TaskView:
    support = record.aggregate.support
    return TaskView(
        id=record.aggregate.task_id,
        project_key=record.project_key,
        task_key=record.task_key,
        title=record.title,
        status=record.aggregate.status,
        nominated_mentor_id=record.aggregate.nominated_mentor_id,
        support_mode=support.mode if support else None,
        support_assignee_id=support.assignee_id if support else None,
        places=record.places,
        mode=record.mode,
        competency_tags=list(record.competency_tags),
        case_rubric=(
            CaseRubricRequest.model_validate(record.case_rubric, from_attributes=True)
            if record.case_rubric
            else None
        ),
    )


def _invitation_view(record: InvitationRecord) -> InvitationView:
    return InvitationView.model_validate(record, from_attributes=True)


def _team_request_view(record: TeamRequestRecord) -> TeamRequestView:
    return TeamRequestView.model_validate(record, from_attributes=True)


def _candidate_match_view(record: CandidateMatch) -> CandidateMatchView:
    return CandidateMatchView.model_validate(record, from_attributes=True)


def _reservation_view(
    record: CandidateReservation, match: CandidateMatch
) -> CandidateReservationView:
    return CandidateReservationView(
        id=record.id,
        request_id=record.request_id,
        person_id=record.person_id,
        evidence_contribution_id=record.evidence_contribution_id,
        created_at=record.created_at,
        match=_candidate_match_view(match),
    )


def _customer_detail_view(detail: CustomerTaskDetail) -> CustomerTaskDetailView:
    brief = detail.task.aggregate.brief
    return CustomerTaskDetailView(
        task=_view(detail.task),
        problem=brief.problem,
        deliverable=brief.deliverable,
        acceptance_criteria=list(brief.acceptance_criteria),
        data_constraints=brief.data_constraints,
        ip_terms=brief.ip_terms,
        terms=_terms_view(detail.terms) if detail.terms else None,
        applications=[_application_view(item) for item in detail.applications],
        assignments=[_assignment_view(item) for item in detail.assignments],
        contributions=[_contribution_view(item) for item in detail.contributions],
        decisions=[_acceptance_view(item) for item in detail.decisions],
    )


def _application_view(item: ApplicationRecord) -> ApplicationView:
    return ApplicationView(
        id=item.id,
        task_id=item.task_id,
        person_id=item.person_id,
        accepted_terms_version=item.accepted_terms_version,
        status=item.status,
        version=item.version,
    )


def _assignment_view(item: AssignmentRecord) -> AssignmentView:
    return AssignmentView(
        id=item.id,
        task_id=item.task_id,
        person_id=item.person_id,
        application_id=item.application_id,
        status=item.status,
    )


def _contribution_view(item: ContributionRecord) -> ContributionView:
    return ContributionView(
        id=item.id,
        assignment_id=item.assignment_id,
        version=item.version,
        personal_summary=item.personal_summary,
        artifact_keys=list(item.artifact_keys),
        status=item.status,
    )


def _acceptance_view(item: AcceptanceRecord) -> AcceptanceView:
    return AcceptanceView(
        id=item.id,
        contribution_id=item.contribution_id,
        contribution_version=item.contribution_version,
        decision=item.decision,
        reason=item.reason,
        deadline_at=item.deadline_at,
        owner_id=item.owner_id,
    )


def _dispute_view(item: DisputeRecord) -> DisputeView:
    return DisputeView(
        id=item.id,
        contribution_id=item.contribution_id,
        conflicting_contribution_id=item.conflicting_contribution_id,
        status=item.status,
        reason=item.reason,
        deadline_at=item.deadline_at,
        owner=item.owner,
        review_blocked=item.review_blocked,
        payout_blocked=item.payout_blocked,
    )


def _terms_view(terms: TermsRecord) -> TermsView:
    return TermsView(
        version=terms.version,
        deadline_at=terms.deadline_at,
        deliverable=terms.deliverable,
        acceptance_criteria=list(terms.acceptance_criteria),
        support_mode=terms.support_mode,
        compensation=_compensation_view(terms.compensation),
    )


def _compensation_view(terms: CompensationTerms) -> CompensationView:
    return CompensationView(
        paid=terms.paid,
        base_amount_per_assignee=terms.base_amount_per_assignee,
        currency=terms.currency,
        b_multiplier=terms.b_multiplier,
        a_multiplier=terms.a_multiplier,
        b_total=terms.premium_total("B"),
        a_total=terms.premium_total("A"),
        quantum=terms.quantum,
        rounding_mode=terms.rounding_mode,
        policy_version=terms.policy_version,
        payout_condition=terms.payout_condition,
    )


def _marketplace_view(item: MarketplaceTask) -> MarketplaceTaskView:
    return MarketplaceTaskView(
        task=_view(item.task),
        terms=_terms_view(item.terms),
        accepted_terms_version=item.accepted_terms_version,
        invitation_status=item.invitation_status,
    )


def _work_item_view(item: WorkItem) -> WorkItemView:
    return WorkItemView(
        assignment=_assignment_view(item.assignment),
        task=_view(item.task),
        terms=_terms_view(item.terms),
        contributions=[_contribution_view(contribution) for contribution in item.contributions],
        decisions=[_acceptance_view(decision) for decision in item.decisions],
    )


def _manager_view(item: ManagerOverview) -> ManagerOverviewView:
    return ManagerOverviewView(
        initiatives=[
            ManagerInitiativeView(
                project_key=initiative.project_key,
                task_id=initiative.task_id,
                task_title=initiative.task_title,
                status=initiative.status,
                deadline_at=initiative.deadline_at,
                accepted_results=[
                    ManagerResultView(
                        contribution_id=result.contribution_id,
                        task_id=result.task_id,
                        task_title=result.task_title,
                        personal_summary=result.personal_summary,
                        artifact_keys=list(result.artifact_keys),
                        reused=result.reused,
                    )
                    for result in initiative.accepted_results
                ],
            )
            for initiative in item.initiatives
        ],
        task_count=item.task_count,
        accepted_result_count=item.accepted_result_count,
        reused_result_count=item.reused_result_count,
    )


@router.get("/customer/tasks", response_model=list[TaskView])
async def customer_tasks(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[TaskView]:
    result: list[TaskView] = []
    for item in await service.customer_tasks(authenticated.actor):
        detail = await service.customer_task_detail(authenticated.actor, item.aggregate.task_id)
        accepted_ids = {
            decision.contribution_id
            for decision in detail.decisions
            if decision.decision is AcceptanceDecision.ACCEPTED
        }
        decided_ids = {decision.contribution_id for decision in detail.decisions}
        result.append(
            _view(item).model_copy(
                update={
                    "application_count": len(detail.applications),
                    "assignment_count": len(detail.assignments),
                    "pending_result_count": sum(
                        contribution.id not in decided_ids for contribution in detail.contributions
                    ),
                    "accepted_result_count": len(accepted_ids),
                    "deadline_at": (
                        detail.terms.deadline_at
                        if detail.terms is not None
                        else item.aggregate.brief.deadline_at
                    ),
                }
            )
        )
    return result


@router.get("/customer/cases", response_model=list[TaskView])
async def customer_cases(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[TaskView]:
    return [_view(task) for task in await service.case_catalog(authenticated.actor)]


@router.get("/customer/tasks/{task_id}", response_model=CustomerTaskDetailView)
async def customer_task_detail(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> CustomerTaskDetailView:
    return _customer_detail_view(await service.customer_task_detail(authenticated.actor, task_id))


@router.post("/customer/tasks/{task_id}/repeat", response_model=TaskView)
async def repeat_task(
    task_id: UUID,
    command: RepeatTaskRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(await service.repeat_task(authenticated.actor, task_id, task_key=command.task_key))


@router.post("/customer/tasks/{task_id}/invitations", response_model=InvitationView)
async def invite_candidate(
    task_id: UUID,
    command: InviteCandidateRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> InvitationView:
    return _invitation_view(
        await service.invite_candidate(
            authenticated.actor,
            task_id,
            command.person_id,
            command.evidence_contribution_id,
            command.request_id,
            command.expires_at,
        )
    )


@router.post(
    "/customer/tasks/{task_id}/invitations/{person_id}/revoke", response_model=InvitationView
)
async def revoke_invitation(
    task_id: UUID,
    person_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> InvitationView:
    return _invitation_view(
        await service.revoke_invitation(authenticated.actor, task_id, person_id)
    )


@router.post("/customer/team-requests", response_model=TeamRequestView)
async def create_team_request(
    command: TeamRequestCommand,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TeamRequestView:
    return _team_request_view(
        await service.save_team_request(
            authenticated.actor,
            title=command.title,
            required_tags=tuple(command.required_tags),
            preferred_tags=tuple(command.preferred_tags),
            relevant_case_task_ids=tuple(command.relevant_case_task_ids),
        )
    )


@router.put("/customer/team-requests/{request_id}", response_model=TeamRequestView)
async def revise_team_request(
    request_id: UUID,
    command: TeamRequestCommand,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TeamRequestView:
    return _team_request_view(
        await service.save_team_request(
            authenticated.actor,
            request_id=request_id,
            title=command.title,
            required_tags=tuple(command.required_tags),
            preferred_tags=tuple(command.preferred_tags),
            relevant_case_task_ids=tuple(command.relevant_case_task_ids),
        )
    )


@router.get("/customer/team-requests/{request_id}", response_model=TeamRequestView)
async def team_request(
    request_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TeamRequestView:
    return _team_request_view(await service.team_request(authenticated.actor, request_id))


@router.get("/customer/team-requests/{request_id}/matches", response_model=list[CandidateMatchView])
async def team_request_matches(
    request_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[CandidateMatchView]:
    return [
        _candidate_match_view(item)
        for item in await service.match_candidates(authenticated.actor, request_id)
    ]


@router.post(
    "/customer/team-requests/{request_id}/saved/{person_id}",
    response_model=CandidateReservationView,
)
async def save_candidate(
    request_id: UUID,
    person_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> CandidateReservationView:
    record = await service.save_candidate(authenticated.actor, request_id, person_id)
    match = next(
        item
        for item in await service.match_candidates(authenticated.actor, request_id, limit=None)
        if item.person_id == person_id
    )
    return _reservation_view(record, match)


@router.get("/customer/saved-candidates", response_model=list[CandidateReservationView])
async def saved_candidates(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[CandidateReservationView]:
    return [
        _reservation_view(record, match)
        for record, match in await service.saved_candidates(authenticated.actor)
    ]


@router.get("/me/talent-passport", response_model=TalentPassportView)
async def talent_passport(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TalentPassportView:
    cases = await service.participant_case_evidence(authenticated.actor)
    enrollments = await request.app.state.development_service.store.enrollments(
        authenticated.actor.person_id
    )
    verified_courses = sorted(
        item.course_key for item in enrollments if item.status is CompletionStatus.VERIFIED
    )
    skill_counts: dict[str, set[UUID]] = {}
    for item in cases:
        for tag in item.competency_tags:
            skill_counts.setdefault(tag, set()).add(item.task_id)
    return TalentPassportView(
        person_id=authenticated.actor.person_id,
        verified_courses=verified_courses,
        skills=[
            PassportSkillView(
                key=key, practical_level="confirmed", confirmed_case_count=len(task_ids)
            )
            for key, task_ids in sorted(skill_counts.items())
        ],
        cases=[CaseEvidenceView.model_validate(item, from_attributes=True) for item in cases],
    )


@router.post("/me/tasks/{task_id}/invitation", response_model=InvitationView)
async def decide_invitation(
    task_id: UUID,
    command: DecideInvitationRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> InvitationView:
    return _invitation_view(
        await service.decide_invitation(authenticated.actor, task_id, accepted=command.accepted)
    )


@router.get("/manager/overview", response_model=ManagerOverviewView)
async def manager_overview(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ManagerOverviewView:
    return _manager_view(await service.manager_overview(authenticated.actor))


@router.post("/customer/projects/{project_key}/tasks", response_model=TaskView)
async def create_task(
    project_key: str,
    command: CreateTaskRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(
        await service.create_draft(
            authenticated.actor,
            project_key=project_key,
            task_key=command.task_key,
            title=command.title,
            brief=TaskBrief(
                problem=command.problem,
                deliverable=command.deliverable,
                acceptance_criteria=tuple(command.acceptance_criteria),
                deadline_at=command.deadline_at,
                data_constraints=command.data_constraints,
                ip_terms=command.ip_terms,
            ),
            nominated_mentor_id=command.nominated_mentor_id,
            compensation=CompensationTerms(
                paid=command.compensation.paid,
                base_amount_per_assignee=command.compensation.base_amount_per_assignee,
                currency=command.compensation.currency,
                a_multiplier=command.compensation.a_multiplier,
                quantum=command.compensation.quantum,
                rounding_mode=command.compensation.rounding_mode,
                policy_version=command.compensation.policy_version,
                payout_condition=command.compensation.payout_condition,
            ),
            places=command.places,
            mode=command.mode,
            competency_tags=tuple(command.competency_tags),
            case_rubric=(
                CaseRubric(**command.case_rubric.model_dump()) if command.case_rubric else None
            ),
        )
    )


@router.post("/customer/tasks/{task_id}/submit", response_model=TaskView)
async def submit_task(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(await service.submit(authenticated.actor, task_id))


@router.post("/customer/tasks/{task_id}/terms", response_model=TermsView)
async def revise_terms(
    task_id: UUID,
    command: ReviseTermsRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TermsView:
    return _terms_view(
        await service.revise_terms(
            authenticated.actor,
            task_id,
            deadline_at=command.deadline_at,
            deliverable=command.deliverable,
            acceptance_criteria=tuple(command.acceptance_criteria),
        )
    )


@router.post("/operations/tasks/{task_id}/moderate", response_model=TaskView)
async def moderate_task(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(await service.moderate(authenticated.actor, task_id))


@router.post("/operations/tasks/{task_id}/support", response_model=TaskView)
async def assign_support(
    task_id: UUID,
    command: SupportRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(
        await service.assign_support(
            authenticated.actor,
            task_id,
            SupportAssignment(command.mode, command.assignee_id),
        )
    )


@router.post("/operations/tasks/{task_id}/publish", response_model=TaskView)
async def publish_task(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TaskView:
    return _view(await service.publish(authenticated.actor, task_id))


@router.get("/marketplace/tasks", response_model=list[MarketplaceTaskView])
async def marketplace_tasks(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[MarketplaceTaskView]:
    return [_marketplace_view(item) for item in await service.marketplace(authenticated.actor)]


@router.get("/marketplace/tasks/{task_id}", response_model=MarketplaceTaskView)
async def marketplace_task(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> MarketplaceTaskView:
    return _marketplace_view(await service.task_detail(authenticated.actor, task_id))


@router.post("/me/tasks/{task_id}/terms-consent", response_model=MarketplaceTaskView)
async def accept_terms(
    task_id: UUID,
    command: AcceptTermsRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> MarketplaceTaskView:
    return _marketplace_view(
        await service.accept_terms(authenticated.actor, task_id, command.terms_version)
    )


@router.post("/me/tasks/{task_id}/applications", response_model=ApplicationView)
async def apply_to_task(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ApplicationView:
    return _application_view(await service.apply(authenticated.actor, task_id))


@router.get("/customer/tasks/{task_id}/applications", response_model=list[ApplicationView])
async def task_applications(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[ApplicationView]:
    return [
        _application_view(item)
        for item in await service.task_applications(authenticated.actor, task_id)
    ]


@router.post("/customer/applications/{application_id}/accept", response_model=AssignmentView)
async def accept_candidate(
    application_id: UUID,
    command: AcceptApplicationRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> AssignmentView:
    return _assignment_view(
        await service.accept_candidate(
            authenticated.actor, application_id, command.expected_version
        )
    )


@router.post("/me/assignments/{assignment_id}/start", response_model=AssignmentView)
async def start_assignment(
    assignment_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> AssignmentView:
    return _assignment_view(await service.start_work(authenticated.actor, assignment_id))


@router.post("/customer/tasks/{task_id}/checkpoints", response_model=CheckpointView)
async def add_checkpoint(
    task_id: UUID,
    command: CheckpointRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> CheckpointView:
    item = await service.add_checkpoint(
        authenticated.actor, task_id, CheckpointRecord(command.key, command.title)
    )
    return CheckpointView(key=item.key, title=item.title, status=item.status)


@router.post("/customer/tasks/{task_id}/team-artifacts", response_model=ArtifactView)
async def add_team_artifact(
    task_id: UUID,
    command: ArtifactRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ArtifactView:
    item = await service.add_team_artifact(
        authenticated.actor,
        task_id,
        TeamArtifactRecord(command.key, str(command.uri)),
    )
    return ArtifactView(key=item.key, uri=item.uri)


@router.post("/me/assignments/{assignment_id}/contributions", response_model=ContributionView)
async def submit_contribution(
    assignment_id: UUID,
    command: ContributionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ContributionView:
    return _contribution_view(
        await service.submit_contribution(
            authenticated.actor,
            assignment_id,
            command.personal_summary,
            tuple(TeamArtifactRecord(item.key, str(item.uri)) for item in command.artifacts),
        )
    )


@router.post("/customer/contributions/{contribution_id}/decision", response_model=AcceptanceView)
async def decide_contribution(
    contribution_id: UUID,
    command: ContributionDecisionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> AcceptanceView:
    return _acceptance_view(
        await service.decide_submitted_contribution(
            authenticated.actor,
            contribution_id,
            decision=command.decision,
            reason=command.reason,
            deadline_at=command.deadline_at,
        )
    )


@router.post("/me/contributions/{contribution_id}/authorship-disputes", response_model=DisputeView)
async def dispute_authorship(
    contribution_id: UUID,
    command: AuthorshipDisputeRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> DisputeView:
    return _dispute_view(
        await service.dispute_authorship(
            authenticated.actor,
            contribution_id,
            conflicting_contribution_id=command.conflicting_contribution_id,
            reason=command.reason,
            deadline_at=command.deadline_at,
        )
    )


@router.get("/me/disputes/{dispute_id}", response_model=DisputeView)
async def participant_dispute(
    dispute_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> DisputeView:
    return _dispute_view(await service.participant_dispute(authenticated.actor, dispute_id))


@router.get("/me/work", response_model=list[WorkItemView])
async def participant_work(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[WorkItemView]:
    return [_work_item_view(item) for item in await service.participant_work(authenticated.actor)]


@router.get("/customer/tasks/{task_id}/participant-preview", response_model=list[WorkItemView])
async def participant_preview(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[WorkItemView]:
    return [
        _work_item_view(item)
        for item in await service.participant_preview(authenticated.actor, task_id)
    ]
