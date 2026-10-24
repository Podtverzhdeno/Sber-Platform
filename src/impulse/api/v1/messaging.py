"""Messaging workspace API: channels, history, sending and read state."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.messaging import (
    ChannelSummary,
    Membership,
    Message,
    MessagingService,
)

router = APIRouter()

MAX_HISTORY_LIMIT = 200


class ParticipantView(BaseModel):
    id: UUID
    display_name: str
    role: str


class MessageView(BaseModel):
    id: UUID
    author_id: UUID | None
    author_name: str | None
    kind: str
    body: str
    artifact_refs: list[str]
    sequence: int
    created_at: str


class ChannelView(BaseModel):
    id: UUID
    kind: str
    title: str
    status: str
    task_id: UUID | None
    role: str
    muted: bool
    sender_enabled: bool
    unread: int
    participants: list[ParticipantView]
    last_message: MessageView | None
    created_at: str


class ChannelWorkContextView(BaseModel):
    project_key: str
    task_title: str
    deadline_at: str | None
    contribution_version: int | None
    contribution_accepted: bool | None
    review_status: str | None


class PostMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=40000)
    artifact_refs: list[str] = Field(default_factory=list, max_length=24)


class OpenPersonalRequest(BaseModel):
    peer_id: UUID


class CreateGroupRequest(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    peer_ids: list[UUID] = Field(min_length=1, max_length=24)


class ContactView(BaseModel):
    id: UUID
    display_name: str
    role: str


class ReadMessageRequest(BaseModel):
    message_id: UUID


class MuteRequest(BaseModel):
    muted: bool


def _service(request: Request) -> MessagingService:
    return request.app.state.messaging_service


async def _persona_names(
    request: Request, person_ids: tuple[UUID, ...] | list[UUID]
) -> dict[UUID, str]:
    """Resolve person ids to display names through the identity store."""
    names: dict[UUID, str] = {}
    store = request.app.state.auth_service.store
    for person_id in dict.fromkeys(person_ids):
        persona = await store.get_persona_by_id(person_id)
        names[person_id] = persona.display_name if persona is not None else ""
    return names


def _message_view(item: Message, names: Mapping[UUID, str]) -> MessageView:
    return MessageView(
        id=item.id,
        author_id=item.author_id,
        author_name=names.get(item.author_id) if item.author_id is not None else None,
        kind=item.kind.value,
        body=item.body,
        artifact_refs=list(item.artifact_refs),
        sequence=item.sequence,
        created_at=item.created_at.isoformat(),
    )


def _channel_view(
    summary: ChannelSummary,
    names: Mapping[UUID, str],
    peers: Sequence[Membership],
) -> ChannelView:
    return ChannelView(
        id=summary.channel.id,
        kind=summary.channel.kind.value,
        title=summary.channel.title,
        status=summary.channel.status.value,
        task_id=summary.channel.task_id,
        role=summary.membership.role.value,
        muted=summary.membership.muted,
        sender_enabled=summary.membership.sender_enabled,
        unread=summary.unread,
        participants=[
            ParticipantView(
                id=peer.person_id,
                display_name=names.get(peer.person_id, ""),
                role=peer.role.value,
            )
            for peer in peers
        ],
        last_message=(
            _message_view(summary.last_message, names) if summary.last_message is not None else None
        ),
        created_at=summary.channel.created_at.isoformat(),
    )


@router.get("/me/messaging/channels", response_model=list[ChannelView])
async def channels(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> list[ChannelView]:
    summaries = await service.channels(authenticated.actor)
    result: list[ChannelView] = []
    for summary in summaries:
        peers = await service.channel_participants(authenticated.actor, summary.channel.id)
        names = await _persona_names(request, [peer.person_id for peer in peers])
        result.append(_channel_view(summary, names, peers))
    return result


@router.get("/me/messaging/contacts", response_model=list[ContactView])
async def contact_directory(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> list[ContactView]:
    """The demo directory is explicit; no global enumeration of private users."""
    if not request.app.state.settings.demo_mode:
        return []
    records = await request.app.state.auth_service.store.list_personas()
    return sorted(
        [
            ContactView(id=item.person_id, display_name=item.display_name,
                        role=item.roles[0].value if item.roles else "participant")
            for item in records
            if item.person_id != authenticated.actor.person_id
            and item.program_key == "impulse-demo"
        ],
        key=lambda item: item.display_name.casefold(),
    )


@router.post("/me/messaging/channels/group", response_model=ChannelView, status_code=201)
async def create_group(
    command: CreateGroupRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> ChannelView:
    if not request.app.state.settings.demo_mode:
        raise ApiError("GROUP_CREATION_UNAVAILABLE", "Создание группы недоступно.", 403)
    allowed = {
        item.person_id
        for item in await request.app.state.auth_service.store.list_personas()
        if item.program_key == "impulse-demo"
    }
    if any(peer not in allowed for peer in command.peer_ids):
        raise ApiError("MESSAGE_GROUP_PEER_INVALID", "Участник не найден.", 422)
    channel = await service.create_group(
        authenticated.actor, command.title, tuple(command.peer_ids)
    )
    summary = await service.channel_view(authenticated.actor, channel.id)
    if summary is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    peers = await service.channel_participants(authenticated.actor, channel.id)
    names = await _persona_names(request, [peer.person_id for peer in peers])
    return _channel_view(summary, names, peers)


@router.post("/me/messaging/channels/personal", response_model=ChannelView)
async def open_personal(
    command: OpenPersonalRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> ChannelView:
    channel = await service.open_personal_channel(authenticated.actor, command.peer_id)
    summary = await service.channel_view(authenticated.actor, channel.id)
    if summary is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    peers = await service.channel_participants(authenticated.actor, channel.id)
    names = await _persona_names(request, [peer.person_id for peer in peers])
    return _channel_view(summary, names, peers)


@router.get("/me/messaging/channels/{channel_id}", response_model=ChannelView)
async def channel(
    channel_id: UUID,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> ChannelView:
    summary = await service.channel_view(authenticated.actor, channel_id)
    if summary is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    peers = await service.channel_participants(authenticated.actor, channel_id)
    names = await _persona_names(request, [peer.person_id for peer in peers])
    return _channel_view(summary, names, peers)


@router.get("/me/messaging/channels/{channel_id}/context")
async def channel_context(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[MessagingService, Depends(_service)],
    channel_id: UUID,
) -> ChannelWorkContextView | None:
    context = await service.channel_work_context(authenticated.actor, channel_id)
    if context is None:
        return None
    return ChannelWorkContextView(
        project_key=context.project_key,
        task_title=context.task_title,
        deadline_at=context.deadline_at.isoformat() if context.deadline_at is not None else None,
        contribution_version=context.contribution_version,
        contribution_accepted=context.contribution_accepted,
        review_status=context.review_status,
    )


@router.get("/me/messaging/channels/{channel_id}/messages", response_model=list[MessageView])
async def messages(
    channel_id: UUID,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[MessagingService, Depends(_service)],
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=MAX_HISTORY_LIMIT),
) -> list[MessageView]:
    items = await service.messages(
        authenticated.actor,
        channel_id,
        limit=limit,
        before_sequence=before,
    )
    names = await _persona_names(
        request, [item.author_id for item in items if item.author_id is not None]
    )
    return [_message_view(item, names) for item in items]


@router.post("/me/messaging/channels/{channel_id}/messages", response_model=MessageView)
async def post_message(
    channel_id: UUID,
    command: PostMessageRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> MessageView:
    message = await service.send(
        authenticated.actor,
        channel_id,
        command.body,
        tuple(command.artifact_refs),
    )
    names = await _persona_names(
        request, [author_id for author_id in (message.author_id,) if author_id is not None]
    )
    return _message_view(message, names)


@router.post("/me/messaging/channels/{channel_id}/read", response_model=ChannelView)
async def mark_read(
    channel_id: UUID,
    command: ReadMessageRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> ChannelView:
    await service.mark_read(authenticated.actor, channel_id, command.message_id)
    summary = await service.channel_view(authenticated.actor, channel_id)
    if summary is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    peers = await service.channel_participants(authenticated.actor, channel_id)
    names = await _persona_names(request, [peer.person_id for peer in peers])
    return _channel_view(summary, names, peers)


@router.post("/me/messaging/channels/{channel_id}/mute", response_model=ChannelView)
async def set_mute(
    channel_id: UUID,
    command: MuteRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[MessagingService, Depends(_service)],
) -> ChannelView:
    await service.set_mute(authenticated.actor, channel_id, command.muted)
    summary = await service.channel_view(authenticated.actor, channel_id)
    if summary is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    peers = await service.channel_participants(authenticated.actor, channel_id)
    names = await _persona_names(request, [peer.person_id for peer in peers])
    return _channel_view(summary, names, peers)
