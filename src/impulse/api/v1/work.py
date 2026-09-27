"""Customer R&D task drafting and operator publication API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import MarketplaceTask, TaskRecord, TermsRecord, WorkService
from impulse.domain.work import SupportAssignment, SupportMode, TaskBrief, TaskStatus

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


class SupportRequest(BaseModel):
    mode: SupportMode
    assignee_id: UUID | None = None


class ReviseTermsRequest(BaseModel):
    deadline_at: AwareDatetime
    deliverable: str = Field(min_length=1, max_length=4000)
    acceptance_criteria: list[str] = Field(min_length=1, max_length=30)


class AcceptTermsRequest(BaseModel):
    terms_version: int = Field(ge=1)


class TaskView(BaseModel):
    id: UUID
    project_key: str
    task_key: str
    title: str
    status: TaskStatus
    nominated_mentor_id: UUID | None
    support_mode: SupportMode | None
    support_assignee_id: UUID | None


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
