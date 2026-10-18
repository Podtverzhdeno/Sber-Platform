"""Messaging bounded context: channels, memberships, messages and read cursors."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.work import WorkStore
from impulse.domain.identity import ActorContext
from impulse.domain.work import (
    AssignmentStatus,
    ContributionStatus,
    SupportAssignment,
    SupportMode,
    TaskStatus,
)


class ChannelKind(StrEnum):
    PERSONAL = "personal"
    TASK_TEAM = "task_team"
    CUSTOMER = "customer"
    OPERATOR_CASE = "operator_case"


class MemberRole(StrEnum):
    CUSTOMER = "customer"
    MENTOR = "mentor"
    MEMBER = "member"
    SUPPORT = "support"


class MessageKind(StrEnum):
    TEXT = "text"
    SYSTEM = "system"


class ChannelStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"


MAX_MESSAGE_BODY = 4000
MAX_ARTIFACT_REFS = 6
MAX_ARTIFACT_REF_LENGTH = 96
ACTIVE_ASSIGNMENT_STATUSES = frozenset(AssignmentStatus) - {AssignmentStatus.CLOSED}


@dataclass(frozen=True, slots=True)
class Channel:
    id: UUID
    kind: ChannelKind
    context_key: str
    title: str
    task_id: UUID | None
    status: ChannelStatus
    created_at: datetime


@dataclass(frozen=True, slots=True)
class Membership:
    channel_id: UUID
    person_id: UUID
    role: MemberRole
    muted: bool
    sender_enabled: bool
    created_at: datetime


@dataclass(frozen=True, slots=True)
class Message:
    id: UUID
    channel_id: UUID
    author_id: UUID | None
    kind: MessageKind
    body: str
    artifact_refs: tuple[str, ...]
    sequence: int
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ReadCursor:
    channel_id: UUID
    person_id: UUID
    last_sequence: int


@dataclass(frozen=True, slots=True)
class MessageSearchHit:
    """Message search result without exposing channels outside membership."""

    channel_id: UUID
    message_id: UUID
    channel_title: str | None
    sequence: int
    body: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ChannelSummary:
    channel: Channel
    membership: Membership
    unread: int
    last_message: Message | None


@dataclass(frozen=True, slots=True)
class TaskChannelContext:
    """Snapshot of a work task group that is mirrored into messaging."""

    task_id: UUID
    title: str
    customer_id: UUID | None
    mentor_ids: tuple[UUID, ...] = ()
    member_ids: tuple[UUID, ...] = ()


@dataclass(frozen=True, slots=True)
class ChannelWorkContext:
    """Domain context for a task-linked channel shown in the messenger."""

    project_key: str
    task_title: str
    deadline_at: datetime | None
    contribution_version: int | None
    contribution_accepted: bool | None
    review_status: str | None


class TaskChannelSource(Protocol):
    """Supplies task-group context snapshots for channel provisioning."""

    async def channels_for(self, person_id: UUID) -> tuple[TaskChannelContext, ...]: ...
    async def can_send(self, person_id: UUID, task_id: UUID) -> bool: ...
    async def work_context(self, task_id: UUID) -> ChannelWorkContext | None: ...


class ReviewStoreLite(Protocol):
    async def current_reviews(self) -> tuple: ...


class MessagingStore(Protocol):
    async def channel_by_id(self, channel_id: UUID) -> Channel | None: ...
    async def channel_by_context(self, kind: ChannelKind, context_key: str) -> Channel | None: ...
    async def ensure_channel(
        self,
        kind: ChannelKind,
        context_key: str,
        *,
        title: str = "",
        task_id: UUID | None = None,
    ) -> Channel: ...
    async def channel_peers(self, channel_id: UUID) -> tuple[Membership, ...]: ...
    async def membership(self, channel_id: UUID, person_id: UUID) -> Membership | None: ...
    async def membership_channels(
        self, person_id: UUID
    ) -> tuple[tuple[Channel, Membership], ...]: ...
    async def upsert_membership(
        self,
        channel_id: UUID,
        person_id: UUID,
        role: MemberRole,
        *,
        sender_enabled: bool,
    ) -> Membership: ...
    async def save_membership(
        self,
        channel_id: UUID,
        person_id: UUID,
        *,
        role: MemberRole,
        muted: bool,
        sender_enabled: bool,
    ) -> Membership: ...
    async def message(self, channel_id: UUID, message_id: UUID) -> Message | None: ...
    async def messages(
        self, channel_id: UUID, *, limit: int, before_sequence: int | None
    ) -> tuple[Message, ...]: ...
    async def last_message(self, channel_id: UUID) -> Message | None: ...
    async def append_message(self, message: Message) -> Message: ...
    async def unread_counts(self, person_id: UUID) -> Mapping[UUID, int]: ...
    async def cursor(self, channel_id: UUID, person_id: UUID) -> ReadCursor | None: ...
    async def save_cursor(self, cursor: ReadCursor) -> None: ...
    async def peer_person_ids(self, person_id: UUID) -> tuple[UUID, ...]: ...
    async def search_messages(
        self, person_id: UUID, query: str, *, limit: int
    ) -> tuple[MessageSearchHit, ...]: ...


class MemoryMessagingStore:
    """Deterministic in-memory adapter for tests and DB-less demo runs."""

    def __init__(self) -> None:
        self._channels: dict[UUID, Channel] = {}
        self._memberships: dict[tuple[UUID, UUID], Membership] = {}
        self._messages: dict[UUID, list[Message]] = {}
        self._cursors: dict[tuple[UUID, UUID], ReadCursor] = {}

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    async def channel_by_id(self, channel_id: UUID) -> Channel | None:
        return self._channels.get(channel_id)

    async def channel_by_context(self, kind: ChannelKind, context_key: str) -> Channel | None:
        for channel in self._channels.values():
            if channel.kind is kind and channel.context_key == context_key:
                return channel
        return None

    async def ensure_channel(
        self,
        kind: ChannelKind,
        context_key: str,
        *,
        title: str = "",
        task_id: UUID | None = None,
    ) -> Channel:
        existing = await self.channel_by_context(kind, context_key)
        if existing is not None:
            return existing
        channel = Channel(
            uuid4(), kind, context_key, title, task_id, ChannelStatus.ACTIVE, self._now()
        )
        self._channels[channel.id] = channel
        return channel

    async def channel_peers(self, channel_id: UUID) -> tuple[Membership, ...]:
        return tuple(
            membership
            for (item_channel, _person_id), membership in self._memberships.items()
            if item_channel == channel_id
        )

    async def membership(self, channel_id: UUID, person_id: UUID) -> Membership | None:
        return self._memberships.get((channel_id, person_id))

    async def membership_channels(self, person_id: UUID) -> tuple[tuple[Channel, Membership], ...]:
        pairs: list[tuple[Channel, Membership]] = []
        for (channel_id, candidate), membership in self._memberships.items():
            if candidate == person_id:
                channel = self._channels.get(channel_id)
                if channel is not None:
                    pairs.append((channel, membership))
        pairs.sort(key=lambda pair: (pair[0].created_at, pair[0].id))
        return tuple(pairs)

    async def upsert_membership(
        self,
        channel_id: UUID,
        person_id: UUID,
        role: MemberRole,
        *,
        sender_enabled: bool,
    ) -> Membership:
        existing = self._memberships.get((channel_id, person_id))
        muted = existing.muted if existing is not None else False
        return await self.save_membership(
            channel_id,
            person_id,
            role=role,
            muted=muted,
            sender_enabled=sender_enabled,
        )

    async def save_membership(
        self,
        channel_id: UUID,
        person_id: UUID,
        *,
        role: MemberRole,
        muted: bool,
        sender_enabled: bool,
    ) -> Membership:
        existing = self._memberships.get((channel_id, person_id))
        membership = Membership(
            channel_id,
            person_id,
            role,
            muted,
            sender_enabled,
            existing.created_at if existing is not None else self._now(),
        )
        self._memberships[(channel_id, person_id)] = membership
        return membership

    async def message(self, channel_id: UUID, message_id: UUID) -> Message | None:
        for message in self._messages.get(channel_id, ()):
            if message.id == message_id:
                return message
        return None

    async def messages(
        self, channel_id: UUID, *, limit: int, before_sequence: int | None
    ) -> tuple[Message, ...]:
        items = [
            message
            for message in self._messages.get(channel_id, ())
            if before_sequence is None or message.sequence < before_sequence
        ]
        items.sort(key=lambda message: message.sequence, reverse=True)
        return tuple(reversed(items[:limit]))

    async def last_message(self, channel_id: UUID) -> Message | None:
        items = self._messages.get(channel_id)
        return items[-1] if items else None

    async def append_message(self, message: Message) -> Message:
        items = self._messages.setdefault(message.channel_id, [])
        stored = replace(message, sequence=len(items) + 1, created_at=self._now())
        items.append(stored)
        return stored

    async def unread_counts(self, person_id: UUID) -> Mapping[UUID, int]:
        counts: dict[UUID, int] = {}
        for (channel_id, candidate), _membership in self._memberships.items():
            if candidate != person_id:
                continue
            cursor = self._cursors.get((channel_id, person_id))
            after = cursor.last_sequence if cursor is not None else 0
            counts[channel_id] = sum(
                1
                for message in self._messages.get(channel_id, ())
                if message.sequence > after
                and message.author_id != person_id
                and message.kind is MessageKind.TEXT
            )
        return counts

    async def cursor(self, channel_id: UUID, person_id: UUID) -> ReadCursor | None:
        return self._cursors.get((channel_id, person_id))

    async def save_cursor(self, cursor: ReadCursor) -> None:
        self._cursors[(cursor.channel_id, cursor.person_id)] = cursor

    async def peer_person_ids(self, person_id: UUID) -> tuple[UUID, ...]:
        peer_ids: set[UUID] = set()
        for (channel_id, candidate), _membership in self._memberships.items():
            if candidate != person_id:
                continue
            for peer_channel, peer_person_id in self._memberships:
                if peer_channel == channel_id and peer_person_id != person_id:
                    peer_ids.add(peer_person_id)
        return tuple(sorted(peer_ids, key=str))

    async def search_messages(
        self, person_id: UUID, query: str, *, limit: int
    ) -> tuple[MessageSearchHit, ...]:
        prepared = query.casefold()
        hits: list[MessageSearchHit] = []
        for channel_id, messages in self._messages.items():
            membership = self._memberships.get((channel_id, person_id))
            channel = self._channels.get(channel_id)
            if membership is None or channel is None or channel.status is ChannelStatus.CLOSED:
                continue
            channel_title = channel.title or None
            for message in reversed(messages):
                if len(hits) >= limit:
                    break
                if prepared in message.body.casefold():
                    hits.append(
                        MessageSearchHit(
                            channel.id,
                            message.id,
                            channel_title,
                            message.sequence,
                            message.body,
                            message.created_at,
                        )
                    )
        return tuple(hits)


class WorkTaskChannelSource:
    """Mirrors work-context task groups into messaging; keeps delivery decoupled."""

    def __init__(self, store: WorkStore, reviews: ReviewStoreLite | None = None) -> None:
        self.store = store
        self.reviews = reviews

    @staticmethod
    def _status_text(value: object) -> str | None:
        if value is None:
            return None
        text = getattr(value, "value", value)
        return str(text)

    async def work_context(self, task_id: UUID) -> ChannelWorkContext | None:
        task = await self.store.get(task_id)
        if task is None:
            return None
        terms = await self.store.latest_terms(task_id)
        active = tuple(
            assignment
            for assignment in await self.store.assignments_for_task(task_id)
            if assignment.status in ACTIVE_ASSIGNMENT_STATUSES
        )
        contribution_version: int | None = None
        contribution_accepted: bool | None = None
        contribution_id: UUID | None = None
        if active:
            contributions = await self.store.contributions_for_assignment(active[0].id)
            if contributions:
                latest = max(contributions, key=lambda item: item.version)
                contribution_id = latest.id
                contribution_version = latest.version
                contribution_accepted = latest.status is ContributionStatus.ACCEPTED
        review_status: str | None = None
        if self.reviews is not None:
            for review in await self.reviews.current_reviews():
                if review.contribution_id == contribution_id:
                    review_status = self._status_text(review.status)
                    break
        return ChannelWorkContext(
            project_key=task.project_key,
            task_title=task.title,
            deadline_at=terms.deadline_at if terms is not None else None,
            contribution_version=contribution_version,
            contribution_accepted=contribution_accepted,
            review_status=review_status,
        )

    @staticmethod
    def _mentor_ids_for(
        task_support: SupportAssignment | None, nominated: UUID | None
    ) -> tuple[UUID, ...]:
        mentor_ids: list[UUID] = []
        if nominated is not None:
            mentor_ids.append(nominated)
        if task_support is not None and task_support.mode is SupportMode.MENTOR:
            if task_support.assignee_id is not None:
                mentor_ids.append(task_support.assignee_id)
        return tuple(dict.fromkeys(mentor_ids))

    async def _context(self, task_id: UUID) -> TaskChannelContext | None:
        task = await self.store.get(task_id)
        if task is None or task.aggregate.status is TaskStatus.DRAFT:
            return None
        assignments = tuple(
            assignment
            for assignment in await self.store.assignments_for_task(task_id)
            if assignment.status in ACTIVE_ASSIGNMENT_STATUSES
        )
        return TaskChannelContext(
            task.aggregate.task_id,
            task.title,
            task.aggregate.customer_id,
            self._mentor_ids_for(task.aggregate.support, task.aggregate.nominated_mentor_id),
            tuple(dict.fromkeys(assignment.person_id for assignment in assignments)),
        )

    async def channels_for(self, person_id: UUID) -> tuple[TaskChannelContext, ...]:
        contexts: dict[UUID, TaskChannelContext] = {}
        for assignment in await self.store.assignments_for_person(person_id):
            if assignment.status not in ACTIVE_ASSIGNMENT_STATUSES:
                continue
            if assignment.task_id not in contexts:
                context = await self._context(assignment.task_id)
                if context is not None:
                    contexts[assignment.task_id] = context
        for task in await self.store.published_tasks():
            task_id = task.aggregate.task_id
            if task_id in contexts:
                continue
            owns_task = task.aggregate.customer_id == person_id
            supports_task = any(
                mentor_id == person_id
                for mentor_id in self._mentor_ids_for(
                    task.aggregate.support, task.aggregate.nominated_mentor_id
                )
            )
            if owns_task or supports_task:
                context = await self._context(task_id)
                if context is not None:
                    contexts[task_id] = context
        return tuple(contexts.values())

    async def can_send(self, person_id: UUID, task_id: UUID) -> bool:
        task = await self.store.get(task_id)
        if task is None:
            return False
        if task.aggregate.customer_id == person_id:
            return True
        if any(
            mentor_id == person_id
            for mentor_id in self._mentor_ids_for(
                task.aggregate.support, task.aggregate.nominated_mentor_id
            )
        ):
            return True
        return any(
            assignment.task_id == task_id and assignment.status in ACTIVE_ASSIGNMENT_STATUSES
            for assignment in await self.store.assignments_for_person(person_id)
        )


class MessagingService:
    """Object-level messaging access: visibility, history, sending, read state."""

    SYSTEM_CHANNEL_NOTE = "Чат команды создан. История и контекст задачи общие для участников."

    def __init__(
        self, store: MessagingStore, task_channels: TaskChannelSource | None = None
    ) -> None:
        self.store = store
        self.task_channels = task_channels

    async def sync_task_channels(self, actor_context: ActorContext) -> None:
        if self.task_channels is None:
            return
        for context in await self.task_channels.channels_for(actor_context.person_id):
            await self._sync_task_channel(context)

    async def _sync_task_channel(self, context: TaskChannelContext) -> Channel:
        channel = await self.store.ensure_channel(
            ChannelKind.TASK_TEAM,
            f"task:{context.task_id}",
            title=context.title,
            task_id=context.task_id,
        )
        if await self.store.last_message(channel.id) is None:
            await self.store.append_message(
                Message(
                    uuid4(),
                    channel.id,
                    None,
                    MessageKind.SYSTEM,
                    self.SYSTEM_CHANNEL_NOTE,
                    (),
                    0,
                    datetime.now(UTC),
                )
            )
        desired: dict[UUID, MemberRole] = {}
        if context.customer_id is not None:
            desired[context.customer_id] = MemberRole.CUSTOMER
        for mentor_id in context.mentor_ids:
            desired.setdefault(mentor_id, MemberRole.MENTOR)
        for member_id in context.member_ids:
            desired.setdefault(member_id, MemberRole.MEMBER)
        current = {
            membership.person_id: membership
            for membership in await self.store.channel_peers(channel.id)
        }
        for person_id, role in desired.items():
            existing = current.get(person_id)
            if existing is None or not existing.sender_enabled:
                await self.store.upsert_membership(channel.id, person_id, role, sender_enabled=True)
        for person_id, existing in current.items():
            if person_id not in desired and existing.sender_enabled:
                await self.store.upsert_membership(
                    channel.id, person_id, existing.role, sender_enabled=False
                )
        return channel

    async def channels(self, actor_context: ActorContext) -> tuple[ChannelSummary, ...]:
        await self.sync_task_channels(actor_context)
        unread = await self.store.unread_counts(actor_context.person_id)
        summaries: list[ChannelSummary] = []
        for channel, membership in await self.store.membership_channels(actor_context.person_id):
            if channel.status is ChannelStatus.CLOSED:
                continue
            summaries.append(
                ChannelSummary(
                    channel,
                    membership,
                    unread.get(channel.id, 0),
                    await self.store.last_message(channel.id),
                )
            )
        summaries.sort(key=lambda item: item.channel.created_at)
        return tuple(summaries)

    async def channel_view(
        self, actor_context: ActorContext, channel_id: UUID
    ) -> ChannelSummary | None:
        return await self._summary(actor_context, channel_id)

    async def channel_participants(
        self, actor_context: ActorContext, channel_id: UUID
    ) -> tuple[Membership, ...]:
        """Peer memberships of a channel the actor can see."""
        channel, _membership = await self._visible(actor_context, channel_id)
        return await self.store.channel_peers(channel.id)

    async def messages(
        self,
        actor_context: ActorContext,
        channel_id: UUID,
        *,
        limit: int,
        before_sequence: int | None,
    ) -> tuple[Message, ...]:
        await self._visible(actor_context, channel_id)
        return await self.store.messages(channel_id, limit=limit, before_sequence=before_sequence)

    async def open_personal_channel(self, actor_context: ActorContext, peer_id: UUID) -> Channel:
        if peer_id == actor_context.person_id:
            raise ApiError("MESSAGE_PEER_INVALID", "Cannot open a dialog with yourself.", 422)
        first, second = sorted((actor_context.person_id, peer_id), key=str)
        channel = await self.store.ensure_channel(
            ChannelKind.PERSONAL,
            f"pair:{first}:{second}",
        )
        await self.store.upsert_membership(
            channel.id, actor_context.person_id, MemberRole.MEMBER, sender_enabled=True
        )
        await self.store.upsert_membership(
            channel.id, peer_id, MemberRole.MEMBER, sender_enabled=True
        )
        return channel

    async def channel_work_context(
        self, actor_context: ActorContext, channel_id: UUID
    ) -> ChannelWorkContext | None:
        await self._visible(actor_context, channel_id)
        channel = await self.store.channel_by_id(channel_id)
        if channel is None or channel.task_id is None or self.task_channels is None:
            return None
        return await self.task_channels.work_context(channel.task_id)

    async def send(
        self,
        actor_context: ActorContext,
        channel_id: UUID,
        body: str,
        artifact_refs: tuple[str, ...] = (),
    ) -> Message:
        channel, membership = await self._visible(actor_context, channel_id)
        prepared_body = body.strip()
        if not prepared_body:
            raise ApiError("MESSAGE_BODY_REQUIRED", "Message body is required.", 422)
        if len(prepared_body) > MAX_MESSAGE_BODY:
            raise ApiError(
                "MESSAGE_BODY_TOO_LONG",
                f"Message body must not exceed {MAX_MESSAGE_BODY} characters.",
                422,
            )
        prepared_refs = tuple(dict.fromkeys(ref.strip() for ref in artifact_refs if ref.strip()))
        if len(prepared_refs) > MAX_ARTIFACT_REFS or any(
            len(ref) > MAX_ARTIFACT_REF_LENGTH for ref in prepared_refs
        ):
            raise ApiError(
                "MESSAGE_ARTIFACTS_INVALID",
                f"Up to {MAX_ARTIFACT_REFS} refs of {MAX_ARTIFACT_REF_LENGTH} characters.",
                422,
            )
        if channel.status is ChannelStatus.CLOSED:
            raise ApiError("MESSAGING_READ_ONLY", "Channel is closed for new messages.", 403)
        self._assert_sender_enabled(channel, membership)
        if channel.kind is ChannelKind.TASK_TEAM and self.task_channels is not None:
            if channel.task_id is None or not await self.task_channels.can_send(
                actor_context.person_id, channel.task_id
            ):
                raise ApiError("MESSAGING_READ_ONLY", "Task access was revoked.", 403)
        return await self.store.append_message(
            Message(
                uuid4(),
                channel_id,
                actor_context.person_id,
                MessageKind.TEXT,
                prepared_body,
                prepared_refs,
                0,
                datetime.now(UTC),
            )
        )

    async def mark_read(
        self, actor_context: ActorContext, channel_id: UUID, message_id: UUID
    ) -> None:
        await self._visible(actor_context, channel_id)
        message = await self.store.message(channel_id, message_id)
        if message is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        cursor = await self.store.cursor(channel_id, actor_context.person_id)
        if cursor is None or cursor.last_sequence < message.sequence:
            await self.store.save_cursor(
                ReadCursor(channel_id, actor_context.person_id, message.sequence)
            )

    async def set_mute(
        self, actor_context: ActorContext, channel_id: UUID, muted: bool
    ) -> Membership:
        _channel, membership = await self._visible(actor_context, channel_id)
        return await self.store.save_membership(
            channel_id,
            actor_context.person_id,
            role=membership.role,
            muted=muted,
            sender_enabled=membership.sender_enabled,
        )

    async def accessible_peers(self, actor_context: ActorContext) -> tuple[UUID, ...]:
        """People sharing at least one channel with the actor; safe for people search."""
        return await self.store.peer_person_ids(actor_context.person_id)

    async def search_messages(
        self, actor_context: ActorContext, query: str, *, limit: int
    ) -> tuple[MessageSearchHit, ...]:
        """Search message bodies only inside the actor's channels."""
        prepared = query.strip().casefold()
        if len(prepared) < 2:
            return ()
        return await self.store.search_messages(actor_context.person_id, prepared, limit=limit)

    async def _summary(
        self, actor_context: ActorContext, channel_id: UUID
    ) -> ChannelSummary | None:
        channel, membership = await self._visible(actor_context, channel_id)
        unread = (await self.store.unread_counts(actor_context.person_id)).get(channel_id, 0)
        return ChannelSummary(
            channel,
            membership,
            unread,
            await self.store.last_message(channel_id),
        )

    async def _visible(
        self, actor_context: ActorContext, channel_id: UUID
    ) -> tuple[Channel, Membership]:
        channel = await self.store.channel_by_id(channel_id)
        membership = (
            await self.store.membership(channel_id, actor_context.person_id)
            if channel is not None
            else None
        )
        if channel is None or membership is None:
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        return channel, membership

    @staticmethod
    def _assert_sender_enabled(channel: Channel, membership: Membership) -> None:
        if not membership.sender_enabled:
            raise ApiError(
                "MESSAGING_READ_ONLY",
                "Access was revoked; history stays readable but sending is disabled.",
                403,
            )
