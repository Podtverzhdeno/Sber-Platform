"""PostgreSQL adapter for messaging channels, memberships and messages."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased

from impulse.application.messaging import (
    Channel,
    ChannelKind,
    ChannelStatus,
    MemberRole,
    Membership,
    Message,
    MessageKind,
    MessageSearchHit,
    MessagingStore,
    ReadCursor,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.messaging import (
    messaging_channels,
    messaging_memberships,
    messaging_messages,
    messaging_read_cursors,
)
from impulse.infrastructure.persistence import emit_domain_event


class SqlMessagingStore(MessagingStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _channel(row: Any) -> Channel:
        return Channel(
            row.id,
            ChannelKind(row.kind),
            row.context_key,
            row.title or "",
            row.task_id,
            ChannelStatus(row.status),
            row.created_at,
        )

    @staticmethod
    def _membership(row: Any) -> Membership:
        return Membership(
            row.channel_id,
            row.person_id,
            MemberRole(row.role),
            bool(row.muted),
            bool(row.sender_enabled),
            row.created_at,
        )

    @staticmethod
    def _message(row: Any) -> Message:
        payload = dict(row.payload)
        return Message(
            row.id,
            row.channel_id,
            row.author_id,
            MessageKind(row.kind),
            row.body,
            tuple(payload.get("artifact_refs", [])),
            row.sequence,
            row.created_at,
        )

    async def channel_by_id(self, channel_id: UUID) -> Channel | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_channels).where(messaging_channels.c.id == channel_id)
                )
            ).one_or_none()
            return self._channel(row) if row is not None else None

    async def channel_by_context(self, kind: ChannelKind, context_key: str) -> Channel | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_channels).where(
                        messaging_channels.c.kind == kind.value,
                        messaging_channels.c.context_key == context_key,
                    )
                )
            ).one_or_none()
            return self._channel(row) if row is not None else None

    async def ensure_channel(
        self,
        kind: ChannelKind,
        context_key: str,
        *,
        title: str | None = None,
        task_id: UUID | None = None,
    ) -> Channel:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(messaging_channels).where(
                        messaging_channels.c.kind == kind.value,
                        messaging_channels.c.context_key == context_key,
                    )
                )
            ).one_or_none()
            if row is not None:
                return self._channel(row)
            await session.execute(
                insert(messaging_channels)
                .values(
                    id=uuid4(),
                    kind=kind.value,
                    context_key=context_key,
                    title=title or None,
                    task_id=task_id,
                    data_origin="system",
                )
                .on_conflict_do_nothing(constraint="uq_messaging_channels_kind_context_key")
            )
            row = (
                await session.execute(
                    select(messaging_channels).where(
                        messaging_channels.c.kind == kind.value,
                        messaging_channels.c.context_key == context_key,
                    )
                )
            ).one()
            channel = self._channel(row)
            await emit_domain_event(
                session,
                event_key=f"messaging.channel:{channel.id}",
                event_type="messaging.channel.created",
                entity_type="messaging_channels",
                entity_id=channel.id,
                entity_version=1,
                actor_id=None,
                payload={"channel_id": channel.id, "kind": kind.value, "task_id": task_id},
            )
            return channel

    async def channel_peers(self, channel_id: UUID) -> tuple[Membership, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(messaging_memberships)
                    .where(messaging_memberships.c.channel_id == channel_id)
                    .order_by(messaging_memberships.c.created_at)
                )
            ).all()
            return tuple(self._membership(row) for row in rows)

    async def membership(self, channel_id: UUID, person_id: UUID) -> Membership | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_memberships).where(
                        messaging_memberships.c.channel_id == channel_id,
                        messaging_memberships.c.person_id == person_id,
                    )
                )
            ).one_or_none()
            return self._membership(row) if row is not None else None

    async def membership_channels(self, person_id: UUID) -> tuple[tuple[Channel, Membership], ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(messaging_channels, messaging_memberships)
                    .join(
                        messaging_memberships,
                        (messaging_memberships.c.channel_id == messaging_channels.c.id)
                        & (messaging_memberships.c.person_id == person_id),
                    )
                    .order_by(messaging_channels.c.created_at)
                )
            ).all()
            return tuple((self._channel(row), self._membership(row)) for row in rows)

    async def upsert_membership(
        self,
        channel_id: UUID,
        person_id: UUID,
        role: MemberRole,
        *,
        sender_enabled: bool,
    ) -> Membership:
        existing = await self.membership(channel_id, person_id)
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
        previous = await self._refresh_membership(channel_id, person_id)
        async with self.database.session() as session:
            statement = insert(messaging_memberships).values(
                id=uuid4(),
                channel_id=channel_id,
                person_id=person_id,
                role=role.value,
                muted=muted,
                sender_enabled=sender_enabled,
                data_origin="system",
            )
            statement = statement.on_conflict_do_update(
                constraint="uq_messaging_memberships_channel_id_person_id",
                set_={
                    "role": role.value,
                    "muted": muted,
                    "sender_enabled": sender_enabled,
                    "version": messaging_memberships.c.version + 1,
                },
            )
            await session.execute(statement)
        refreshed = await self._refresh_membership(channel_id, person_id)
        if refreshed is None:
            raise RuntimeError("Membership disappeared after save")
        if (
            previous is None
            or previous.muted != refreshed.muted
            or previous.sender_enabled != refreshed.sender_enabled
            or previous.role is not refreshed.role
        ):
            await self._emit_event(
                event_key=f"messaging.membership:{uuid4()}",
                event_type="messaging.membership.changed",
                entity_type="messaging_memberships",
                entity_id=person_id,
                entity_version=1,
                actor_id=person_id,
                payload={
                    "channel_id": channel_id,
                    "role": refreshed.role.value,
                    "muted": refreshed.muted,
                    "sender_enabled": refreshed.sender_enabled,
                },
            )
        return refreshed

    async def _refresh_membership(self, channel_id: UUID, person_id: UUID) -> Membership | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_memberships).where(
                        messaging_memberships.c.channel_id == channel_id,
                        messaging_memberships.c.person_id == person_id,
                    )
                )
            ).one_or_none()
            return self._membership(row) if row is not None else None

    async def message(self, channel_id: UUID, message_id: UUID) -> Message | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_messages).where(
                        messaging_messages.c.channel_id == channel_id,
                        messaging_messages.c.id == message_id,
                    )
                )
            ).one_or_none()
            return self._message(row) if row is not None else None

    async def messages(
        self, channel_id: UUID, *, limit: int, before_sequence: int | None
    ) -> tuple[Message, ...]:
        query = select(messaging_messages).where(messaging_messages.c.channel_id == channel_id)
        if before_sequence is not None:
            query = query.where(messaging_messages.c.sequence < before_sequence)
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    query.order_by(messaging_messages.c.sequence.desc()).limit(limit)
                )
            ).all()
            return tuple(self._message(row) for row in reversed(rows))

    async def last_message(self, channel_id: UUID) -> Message | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_messages)
                    .where(messaging_messages.c.channel_id == channel_id)
                    .order_by(messaging_messages.c.sequence.desc())
                    .limit(1)
                )
            ).one_or_none()
            return self._message(row) if row is not None else None

    async def append_message(self, message: Message) -> Message:
        async with self.database.session() as session:
            sequence = (
                await session.scalar(
                    select(func.max(messaging_messages.c.sequence)).where(
                        messaging_messages.c.channel_id == message.channel_id
                    )
                )
                or 0
            ) + 1
            row = (
                await session.execute(
                    insert(messaging_messages)
                    .values(
                        id=message.id,
                        channel_id=message.channel_id,
                        author_id=message.author_id,
                        kind=message.kind.value,
                        body=message.body,
                        sequence=sequence,
                        payload={"artifact_refs": list(message.artifact_refs)},
                        data_origin="human" if message.author_id is not None else "system",
                        created_by=message.author_id,
                    )
                    .returning(messaging_messages)
                )
            ).one()
            stored = self._message(row)
            await emit_domain_event(
                session,
                event_key=f"messaging.message:{stored.id}",
                event_type="messaging.message.appended",
                entity_type="messaging_messages",
                entity_id=stored.id,
                entity_version=stored.sequence,
                actor_id=stored.author_id,
                payload={
                    "channel_id": stored.channel_id,
                    "sequence": stored.sequence,
                    "kind": stored.kind.value,
                    "artifact_count": len(stored.artifact_refs),
                },
            )
            return stored

    async def unread_counts(self, person_id: UUID) -> Mapping[UUID, int]:
        joined = (
            messaging_memberships.join(
                messaging_messages,
                messaging_messages.c.channel_id == messaging_memberships.c.channel_id,
            )
            .join(
                messaging_read_cursors,
                (messaging_read_cursors.c.channel_id == messaging_memberships.c.channel_id)
                & (messaging_read_cursors.c.person_id == person_id),
                isouter=True,
            )
            .join(
                messaging_channels,
                messaging_channels.c.id == messaging_memberships.c.channel_id,
            )
        )
        query = (
            select(messaging_messages.c.channel_id, func.count().label("unread"))
            .select_from(joined)
            .where(
                messaging_memberships.c.person_id == person_id,
                messaging_messages.c.sequence
                > func.coalesce(messaging_read_cursors.c.last_sequence, 0),
                messaging_messages.c.author_id.is_distinct_from(person_id),
                messaging_messages.c.kind == MessageKind.TEXT.value,
                messaging_channels.c.status == ChannelStatus.ACTIVE.value,
            )
            .group_by(messaging_messages.c.channel_id)
        )
        async with self.database.sessions() as session:
            rows = (await session.execute(query)).all()
            return {row.channel_id: int(row.unread) for row in rows}

    async def cursor(self, channel_id: UUID, person_id: UUID) -> ReadCursor | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(messaging_read_cursors).where(
                        messaging_read_cursors.c.channel_id == channel_id,
                        messaging_read_cursors.c.person_id == person_id,
                    )
                )
            ).one_or_none()
            if row is None:
                return None
            return ReadCursor(row.channel_id, row.person_id, row.last_sequence)

    async def save_cursor(self, cursor: ReadCursor) -> None:
        previous = await self.cursor(cursor.channel_id, cursor.person_id)
        async with self.database.session() as session:
            statement = insert(messaging_read_cursors).values(
                id=uuid4(),
                channel_id=cursor.channel_id,
                person_id=cursor.person_id,
                last_sequence=cursor.last_sequence,
                data_origin="system",
            )
            statement = statement.on_conflict_do_update(
                constraint="uq_messaging_read_cursors_channel_id_person_id",
                set_={
                    "last_sequence": func.greatest(
                        messaging_read_cursors.c.last_sequence, cursor.last_sequence
                    ),
                    "version": messaging_read_cursors.c.version + 1,
                },
            )
            await session.execute(statement)
        if previous is None or previous.last_sequence < cursor.last_sequence:
            await self._emit_event(
                event_key=f"messaging.cursor:{uuid4()}",
                event_type="messaging.cursor.advanced",
                entity_type="messaging_read_cursors",
                entity_id=cursor.person_id,
                entity_version=cursor.last_sequence,
                actor_id=cursor.person_id,
                payload={
                    "channel_id": cursor.channel_id,
                    "last_sequence": cursor.last_sequence,
                },
            )

    async def peer_person_ids(self, person_id: UUID) -> tuple[UUID, ...]:
        mine = aliased(messaging_memberships)
        others = aliased(messaging_memberships)
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(others.c.person_id)
                    .join(mine, others.c.channel_id == mine.c.channel_id)
                    .where(mine.c.person_id == person_id, others.c.person_id != person_id)
                    .distinct()
                )
            ).all()
        return tuple(sorted({row.person_id for row in rows}, key=str))

    async def search_messages(
        self, person_id: UUID, query: str, *, limit: int
    ) -> tuple[MessageSearchHit, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(messaging_messages, messaging_channels.c.title)
                    .join(
                        messaging_memberships,
                        (messaging_memberships.c.channel_id == messaging_messages.c.channel_id)
                        & (messaging_memberships.c.person_id == person_id),
                    )
                    .join(
                        messaging_channels,
                        messaging_channels.c.id == messaging_messages.c.channel_id,
                    )
                    .where(messaging_channels.c.status == ChannelStatus.ACTIVE.value)
                    .order_by(messaging_messages.c.created_at.desc())
                    .limit(400)
                )
            ).all()
        hits: list[MessageSearchHit] = []
        for row in rows:
            if len(hits) >= limit:
                break
            if query.casefold() in row.body.casefold():
                hits.append(
                    MessageSearchHit(
                        row.channel_id,
                        row.id,
                        row.title or None,
                        row.sequence,
                        row.body,
                        row.created_at,
                    )
                )
        return tuple(hits)

    async def _emit_event(
        self,
        *,
        event_key: str,
        event_type: str,
        entity_type: str,
        entity_id: UUID,
        entity_version: int,
        actor_id: UUID | None,
        payload: dict[str, object] | None,
    ) -> None:
        """Emit a privacy-safe domain event without holding an open transaction."""
        async with self.database.session() as session:
            await emit_domain_event(
                session,
                event_key=event_key,
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_version=entity_version,
                actor_id=actor_id,
                payload=payload,
            )
