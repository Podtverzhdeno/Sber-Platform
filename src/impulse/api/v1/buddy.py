"""Buddy conversation API with opaque, content-free SSE events."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.buddy import BuddyConversationService, BuddyMessage, BuddyThread
from impulse.application.identity import AuthenticatedSession

router = APIRouter(prefix="/agents/buddy", tags=["buddy"])


class ThreadView(BaseModel):
    id: UUID
    status: str
    messages: list[MessageView]
    content_deleted: bool


class MessageView(BaseModel):
    id: UUID
    client_message_id: str
    role: str
    content: str


class MessageRequest(BaseModel):
    client_message_id: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1, max_length=8_000)


class FeedbackRequest(BaseModel):
    rating: int = Field(ge=-1, le=1)


class FeedbackView(BaseModel):
    id: UUID
    rating: int


def _service(request: Request) -> BuddyConversationService:
    return request.app.state.buddy_service


def _thread_view(thread: BuddyThread) -> ThreadView:
    return ThreadView(
        id=thread.id,
        status=thread.status,
        messages=[_message_view(item) for item in thread.messages],
        content_deleted=thread.content_deleted,
    )


def _message_view(message: BuddyMessage) -> MessageView:
    return MessageView(
        id=message.id,
        client_message_id=message.client_message_id,
        role=message.role,
        content=message.content,
    )


@router.post("/threads", response_model=ThreadView, status_code=201)
async def create_thread(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(service.create_thread(authenticated.actor))


@router.get("/threads/{thread_id}", response_model=ThreadView)
async def get_thread(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(service.thread(authenticated.actor, thread_id))


@router.post("/threads/{thread_id}/messages", response_model=MessageView)
async def add_message(
    thread_id: UUID,
    body: MessageRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> MessageView:
    return _message_view(
        service.add_message(
            authenticated.actor,
            thread_id,
            client_message_id=body.client_message_id,
            content=body.content,
        )
    )


@router.post("/threads/{thread_id}/cancel", response_model=ThreadView)
async def cancel_thread(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(service.cancel(authenticated.actor, thread_id))


@router.post("/threads/{thread_id}/feedback", response_model=FeedbackView)
async def add_feedback(
    thread_id: UUID,
    body: FeedbackRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> FeedbackView:
    result = service.feedback(authenticated.actor, thread_id, rating=body.rating)
    return FeedbackView(id=result.id, rating=result.rating)


@router.delete("/memory", status_code=204)
async def withdraw_memory(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> None:
    service.withdraw_memory(authenticated.actor)


@router.get("/threads/{thread_id}/events", response_class=StreamingResponse)
async def thread_events(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> StreamingResponse:
    thread = service.thread(authenticated.actor, thread_id)

    async def events() -> AsyncIterator[str]:
        safe = json.dumps({"thread_id": str(thread.id), "status": thread.status})
        yield f"event: status\ndata: {safe}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
