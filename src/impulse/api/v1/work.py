"""Customer R&D task drafting and operator publication API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import AnyHttpUrl, AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import (
    ApplicationRecord,
    AssignmentRecord,
    CheckpointRecord,
    ContributionRecord,
    MarketplaceTask,
    TaskRecord,
    TeamArtifactRecord,
    TermsRecord,
    WorkService,
)
from impulse.domain.work import (
    ApplicationStatus,
    AssignmentStatus,
    SupportAssignment,
    SupportMode,
    TaskBrief,
    TaskStatus,
)

router = APIRouter()


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


class ApplicationView(BaseModel):
    id: UUID
    task_id: UUID
    person_id: UUID
    accepted_terms_version: int
    status: ApplicationStatus
    version: int


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


class ArtifactView(BaseModel):
    key: str
    uri: str


class TermsView(BaseModel):
    version: int
    deadline_at: AwareDatetime
    deliverable: str
    acceptance_criteria: list[str]
    support_mode: str | None


class MarketplaceTaskView(BaseModel):
    task: TaskView
    terms: TermsView
    accepted_terms_version: int | None


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
    )


def _terms_view(terms: TermsRecord) -> TermsView:
    return TermsView(
        version=terms.version,
        deadline_at=terms.deadline_at,
        deliverable=terms.deliverable,
        acceptance_criteria=list(terms.acceptance_criteria),
        support_mode=terms.support_mode,
    )


def _marketplace_view(item: MarketplaceTask) -> MarketplaceTaskView:
    return MarketplaceTaskView(
        task=_view(item.task),
        terms=_terms_view(item.terms),
        accepted_terms_version=item.accepted_terms_version,
    )


@router.get("/customer/tasks", response_model=list[TaskView])
async def customer_tasks(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[WorkService, Depends(_service)],
) -> list[TaskView]:
    return [_view(item) for item in await service.customer_tasks(authenticated.actor)]


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
            places=command.places,
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
