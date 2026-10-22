"""PostgreSQL persistence for Buddy conversations (restart-safe, 29.3)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert

from impulse.api.errors import ApiError
from impulse.application.buddy import (
    BuddyDeletionAudit,
    BuddyFeedback,
    BuddyMessage,
    BuddyStorage,
    BuddySuggestionStates,
    BuddyThread,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.buddy import (
    buddy_deletion_audits,
    buddy_feedback,
    buddy_memory_suppression,
    buddy_messages,
    buddy_suggestion_states,
    buddy_threads,
)


class SqlBuddyStorage(BuddyStorage):
    """`BuddyStorage` implementation on the shared `Database` session factory."""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def create_thread(self, owner_id: UUID) -> BuddyThread:
        thread_id = uuid4()
        async with self._database.session() as session:
            await session.execute(
                insert(buddy_threads).values(
                    id=thread_id,
                    owner_id=owner_id,
                    status="active",
                    content_deleted=False,
                )
            )
            await session.commit()
        return BuddyThread(thread_id, owner_id, "active")

    async def load_thread(self, owner_id: UUID, thread_id: UUID) -> BuddyThread:
        async with self._database.session() as session:
            thread_row = (
                await session.execute(select(buddy_threads).where(buddy_threads.c.id == thread_id))
            ).first()
            if thread_row is None or thread_row.owner_id != owner_id:
                raise ApiError("RESOURCE_NOT_FOUND", "Buddy thread was not found.", 404)
            message_rows = (
                await session.execute(
                    select(buddy_messages)
                    .where(buddy_messages.c.thread_id == thread_id)
                    .order_by(buddy_messages.c.created_at)
                )
            ).all()
        messages = tuple(
            BuddyMessage(row.id, row.client_message_id, row.role, row.content, row.created_at)
            for row in message_rows
        )
        return BuddyThread(
            id=thread_row.id,
            owner_id=thread_row.owner_id,
            status=thread_row.status,
            messages=messages,
            content_deleted=thread_row.content_deleted,
        )

    async def append_message(
        self,
        thread_id: UUID,
        client_message_id: str,
        *,
        role: str,
        content: str,
        created_at: datetime,
    ) -> BuddyMessage:
        async with self._database.session() as session:
            inserted = (
                await session.execute(
                    insert(buddy_messages)
                    .values(
                        thread_id=thread_id,
                        client_message_id=client_message_id,
                        role=role,
                        content=content,
                    )
                    .on_conflict_do_nothing(index_elements=["thread_id", "client_message_id"])
                    .returning(
                        buddy_messages.c.id,
                        buddy_messages.c.client_message_id,
                        buddy_messages.c.role,
                        buddy_messages.c.content,
                        buddy_messages.c.created_at,
                    )
                )
            ).first()
            if inserted is None:
                inserted = (
                    await session.execute(
                        select(buddy_messages).where(
                            buddy_messages.c.thread_id == thread_id,
                            buddy_messages.c.client_message_id == client_message_id,
                        )
                    )
                ).one()
            await session.commit()
        return BuddyMessage(
            inserted.id,
            inserted.client_message_id,
            inserted.role,
            inserted.content,
            inserted.created_at,
        )

    async def set_thread_status(self, thread_id: UUID, status: str) -> BuddyThread:
        async with self._database.session() as session:
            row = (
                await session.execute(select(buddy_threads).where(buddy_threads.c.id == thread_id))
            ).first()
            if row is None:
                raise ApiError("RESOURCE_NOT_FOUND", "Buddy thread was not found.", 404)
            await session.execute(
                update(buddy_threads).where(buddy_threads.c.id == thread_id).values(status=status)
            )
            await session.commit()
        return await self.load_thread(row.owner_id, thread_id)

    async def upsert_feedback(
        self, thread_id: UUID, actor_id: UUID, *, rating: int
    ) -> BuddyFeedback:
        async with self._database.session() as session:
            existing = (
                await session.execute(
                    select(buddy_feedback.c.id).where(
                        buddy_feedback.c.thread_id == thread_id,
                        buddy_feedback.c.actor_id == actor_id,
                    )
                )
            ).first()
            if existing is None:
                feedback_id = uuid4()
                await session.execute(
                    insert(buddy_feedback).values(
                        id=feedback_id, thread_id=thread_id, actor_id=actor_id, rating=rating
                    )
                )
            else:
                feedback_id = existing.id
                await session.execute(
                    update(buddy_feedback)
                    .where(
                        buddy_feedback.c.thread_id == thread_id,
                        buddy_feedback.c.actor_id == actor_id,
                    )
                    .values(rating=rating)
                )
            await session.commit()
        return BuddyFeedback(feedback_id, thread_id, actor_id, rating)

    async def block_memory(self, person_id: UUID) -> None:
        async with self._database.session() as session:
            await session.execute(
                insert(buddy_memory_suppression)
                .values(person_id=person_id)
                .on_conflict_do_nothing(index_elements=["person_id"])
            )
            await session.commit()

    async def is_memory_blocked(self, person_id: UUID) -> bool:
        async with self._database.session() as session:
            row = (
                await session.execute(
                    select(buddy_memory_suppression.c.person_id).where(
                        buddy_memory_suppression.c.person_id == person_id
                    )
                )
            ).first()
        return row is not None

    async def delete_person_threads(self, person_id: UUID) -> int:
        async with self._database.session() as session:
            thread_ids = (
                (
                    await session.execute(
                        select(buddy_threads.c.id).where(buddy_threads.c.owner_id == person_id)
                    )
                )
                .scalars()
                .all()
            )
            if not thread_ids:
                await session.commit()
                return 0
            deleted_messages = (
                (
                    await session.execute(
                        delete(buddy_messages)
                        .where(buddy_messages.c.thread_id.in_(thread_ids))
                        .returning(buddy_messages.c.id)
                    )
                )
                .scalars()
                .all()
            )
            await session.execute(
                update(buddy_threads)
                .where(buddy_threads.c.id.in_(thread_ids))
                .values(status="cancelled", content_deleted=True)
            )
            await session.execute(
                delete(buddy_feedback).where(buddy_feedback.c.thread_id.in_(thread_ids))
            )
            await session.commit()
        return len(deleted_messages)

    async def purge_messages_before(self, cutoff: datetime) -> int:
        async with self._database.session() as session:
            affected_thread_ids = (
                (
                    await session.execute(
                        select(buddy_messages.c.thread_id).where(
                            buddy_messages.c.created_at < cutoff
                        )
                    )
                )
                .scalars()
                .all()
            )
            deleted = (
                (
                    await session.execute(
                        delete(buddy_messages)
                        .where(buddy_messages.c.created_at < cutoff)
                        .returning(buddy_messages.c.id)
                    )
                )
                .scalars()
                .all()
            )
            if affected_thread_ids:
                remaining_rows = (
                    await session.execute(
                        select(buddy_messages.c.thread_id).where(
                            buddy_messages.c.thread_id.in_(affected_thread_ids)
                        )
                    )
                ).all()
                remaining = {row.thread_id for row in remaining_rows}
                emptied = {tid for tid in affected_thread_ids if tid not in remaining}
                if emptied:
                    await session.execute(
                        update(buddy_threads)
                        .where(buddy_threads.c.id.in_(emptied))
                        .values(content_deleted=True)
                    )
            await session.commit()
        return len(deleted)

    async def add_deletion_audit(
        self, owner_id: UUID, reason: str, deleted_messages: int, completed_at: datetime
    ) -> BuddyDeletionAudit:
        audit_id = uuid4()
        async with self._database.session() as session:
            await session.execute(
                insert(buddy_deletion_audits).values(
                    id=audit_id,
                    owner_id=owner_id,
                    reason=reason,
                    deleted_messages=deleted_messages,
                    completed_at=completed_at,
                )
            )
            await session.commit()
        return BuddyDeletionAudit(audit_id, owner_id, reason, deleted_messages, completed_at)

    async def deletion_audits(self) -> tuple[BuddyDeletionAudit, ...]:
        async with self._database.session() as session:
            rows = (
                await session.execute(
                    select(buddy_deletion_audits).order_by(buddy_deletion_audits.c.created_at)
                )
            ).all()
        return tuple(
            BuddyDeletionAudit(
                row.id, row.owner_id, row.reason, row.deleted_messages, row.completed_at
            )
            for row in rows
        )

    async def append_suggestion_state(
        self,
        person_id: UUID,
        suggestion_id: str,
        state: str,
        *,
        snoozed_until: datetime | None = None,
    ) -> None:
        async with self._database.session() as session:
            await session.execute(
                insert(buddy_suggestion_states)
                .values(
                    person_id=person_id,
                    suggestion_id=suggestion_id,
                    state=state,
                    snoozed_until=snoozed_until,
                )
                .on_conflict_do_update(
                    index_elements=["person_id", "suggestion_id", "state"],
                    set_={"snoozed_until": snoozed_until},
                )
            )
            await session.commit()

    async def suggestion_states(self, person_id: UUID) -> BuddySuggestionStates:
        async with self._database.session() as session:
            rows = (
                await session.execute(
                    select(buddy_suggestion_states).where(
                        buddy_suggestion_states.c.person_id == person_id
                    )
                )
            ).all()
        dismissed = tuple(row.suggestion_id for row in rows if row.state == "dismissed")
        irrelevant = tuple(row.suggestion_id for row in rows if row.state == "irrelevant")
        snoozed = tuple(
            (row.suggestion_id, row.snoozed_until)
            for row in rows
            if row.state == "snoozed" and row.snoozed_until is not None
        )
        return BuddySuggestionStates(
            dismissed=frozenset(dismissed),
            irrelevant=frozenset(irrelevant),
            snoozed=snoozed,
        )
