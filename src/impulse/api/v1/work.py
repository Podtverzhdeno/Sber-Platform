"""Customer R&D task drafting and operator publication API."""

from __future__ import annotations

import base64
import binascii
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import Response
from pydantic import AnyHttpUrl, AwareDatetime, BaseModel, Field
from sqlalchemy import text

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.api.v1.work_requests import (
    CompensationRequest as CompensationRequest,
    CaseRubricRequest as CaseRubricRequest,
    CatalogStageRequest as CatalogStageRequest,
    TaskCatalogMetadataRequest as TaskCatalogMetadataRequest,
    CreateTaskRequest as CreateTaskRequest,
    SupportRequest as SupportRequest,
    ReviseTermsRequest as ReviseTermsRequest,
    AcceptTermsRequest as AcceptTermsRequest,
    AcceptApplicationRequest as AcceptApplicationRequest,
    RepeatTaskRequest as RepeatTaskRequest,
    InviteCandidateRequest as InviteCandidateRequest,
    DecideInvitationRequest as DecideInvitationRequest,
    TeamRequestCommand as TeamRequestCommand,
    CheckpointRequest as CheckpointRequest,
    ArtifactRequest as ArtifactRequest,
    ContributionRequest as ContributionRequest,
    ContributionDecisionRequest as ContributionDecisionRequest,
    AuthorshipDisputeRequest as AuthorshipDisputeRequest,
)
from impulse.application.identity import AuthenticatedSession, PersonaRecord
from impulse.application.project_credentials import ProjectCredentialService
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
    ParticipantTaskDetail,
    TaskRecord,
    TeamArtifactRecord,
    TeamRequestRecord,
    TermsRecord,
    WorkItem,
    WorkService,
)
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ConsentScope, Role
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
    case_fixes: int = 0
    freshness: str = "current"


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
    last_confirmed_at: AwareDatetime | None = None


class TalentPassportView(BaseModel):
    person_id: UUID
    verified_courses: list[str]
    skills: list[PassportSkillView]
    cases: list[CaseEvidenceView]


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
    catalog: TaskCatalogMetadataRequest = Field(default_factory=TaskCatalogMetadataRequest)
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
    participant_name: str | None = None
    verified_case_count: int | None = None


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
    description: str = ""
    deliverable: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    estimated_minutes: int | None = None


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


class ProjectCompetencyView(BaseModel):
    competency: str
    level: str
    evidence_refs: list[str]
    finding: str


class ProjectCredentialView(BaseModel):
    credential_id: str
    verification_id: str
    contribution_version: int
    holder_name: str
    customer_name: str
    task_title: str
    task_key: str
    project_key: str
    period: str
    personal_summary: str
    artifact_keys: list[str]
    grade_label: str
    review_explanation: str
    competencies: list[ProjectCompetencyView]
    payment_status: str
    signed_at: AwareDatetime
    status: str
    superseded_by: str | None


def _project_credential_view(item: object) -> ProjectCredentialView:
    from impulse.application.project_credentials import ProjectCredential

    if not isinstance(item, ProjectCredential):
        raise TypeError("Expected ProjectCredential")
    return ProjectCredentialView(
        credential_id=str(item.credential_id),
        verification_id=item.verification_id,
        contribution_version=item.contribution_version,
        holder_name=item.holder_name,
        customer_name=item.customer_name,
        task_title=item.task_title,
        task_key=item.task_key,
        project_key=item.project_key,
        period=item.period,
        personal_summary=item.personal_summary,
        artifact_keys=list(item.artifact_keys),
        grade_label=item.grade_label(),
        review_explanation=item.review_explanation,
        competencies=[
            ProjectCompetencyView(
                competency=cell.competency,
                level=cell.level,
                evidence_refs=list(cell.evidence_refs),
                finding=cell.finding,
            )
            for cell in item.competencies
        ],
        payment_status=item.payment_status,
        signed_at=item.signed_at,
        status=item.status,
        superseded_by=item.superseded_by,
    )


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
    allowed_artifacts: list[str]
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
    allowed_artifacts: list[str] = Field(default_factory=list)


class PartnerView(BaseModel):
    id: UUID
    display_name: str


class SupportView(BaseModel):
    mode: str
    assignee: PartnerView


class TeamMemberView(BaseModel):
    person_id: UUID
    display_name: str
    status: AssignmentStatus


class QuickCardSkillView(BaseModel):
    title: str
    origin: str
    verified: bool


def _empty_quick_card_skills() -> list[QuickCardSkillView]:
    return []


class QuickCardProfileView(BaseModel):
    city: str | None = None
    university: str | None = None
    telegram: str | None = None
    about: str | None = None
    skills: list[QuickCardSkillView] = Field(default_factory=_empty_quick_card_skills)


class TeamQuickCardView(BaseModel):
    person_id: UUID
    task_id: UUID
    assignment_status: str | None
    contribution_status: str | None
    availability: str
    project_role: str
    responsibility: str
    display_name: str
    portfolio_available: bool
    profile: QuickCardProfileView


class TermsHistoryEntryView(BaseModel):
    version: int
    deadline_at: AwareDatetime
    deliverable: str


class ReviewFeedbackView(BaseModel):
    contribution_id: UUID
    contribution_version: int
    review_version: int
    grade: str
    explanation: str
    status: str


class ParticipantTaskDetailView(BaseModel):
    task: TaskView
    problem: str
    deliverable: str
    acceptance_criteria: list[str]
    deadline_at: AwareDatetime | None
    data_constraints: str
    ip_terms: str
    allowed_artifacts: list[str]
    terms: TermsView
    terms_history: list[TermsHistoryEntryView]
    accepted_terms_version: int | None
    invitation_status: str | None
    customer: PartnerView
    mentor: PartnerView | None
    support: SupportView | None
    team: list[TeamMemberView]
    membership: AssignmentView | None
    checkpoints: list[CheckpointView]
    personal: list[ContributionView]
    feedback: list[ReviewFeedbackView]
    applications: list[ApplicationView]


class WorkItemView(BaseModel):
    assignment: AssignmentView
    task: TaskView
    terms: TermsView
    allowed_artifacts: list[str] = Field(default_factory=list)
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
        catalog=TaskCatalogMetadataRequest.model_validate(record.catalog, from_attributes=True),
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
        allowed_artifacts=list(brief.allowed_artifacts),
        terms=_terms_view(detail.terms) if detail.terms else None,
        applications=[_application_view(item) for item in detail.applications],
        assignments=[_assignment_view(item) for item in detail.assignments],
        contributions=[_contribution_view(item) for item in detail.contributions],
        decisions=[_acceptance_view(item) for item in detail.decisions],
    )


def _application_view(
    item: ApplicationRecord, participant: tuple[str | None, int] | None = None
) -> ApplicationView:
    return ApplicationView(
        id=item.id,
        task_id=item.task_id,
        person_id=item.person_id,
        accepted_terms_version=item.accepted_terms_version,
        status=item.status,
        version=item.version,
        participant_name=None if participant is None else participant[0],
        verified_case_count=None if participant is None else participant[1],
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
        allowed_artifacts=list(item.task.aggregate.brief.allowed_artifacts),
    )


def _partner_view(person_id: UUID | None, persona: PersonaRecord | None) -> PartnerView | None:
    if person_id is None:
        return None
    return PartnerView(
        id=person_id,
        display_name=persona.display_name if persona is not None else "",
    )


def _participant_task_detail_view(
    detail: ParticipantTaskDetail,
    customer: PartnerView,
    mentor: PartnerView | None,
    support: SupportView | None,
    team: list[TeamMemberView],
    feedback: list[ReviewFeedbackView],
) -> ParticipantTaskDetailView:
    brief = detail.brief
    return ParticipantTaskDetailView(
        task=_view(detail.task.task),
        problem=brief.problem,
        deliverable=brief.deliverable,
        acceptance_criteria=list(brief.acceptance_criteria),
        deadline_at=brief.deadline_at,
        data_constraints=brief.data_constraints,
        ip_terms=brief.ip_terms,
        allowed_artifacts=list(brief.allowed_artifacts),
        terms=_terms_view(detail.task.terms),
        terms_history=[
            TermsHistoryEntryView(
                version=terms.version,
                deadline_at=terms.deadline_at,
                deliverable=terms.deliverable,
            )
            for terms in detail.terms_history
        ],
        accepted_terms_version=detail.task.accepted_terms_version,
        invitation_status=detail.task.invitation_status,
        customer=customer,
        mentor=mentor,
        support=support,
        team=team,
        membership=(_assignment_view(detail.membership) if detail.membership is not None else None),
        checkpoints=[
            CheckpointView(
                key=item.key,
                title=item.title,
                status=item.status,
                description=item.description,
                deliverable=item.deliverable,
                acceptance_criteria=list(item.acceptance_criteria),
                estimated_minutes=item.estimated_minutes,
            )
            for item in detail.checkpoints
        ],
        personal=[_contribution_view(item) for item in detail.contributions],
        feedback=feedback,
        applications=[_application_view(item) for item in detail.applications],
    )


def _work_item_view(item: WorkItem) -> WorkItemView:
    return WorkItemView(
        assignment=_assignment_view(item.assignment),
        task=_view(item.task),
        terms=_terms_view(item.terms),
        allowed_artifacts=list(item.task.aggregate.brief.allowed_artifacts),
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


CustomerEventKind = Literal[
    "project_created",
    "participant_assigned",
    "result_submitted",
    "result_accepted",
    "revision_requested",
]


class CustomerActivityEventView(BaseModel):
    """One dated, verified event inside a task owned by this customer."""

    id: str
    task_id: UUID
    task_title: str
    kind: CustomerEventKind
    occurred_at: AwareDatetime


class CustomerActivityView(BaseModel):
    generated_at: AwareDatetime
    # Returned events cover at most the preceding 84 complete days plus today.
    window_days: int = 84
    events: list[CustomerActivityEventView]


@router.get("/customer/analytics/activity", response_model=CustomerActivityView)
async def customer_analytics_activity(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> CustomerActivityView:
    """Real project activity; data is restricted to the authenticated customer's tasks."""
    end = datetime.now(UTC)
    start = end - timedelta(days=84)
    events: list[CustomerActivityEventView] = []
    for task in await service.customer_tasks(authenticated.actor):
        task_id = task.aggregate.task_id

        def append(
            kind: CustomerEventKind,
            key: str,
            occurred_at: datetime | None,
            event_task_id: UUID = task_id,
            event_task_title: str = task.title,
        ) -> None:
            if occurred_at is None or not start <= occurred_at <= end:
                return
            events.append(
                CustomerActivityEventView(
                    id=f"{kind}:{key}",
                    task_id=event_task_id,
                    task_title=event_task_title,
                    kind=kind,
                    occurred_at=occurred_at,
                )
            )

        append("project_created", str(task_id), task.created_at)
        detail = await service.customer_task_detail(authenticated.actor, task_id)
        for assignment in detail.assignments:
            append("participant_assigned", str(assignment.id), assignment.created_at)
        for contribution in detail.contributions:
            append("result_submitted", str(contribution.id), contribution.submitted_at)
        for decision in detail.decisions:
            if decision.decision is AcceptanceDecision.ACCEPTED:
                append("result_accepted", str(decision.id), decision.decided_at)
            elif decision.decision is AcceptanceDecision.REVISION_REQUESTED:
                append("revision_requested", str(decision.id), decision.decided_at)

    events.sort(key=lambda item: (item.occurred_at, item.id), reverse=True)
    return CustomerActivityView(generated_at=end, events=events)


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
    skill_fresh: dict[str, AwareDatetime] = {}
    for item in cases:
        for tag in item.competency_tags:
            skill_counts.setdefault(tag, set()).add(item.task_id)
            known = skill_fresh.get(tag)
            if known is None or item.submitted_at > known:
                skill_fresh[tag] = item.submitted_at
    now = datetime.now(UTC)
    fresh_limit = now - timedelta(days=90)
    case_views: list[CaseEvidenceView] = []
    for entry in cases:
        view = CaseEvidenceView.model_validate(entry, from_attributes=True).model_dump()
        view["freshness"] = "current" if entry.submitted_at >= fresh_limit else "aging"
        case_views.append(CaseEvidenceView.model_validate(view))
    return TalentPassportView(
        person_id=authenticated.actor.person_id,
        verified_courses=verified_courses,
        skills=[
            PassportSkillView(
                key=key,
                practical_level="confirmed",
                confirmed_case_count=len(task_ids),
                last_confirmed_at=skill_fresh.get(key),
            )
            for key, task_ids in sorted(skill_counts.items())
        ],
        cases=case_views,
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
                allowed_artifacts=tuple(command.allowed_artifacts),
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
            catalog=command.catalog.to_domain() if command.catalog is not None else None,
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


@router.get("/me/tasks/{task_id}", response_model=ParticipantTaskDetailView)
async def participant_task_detail(
    request: Request,
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ParticipantTaskDetailView:
    detail = await service.participant_task_detail(authenticated.actor, task_id)
    personas = request.app.state.auth_service.store
    reward = request.app.state.reward_service
    reviews = [
        workspace.review
        for workspace in await reward.participant_reward_evidence(authenticated.actor)
    ]

    aggregate = detail.task.task.aggregate
    customer, mentor = await personas.get_persona_by_id(aggregate.customer_id), None
    if aggregate.nominated_mentor_id is not None:
        mentor = await personas.get_persona_by_id(aggregate.nominated_mentor_id)
    support = None
    if aggregate.support is not None and aggregate.support.assignee_id is not None:
        support_assignee = await personas.get_persona_by_id(aggregate.support.assignee_id)
        assignee_view = _partner_view(aggregate.support.assignee_id, support_assignee)
        if assignee_view is not None:
            support = SupportView(mode=aggregate.support.mode.value, assignee=assignee_view)

    team: list[TeamMemberView] = []
    for member in detail.team:
        persona = await personas.get_persona_by_id(member.person_id)
        member_view = _partner_view(member.person_id, persona)
        if member_view is not None:
            team.append(
                TeamMemberView(
                    person_id=member_view.id,
                    display_name=member_view.display_name,
                    status=member.status,
                )
            )

    personal_ids = {contribution.id for contribution in detail.contributions}
    feedback = [
        ReviewFeedbackView(
            contribution_id=review.contribution_id,
            contribution_version=review.contribution_version,
            review_version=review.review_version,
            grade=review.grade.value,
            explanation=review.explanation,
            status=review.status.value,
        )
        for review in reviews
        if review.contribution_id in personal_ids
    ]
    customer_view = _partner_view(aggregate.customer_id, customer) or PartnerView(
        id=aggregate.customer_id, display_name=""
    )

    return _participant_task_detail_view(
        detail,
        customer=customer_view,
        mentor=_partner_view(aggregate.nominated_mentor_id, mentor),
        support=support,
        team=team,
        feedback=feedback,
    )


@router.get("/me/tasks/{task_id}/team/{person_id}/quick-card", response_model=TeamQuickCardView)
async def participant_team_quick_card(
    task_id: UUID,
    person_id: UUID,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> TeamQuickCardView:
    card = await service.team_quick_card(authenticated.actor, task_id, person_id)
    store = request.app.state.auth_service.store
    profile = await store.participant_profile(person_id)
    persona = await store.get_persona_by_id(person_id)
    if profile is not None:
        display_name: str = profile.display_name
    elif persona is not None:
        display_name = persona.display_name
    else:
        display_name = ""
    public_profile = ConsentScope.PUBLIC_PROFILE in (await store.granted_consents(person_id))
    city = profile.city if profile is not None else ""
    university = profile.university if profile is not None else ""
    telegram = profile.telegram if profile is not None else ""
    about = profile.about if profile is not None else ""
    skills = (
        [
            QuickCardSkillView(title=skill.title, origin=skill.origin, verified=skill.verified)
            for skill in profile.skills
        ]
        if profile is not None
        else []
    )
    return TeamQuickCardView(
        person_id=card.person_id,
        task_id=card.task_id,
        assignment_status=card.assignment_status,
        contribution_status=card.contribution_status,
        availability=card.availability,
        project_role=card.project_role,
        responsibility=card.responsibility,
        display_name=display_name,
        portfolio_available=public_profile,
        profile=QuickCardProfileView(
            city=city if public_profile else None,
            university=university if public_profile else None,
            telegram=telegram if public_profile else None,
            about=about if public_profile else None,
            skills=skills if public_profile else [],
        ),
    )


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
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=128)] = None,
) -> ApplicationView:
    return _application_view(await service.apply(authenticated.actor, task_id, idempotency_key))


@router.post("/me/applications/{application_id}/withdraw", response_model=ApplicationView)
async def withdraw_application(
    application_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ApplicationView:
    return _application_view(
        await service.withdraw_application(authenticated.actor, application_id)
    )


@router.get("/customer/tasks/{task_id}/applications", response_model=list[ApplicationView])
async def task_applications(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[ApplicationView]:
    records = await service.task_applications(authenticated.actor, task_id)
    participants = await service.application_participants(records)
    return [
        _application_view(item, participants.get(item.person_id, (None, 0))) for item in records
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
        authenticated.actor,
        task_id,
        CheckpointRecord(
            command.key,
            command.title,
            "planned",
            command.description,
            command.deliverable,
            tuple(command.acceptance_criteria),
            command.estimated_minutes,
        ),
    )
    return CheckpointView(
        key=item.key,
        title=item.title,
        status=item.status,
        description=item.description,
        deliverable=item.deliverable,
        acceptance_criteria=list(item.acceptance_criteria),
        estimated_minutes=item.estimated_minutes,
    )


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


@router.post(
    "/customer/contributions/{contribution_id}/credential",
    response_model=ProjectCredentialView,
)
async def sign_project_credential(
    contribution_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    request: Request,
) -> ProjectCredentialView:
    service: ProjectCredentialService = request.app.state.project_credential_service
    document = await service.sign_project_credential(authenticated.actor, contribution_id)
    return _project_credential_view(document)


@router.get("/me/project-credentials", response_model=list[ProjectCredentialView])
async def my_project_credentials(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    request: Request,
) -> list[ProjectCredentialView]:
    service: ProjectCredentialService = request.app.state.project_credential_service
    documents = await service.portfolio_credentials(authenticated.actor)
    return [_project_credential_view(item) for item in documents]


@router.get("/project-credentials/{verification_id}", response_model=ProjectCredentialView)
async def verify_project_credential(
    verification_id: str,
    request: Request,
) -> ProjectCredentialView:
    service: ProjectCredentialService = request.app.state.project_credential_service
    document = await service.store.credential_by_verification(verification_id)
    if document is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    consents = await request.app.state.auth_service.store.granted_consents(document.person_id)
    if ConsentScope.PUBLIC_PROFILE not in consents:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    return _project_credential_view(document)


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


# Files are private PostgreSQL evidence, not browser-local object URLs. The
# server always validates assignment ownership and the published checkpoint.
_MAX_CHECKPOINT_FILE = 5 * 1024 * 1024
_ALLOWED_CHECKPOINT_FILES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
}


class CheckpointFilePayload(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str = Field(min_length=1, max_length=80)
    base64_data: str = Field(min_length=1, max_length=7_100_000)


class CheckpointSubmissionPayload(BaseModel):
    summary: str = Field(min_length=20, max_length=1500)
    artifact_key: str = Field(min_length=1, max_length=128)
    file_ids: list[UUID] = Field(default_factory=list, max_length=5)
    external_url: AnyHttpUrl | None = None


async def _owned_checkpoint(
    service: WorkService, person_id: UUID, assignment_id: UUID, checkpoint_key: str
) -> tuple[AssignmentRecord, CheckpointRecord]:
    assignment = await service.store.assignment(assignment_id)
    if assignment is None or assignment.person_id != person_id:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Этап не найден.", status_code=404)
    stage = next(
        (
            item
            for item in await service.store.checkpoints(assignment.task_id)
            if item.key == checkpoint_key
        ),
        None,
    )
    if stage is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Этап не найден.", status_code=404)
    return assignment, stage


@router.post("/me/assignments/{assignment_id}/checkpoints/{checkpoint_key}/files")
async def upload_checkpoint_file(
    request: Request,
    assignment_id: UUID,
    checkpoint_key: str,
    command: CheckpointFilePayload,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> dict[str, str | int]:
    if authenticated.actor.active_role is not Role.PARTICIPANT:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Этап не найден.", status_code=404)
    assignment, _ = await _owned_checkpoint(
        service, authenticated.actor.person_id, assignment_id, checkpoint_key
    )
    if assignment.status is not AssignmentStatus.IN_PROGRESS:
        raise ApiError(
            code="ASSIGNMENT_NOT_IN_PROGRESS",
            message="Загрузка доступна только для проекта в работе.",
            status_code=409,
        )
    if command.content_type not in _ALLOWED_CHECKPOINT_FILES:
        raise ApiError(
            code="UNSUPPORTED_EVIDENCE_FILE",
            message="Допустимы PDF, PNG, JPG, TXT и ZIP.",
            status_code=422,
        )
    try:
        data = base64.b64decode(command.base64_data, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ApiError(
            code="INVALID_EVIDENCE_FILE", message="Файл повреждён.", status_code=422
        ) from exc
    if not data or len(data) > _MAX_CHECKPOINT_FILE:
        raise ApiError(
            code="EVIDENCE_FILE_SIZE",
            message="Размер файла должен быть от 1 байта до 5 МБ.",
            status_code=422,
        )
    filename = command.filename.replace("\\", "/").split("/")[-1].strip()
    if not filename or any(ord(char) < 32 for char in filename):
        raise ApiError(
            code="INVALID_EVIDENCE_FILENAME", message="Недопустимое имя.", status_code=422
        )
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    expected_types = {
        ".pdf": {"application/pdf"},
        ".png": {"image/png"},
        ".jpg": {"image/jpeg"},
        ".jpeg": {"image/jpeg"},
        ".txt": {"text/plain"},
        ".zip": {"application/zip", "application/x-zip-compressed"},
    }
    if command.content_type not in expected_types.get(extension, set()):
        raise ApiError(
            code="EVIDENCE_TYPE_MISMATCH",
            message="Расширение файла не соответствует его формату.",
            status_code=422,
        )
    magic = {
        ".pdf": data.startswith(b"%PDF-"),
        ".png": data.startswith(b"\\x89PNG\\r\\n\\x1a\\n"),
        ".jpg": data.startswith(b"\\xff\\xd8\\xff"),
        ".jpeg": data.startswith(b"\\xff\\xd8\\xff"),
        ".zip": data.startswith((b"PK\\x03\\x04", b"PK\\x05\\x06")),
    }
    if not magic.get(extension, True):
        raise ApiError(
            code="EVIDENCE_CONTENT_MISMATCH",
            message="Содержимое файла не соответствует заявленному формату.",
            status_code=422,
        )
    file_id = uuid4()
    async with request.app.state.database.session() as session:
        # Lock the assignment to serialize parallel uploads and enforce a
        # server-side quota, not only a limit in the browser.
        await session.execute(
            text("SELECT id FROM assignments WHERE id = :id FOR UPDATE"),
            {"id": assignment_id},
        )
        pending = await session.scalar(
            text(
                "SELECT COUNT(*) FROM checkpoint_evidence_files "
                "WHERE assignment_id = :assignment AND person_id = :person "
                "AND checkpoint_key = :checkpoint AND contribution_id IS NULL"
            ),
            {
                "assignment": assignment_id,
                "person": authenticated.actor.person_id,
                "checkpoint": checkpoint_key,
            },
        )
        if int(pending or 0) >= 5:
            raise ApiError(
                code="EVIDENCE_FILE_LIMIT",
                message="Для одного этапа разрешено до 5 неподанных файлов.",
                status_code=409,
            )
        await session.execute(
            text(
                "INSERT INTO checkpoint_evidence_files "
                "(id, assignment_id, person_id, checkpoint_key, filename, "
                "content_type, size_bytes, data) "
                "VALUES (:id, :assignment, :person, :checkpoint, :filename, "
                ":content_type, :size_bytes, :data)"
            ),
            {
                "id": file_id,
                "assignment": assignment_id,
                "person": authenticated.actor.person_id,
                "checkpoint": checkpoint_key,
                "filename": filename,
                "content_type": command.content_type,
                "size_bytes": len(data),
                "data": data,
            },
        )
    return {"id": str(file_id), "filename": filename, "size_bytes": len(data)}


@router.get("/checkpoint-evidence-files/{file_id}", name="download_checkpoint_evidence")
async def download_checkpoint_evidence(
    request: Request,
    file_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> Response:
    async with request.app.state.database.sessions() as session:
        record = (
            (
                await session.execute(
                    text(
                        "SELECT assignment_id, filename, content_type, data "
                        "FROM checkpoint_evidence_files WHERE id = :id"
                    ),
                    {"id": file_id},
                )
            )
            .mappings()
            .one_or_none()
        )
    if record is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Файл не найден.", status_code=404)
    assignment = await service.store.assignment(record["assignment_id"])
    if assignment is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Файл не найден.", status_code=404)
    task = await service.store.get(assignment.task_id)
    if task is None or authenticated.actor.person_id not in (
        assignment.person_id,
        task.aggregate.customer_id,
    ):
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Файл не найден.", status_code=404)
    return Response(
        content=bytes(record["data"]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="evidence-{file_id!s}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/me/assignments/{assignment_id}/checkpoint-submissions")
async def list_checkpoint_submissions(
    request: Request,
    assignment_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[dict[str, object]]:
    assignment = await service.store.assignment(assignment_id)
    if assignment is None or assignment.person_id != authenticated.actor.person_id:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Проект не найден.", status_code=404)
    async with request.app.state.database.sessions() as session:
        rows = (
            (
                await session.execute(
                    text(
                        "SELECT contribution_id, checkpoint_key, submitted_at "
                        "FROM checkpoint_submissions WHERE assignment_id = :assignment "
                        "ORDER BY submitted_at DESC"
                    ),
                    {"assignment": assignment_id},
                )
            )
            .mappings()
            .all()
        )
        attached = (
            (
                await session.execute(
                    text(
                        "SELECT id, contribution_id, filename, size_bytes "
                        "FROM checkpoint_evidence_files "
                        "WHERE assignment_id = :assignment AND contribution_id IS NOT NULL"
                    ),
                    {"assignment": assignment_id},
                )
            )
            .mappings()
            .all()
        )
    files_by_contribution: dict[UUID, list[dict[str, object]]] = {}
    for file in attached:
        files_by_contribution.setdefault(file["contribution_id"], []).append(
            {
                "id": str(file["id"]),
                "filename": file["filename"],
                "size_bytes": file["size_bytes"],
                "download_url": str(
                    request.url_for("download_checkpoint_evidence", file_id=file["id"])
                ),
            }
        )
    contributions = await service.store.contributions_for_assignment(assignment_id)
    by_id = {entry.id: entry for entry in contributions}
    return [
        {
            "checkpoint_key": row["checkpoint_key"],
            "contribution_id": str(row["contribution_id"]),
            "version": by_id[row["contribution_id"]].version,
            "status": by_id[row["contribution_id"]].status.value,
            "files": files_by_contribution.get(row["contribution_id"], []),
        }
        for row in rows
        if row["contribution_id"] in by_id
    ]


@router.post("/me/assignments/{assignment_id}/checkpoints/{checkpoint_key}/submit")
async def submit_checkpoint_solution(
    request: Request,
    assignment_id: UUID,
    checkpoint_key: str,
    command: CheckpointSubmissionPayload,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> ContributionView:
    if authenticated.actor.active_role is not Role.PARTICIPANT:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Этап не найден.", status_code=404)
    assignment, checkpoint = await _owned_checkpoint(
        service, authenticated.actor.person_id, assignment_id, checkpoint_key
    )
    if not command.file_ids and command.external_url is None:
        raise ApiError(
            code="EVIDENCE_REQUIRED",
            message="Приложите файл или ссылку на проверяемый результат.",
            status_code=422,
        )
    file_ids = tuple(dict.fromkeys(command.file_ids))
    async with request.app.state.database.sessions() as session:
        for file_id in file_ids:
            row = (
                await session.execute(
                    text(
                        "SELECT id FROM checkpoint_evidence_files "
                        "WHERE id = :id AND assignment_id = :assignment "
                        "AND person_id = :person AND checkpoint_key = :checkpoint "
                        "AND contribution_id IS NULL"
                    ),
                    {
                        "id": file_id,
                        "assignment": assignment_id,
                        "person": authenticated.actor.person_id,
                        "checkpoint": checkpoint_key,
                    },
                )
            ).first()
            if row is None:
                raise ApiError(
                    code="EVIDENCE_NOT_AVAILABLE",
                    message="Один из файлов недоступен для этого этапа.",
                    status_code=409,
                )
    primary_url = (
        str(command.external_url)
        if command.external_url is not None
        else str(request.url_for("download_checkpoint_evidence", file_id=file_ids[0]))
    )
    contribution = await service.submit_contribution(
        authenticated.actor,
        assignment.id,
        f"Чекпоинт «{checkpoint.title}»: {command.summary}",
        (TeamArtifactRecord(command.artifact_key, primary_url),),
    )
    async with request.app.state.database.session() as session:
        await session.execute(
            text(
                "INSERT INTO checkpoint_submissions "
                "(contribution_id, assignment_id, checkpoint_key) "
                "VALUES (:contribution, :assignment, :checkpoint)"
            ),
            {
                "contribution": contribution.id,
                "assignment": assignment_id,
                "checkpoint": checkpoint_key,
            },
        )
        for file_id in file_ids:
            await session.execute(
                text(
                    "UPDATE checkpoint_evidence_files SET contribution_id = :contribution "
                    "WHERE id = :id AND assignment_id = :assignment "
                    "AND contribution_id IS NULL"
                ),
                {
                    "contribution": contribution.id,
                    "id": file_id,
                    "assignment": assignment_id,
                },
            )
    return _contribution_view(contribution)
