"""Unified operator case queue API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.operations import CaseDecision, OperationsCase, OperationsService

router = APIRouter()


class CaseView(BaseModel):
    id: UUID
    case_type: str
    title: str
    priority: str
    status: str
    version: int
    source_refs: list[str]
    dependency_refs: list[str]
    due_at: str | None


class DecisionView(BaseModel):
    id: UUID
    case_version: int
    outcome: str
    reason: str
    created_at: str


class DecisionCommand(BaseModel):
    expected_version: int = Field(ge=1)
    outcome: str = Field(min_length=1, max_length=64)
    reason: str = Field(min_length=1, max_length=1000)


def _service(request: Request) -> OperationsService:
    return request.app.state.operations_service


def _view(item: OperationsCase) -> CaseView:
    return CaseView(
        id=item.id,
        case_type=item.case_type,
        title=item.title,
        priority=item.priority,
        status=item.status.value,
        version=item.version,
        source_refs=list(item.source_refs),
        dependency_refs=list(item.dependency_refs),
        due_at=item.due_at.isoformat() if item.due_at else None,
    )


def _decision(item: CaseDecision) -> DecisionView:
    return DecisionView(
        id=item.id,
        case_version=item.case_version,
        outcome=item.outcome,
        reason=item.reason,
        created_at=item.created_at.isoformat(),
    )


@router.get("/ops/cases", response_model=list[CaseView])
async def cases(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[OperationsService, Depends(_service)],
) -> list[CaseView]:
    return [_view(item) for item in await service.cases(authenticated.actor)]


@router.get("/ops/cases/{case_id}/timeline", response_model=list[DecisionView])
async def timeline(
    case_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[OperationsService, Depends(_service)],
) -> list[DecisionView]:
    return [_decision(item) for item in await service.timeline(authenticated.actor, case_id)]


@router.post("/ops/cases/{case_id}/decide", response_model=CaseView)
async def decide(
    case_id: UUID,
    command: DecisionCommand,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[OperationsService, Depends(_service)],
) -> CaseView:
    return _view(
        await service.decide(
            authenticated.actor, case_id, command.expected_version, command.outcome, command.reason
        )
    )
