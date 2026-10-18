"""Per-person notification center API: list, mark read, read all."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.notifications import NotificationFeedService
from impulse.domain.notifications import Notification

router = APIRouter()


class NotificationView(BaseModel):
    id: UUID
    kind: str
    title: str
    body: str
    entity_type: str | None
    entity_id: UUID | None
    read: bool
    created_at: str


class NotificationList(BaseModel):
    items: list[NotificationView]
    unread: int


class ReadAllResult(BaseModel):
    cleared: int


def _service(request: Request) -> NotificationFeedService:
    return request.app.state.notifications_service


def _view(item: Notification) -> NotificationView:
    return NotificationView(
        id=item.id,
        kind=item.kind.value,
        title=item.title,
        body=item.body,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        read=item.read,
        created_at=item.created_at.isoformat(),
    )


@router.get("/me/notifications", response_model=NotificationList)
async def notifications(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[NotificationFeedService, Depends(_service)],
) -> NotificationList:
    items = await service.list(authenticated.actor)
    return NotificationList(
        items=[_view(item) for item in items],
        unread=await service.unread(authenticated.actor),
    )


@router.post("/me/notifications/read-all", response_model=ReadAllResult)
async def read_all(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[NotificationFeedService, Depends(_service)],
) -> ReadAllResult:
    return ReadAllResult(cleared=await service.mark_all_read(authenticated.actor))


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationView)
async def read_notification(
    notification_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[NotificationFeedService, Depends(_service)],
) -> NotificationView:
    item = await service.mark_read(authenticated.actor, notification_id)
    return _view(item)
