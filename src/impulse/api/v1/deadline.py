"""Versioned deadline-change discussion API for assigned project work."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.deadline import DeadlineChangeRequest, DeadlineChangeService
from impulse.application.identity import AuthenticatedSession

router = APIRouter()


class DeadlineChangeProposal(BaseModel):
    proposed_deadline_at: AwareDatetime
    reason: str = Field(min_length=1, max_length=1000)
    impact: str = Field(default="", max_length=1000)
    base_terms_version: int = Field(ge=1)


class DeadlineChangeDecision(BaseModel):
    approve: bool
    comment: str | None = Field(default=None, max_length=1000)


class DeadlineChangeView(BaseModel):
    id: UUID
    task_id: UUID
    requested_by: UUID
    addressee_id: UUID
    base_terms_version: int
    proposed_deadline_at: AwareDatetime
    reason: str
    impact: str
    status: str
    decision_comment: str | None
    decided_at: AwareDatetime | None
    created_at: AwareDatetime | None


def _service(request: Request) -> DeadlineChangeService:
    return request.app.state.deadline_service


def _view(item: DeadlineChangeRequest) -> DeadlineChangeView:
    return DeadlineChangeView(
        id=item.id,
        task_id=item.task_id,
        requested_by=item.requested_by,
        addressee_id=item.addressee_id,
        base_terms_version=item.base_terms_version,
        proposed_deadline_at=item.proposed_deadline_at,
        reason=item.reason,
        impact=item.impact,
        status=item.status.value,
        decision_comment=item.decision_comment,
        decided_at=item.decided_at,
        created_at=item.created_at,
    )


@router.post(
    "/me/assignments/{assignment_id}/deadline-requests",
    response_model=DeadlineChangeView,
    status_code=201,
)
async def propose_deadline_change(
    assignment_id: UUID,
    command: DeadlineChangeProposal,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DeadlineChangeService, Depends(_service)],
) -> DeadlineChangeView:
    return _view(
        await service.propose(
            authenticated.actor,
            assignment_id,
            proposed_deadline_at=command.proposed_deadline_at,
            reason=command.reason,
            impact=command.impact,
            base_terms_version=command.base_terms_version,
        )
    )


@router.get(
    "/me/assignments/{assignment_id}/deadline-requests",
    response_model=list[DeadlineChangeView],
)
async def my_deadline_requests(
    assignment_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DeadlineChangeService, Depends(_service)],
) -> list[DeadlineChangeView]:
    return [
        _view(item)
        for item in await service.assignment_requests(authenticated.actor, assignment_id)
    ]


@router.post("/customer/deadline-requests/{request_id}/decision", response_model=DeadlineChangeView)
async def decide_deadline_change(
    request_id: UUID,
    command: DeadlineChangeDecision,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DeadlineChangeService, Depends(_service)],
) -> DeadlineChangeView:
    return _view(
        await service.decide(
            authenticated.actor,
            request_id,
            approve=command.approve,
            comment=command.comment,
        )
    )


@router.get("/customer/tasks/{task_id}/deadline-requests", response_model=list[DeadlineChangeView])
async def customer_deadline_requests(
    task_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DeadlineChangeService, Depends(_service)],
) -> list[DeadlineChangeView]:
    return [_view(item) for item in await service.task_requests(authenticated.actor, task_id)]
