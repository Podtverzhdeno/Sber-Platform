"""Owner-scoped Buddy conversations independent of model availability."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role


@dataclass(frozen=True, slots=True)
class BuddyMessage:
    id: UUID
    client_message_id: str
    role: str
    content: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class BuddyThread:
    id: UUID
    owner_id: UUID
    status: str
    messages: tuple[BuddyMessage, ...] = ()
    content_deleted: bool = False


@dataclass(frozen=True, slots=True)
class BuddyFeedback:
    id: UUID
    thread_id: UUID
    actor_id: UUID
    rating: int


@dataclass(frozen=True, slots=True)
class BuddyDeletionAudit:
    id: UUID
    owner_id: UUID
    reason: str
    deleted_messages: int
    completed_at: datetime


class BuddyConversationService:
    def __init__(self) -> None:
        self._threads: dict[UUID, BuddyThread] = {}
        self._message_keys: dict[tuple[UUID, str], BuddyMessage] = {}
        self._feedback: dict[tuple[UUID, UUID], BuddyFeedback] = {}
        self._memory_blocked: set[UUID] = set()
        self.deletion_audit: list[BuddyDeletionAudit] = []

    @staticmethod
    def _participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError("FORBIDDEN", "Buddy is available to a participant.", 403)

    def create_thread(self, actor: ActorContext) -> BuddyThread:
        self._participant(actor)
        self._memory_allowed(actor)
        thread = BuddyThread(uuid4(), actor.person_id, "active")
        self._threads[thread.id] = thread
        return thread

    def thread(self, actor: ActorContext, thread_id: UUID) -> BuddyThread:
        self._participant(actor)
        self._memory_allowed(actor)
        thread = self._threads.get(thread_id)
        if thread is None or thread.owner_id != actor.person_id:
            raise ApiError("RESOURCE_NOT_FOUND", "Buddy thread was not found.", 404)
        return thread

    def add_message(
        self,
        actor: ActorContext,
        thread_id: UUID,
        *,
        client_message_id: str,
        content: str,
    ) -> BuddyMessage:
        thread = self.thread(actor, thread_id)
        self._memory_allowed(actor)
        if thread.status != "active":
            raise ApiError("THREAD_NOT_ACTIVE", "Buddy thread is not active.", 409)
        key = (thread_id, client_message_id)
        existing = self._message_keys.get(key)
        if existing is not None:
            return existing
        message = BuddyMessage(uuid4(), client_message_id, "user", content, datetime.now(UTC))
        self._message_keys[key] = message
        self._threads[thread_id] = replace(thread, messages=(*thread.messages, message))
        return message

    def cancel(self, actor: ActorContext, thread_id: UUID) -> BuddyThread:
        thread = self.thread(actor, thread_id)
        cancelled = replace(thread, status="cancelled")
        self._threads[thread_id] = cancelled
        return cancelled

    def feedback(self, actor: ActorContext, thread_id: UUID, *, rating: int) -> BuddyFeedback:
        self.thread(actor, thread_id)
        key = (thread_id, actor.person_id)
        feedback = self._feedback.get(key)
        if feedback is None:
            feedback = BuddyFeedback(uuid4(), thread_id, actor.person_id, rating)
        else:
            feedback = replace(feedback, rating=rating)
        self._feedback[key] = feedback
        return feedback

    def withdraw_memory(self, actor: ActorContext) -> BuddyDeletionAudit:
        """Stop reads synchronously, then remove content while retaining minimal audit."""
        self._participant(actor)
        self._memory_blocked.add(actor.person_id)
        deleted = 0
        for thread_id, thread in tuple(self._threads.items()):
            if thread.owner_id != actor.person_id:
                continue
            deleted += len(thread.messages)
            self._threads[thread_id] = replace(
                thread, status="cancelled", messages=(), content_deleted=True
            )
        self._message_keys = {
            key: value
            for key, value in self._message_keys.items()
            if self._threads[key[0]].owner_id != actor.person_id
        }
        audit = BuddyDeletionAudit(
            uuid4(), actor.person_id, "consent_withdrawn", deleted, datetime.now(UTC)
        )
        self.deletion_audit.append(audit)
        return audit

    def cleanup_before(self, cutoff: datetime) -> int:
        deleted = 0
        for thread_id, thread in tuple(self._threads.items()):
            retained = tuple(message for message in thread.messages if message.created_at >= cutoff)
            deleted += len(thread.messages) - len(retained)
            if len(retained) != len(thread.messages):
                self._threads[thread_id] = replace(
                    thread, messages=retained, content_deleted=not retained
                )
        if deleted:
            live_ids = {
                message.id for thread in self._threads.values() for message in thread.messages
            }
            self._message_keys = {
                key: value for key, value in self._message_keys.items() if value.id in live_ids
            }
        return deleted

    def _memory_allowed(self, actor: ActorContext) -> None:
        if actor.person_id in self._memory_blocked:
            raise ApiError("AI_MEMORY_DISABLED", "AI memory consent is not active.", 409)
