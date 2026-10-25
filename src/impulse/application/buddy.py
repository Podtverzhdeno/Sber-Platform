"""Owner-scoped Buddy conversations independent of model availability."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from impulse.application.errors import ApiError
from impulse.application.development import DevelopmentService
from impulse.application.growth import GrowthService
from impulse.domain.buddy_suggestion import (
    BOOTCAMP_IDLE_THRESHOLD_DAYS,
    BuddySuggestion,
    build_bootcamp_idle_suggestion,
    build_domain_next_suggestion,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.priority import ScoredStep, StepSpec


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


@dataclass(frozen=True, slots=True)
class BuddySuggestionStates:
    """Per-person suggestion feedback snapshot (dismissed / irrelevant / snoozed)."""

    dismissed: frozenset[str] = frozenset()
    irrelevant: frozenset[str] = frozenset()
    snoozed: tuple[tuple[str, datetime], ...] = ()

    def snoozed_until(self, suggestion_id: str) -> datetime | None:
        for key, until in self.snoozed:
            if key == suggestion_id:
                return until
        return None


class BuddyStorage:
    """Persistence boundary which keeps Buddy history across service restarts."""

    async def create_thread(self, owner_id: UUID) -> BuddyThread:
        raise NotImplementedError

    async def load_thread(self, owner_id: UUID, thread_id: UUID) -> BuddyThread:
        raise NotImplementedError

    async def append_message(
        self,
        thread_id: UUID,
        client_message_id: str,
        *,
        role: str,
        content: str,
        created_at: datetime,
    ) -> BuddyMessage:
        raise NotImplementedError

    async def set_thread_status(self, thread_id: UUID, status: str) -> BuddyThread:
        raise NotImplementedError

    async def upsert_feedback(
        self, thread_id: UUID, actor_id: UUID, *, rating: int
    ) -> BuddyFeedback:
        raise NotImplementedError

    async def block_memory(self, person_id: UUID) -> None:
        raise NotImplementedError

    async def is_memory_blocked(self, person_id: UUID) -> bool:
        raise NotImplementedError

    async def delete_person_threads(self, person_id: UUID) -> int:
        raise NotImplementedError

    async def purge_messages_before(self, cutoff: datetime) -> int:
        raise NotImplementedError

    async def add_deletion_audit(
        self, owner_id: UUID, reason: str, deleted_messages: int, completed_at: datetime
    ) -> BuddyDeletionAudit:
        raise NotImplementedError

    async def deletion_audits(self) -> tuple[BuddyDeletionAudit, ...]:
        raise NotImplementedError

    async def append_suggestion_state(
        self,
        person_id: UUID,
        suggestion_id: str,
        state: str,
        *,
        snoozed_until: datetime | None = None,
    ) -> None:
        raise NotImplementedError

    async def suggestion_states(self, person_id: UUID) -> BuddySuggestionStates:
        raise NotImplementedError


class MemoryBuddyStorage(BuddyStorage):
    """Single-process default: retains the previous in-memory behaviour."""

    def __init__(self) -> None:
        self._threads: dict[UUID, BuddyThread] = {}
        self._message_keys: dict[tuple[UUID, str], BuddyMessage] = {}
        self._feedback: dict[tuple[UUID, UUID], BuddyFeedback] = {}
        self._memory_blocked: set[UUID] = set()
        self._dismissed_suggestions: dict[UUID, set[str]] = {}
        self._snoozed_suggestions: dict[tuple[UUID, str], datetime] = {}
        self._irrelevant_suggestions: set[tuple[UUID, str]] = set()
        self._deletion_audits: list[BuddyDeletionAudit] = []

    async def create_thread(self, owner_id: UUID) -> BuddyThread:
        thread = BuddyThread(uuid4(), owner_id, "active")
        self._threads[thread.id] = thread
        return thread

    async def load_thread(self, owner_id: UUID, thread_id: UUID) -> BuddyThread:
        thread = self._threads.get(thread_id)
        if thread is None or thread.owner_id != owner_id:
            raise ApiError("RESOURCE_NOT_FOUND", "Buddy thread was not found.", 404)
        return thread

    async def append_message(
        self,
        thread_id: UUID,
        client_message_id: str,
        *,
        role: str,
        content: str,
        created_at: datetime,
    ) -> BuddyMessage:
        thread = self._threads[thread_id]
        key = (thread_id, client_message_id)
        existing = self._message_keys.get(key)
        if existing is not None:
            return existing
        message = BuddyMessage(uuid4(), client_message_id, role, content, created_at)
        self._message_keys[key] = message
        self._threads[thread_id] = replace(thread, messages=(*thread.messages, message))
        return message

    async def set_thread_status(self, thread_id: UUID, status: str) -> BuddyThread:
        thread = self._threads[thread_id]
        updated = replace(thread, status=status)
        self._threads[thread_id] = updated
        return updated

    async def upsert_feedback(
        self, thread_id: UUID, actor_id: UUID, *, rating: int
    ) -> BuddyFeedback:
        key = (thread_id, actor_id)
        feedback = self._feedback.get(key)
        if feedback is None:
            feedback = BuddyFeedback(uuid4(), thread_id, actor_id, rating)
        else:
            feedback = replace(feedback, rating=rating)
        self._feedback[key] = feedback
        return feedback

    async def block_memory(self, person_id: UUID) -> None:
        self._memory_blocked.add(person_id)

    async def is_memory_blocked(self, person_id: UUID) -> bool:
        return person_id in self._memory_blocked

    async def delete_person_threads(self, person_id: UUID) -> int:
        deleted = 0
        for thread_id, thread in tuple(self._threads.items()):
            if thread.owner_id != person_id:
                continue
            deleted += len(thread.messages)
            self._threads[thread_id] = replace(
                thread, status="cancelled", messages=(), content_deleted=True
            )
        self._message_keys = {
            key: value
            for key, value in self._message_keys.items()
            if self._threads[key[0]].owner_id != person_id
        }
        return deleted

    async def purge_messages_before(self, cutoff: datetime) -> int:
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

    async def add_deletion_audit(
        self, owner_id: UUID, reason: str, deleted_messages: int, completed_at: datetime
    ) -> BuddyDeletionAudit:
        audit = BuddyDeletionAudit(uuid4(), owner_id, reason, deleted_messages, completed_at)
        self._deletion_audits.append(audit)
        return audit

    async def deletion_audits(self) -> tuple[BuddyDeletionAudit, ...]:
        return tuple(self._deletion_audits)

    async def append_suggestion_state(
        self,
        person_id: UUID,
        suggestion_id: str,
        state: str,
        *,
        snoozed_until: datetime | None = None,
    ) -> None:
        if state == "dismissed":
            self._dismissed_suggestions.setdefault(person_id, set()).add(suggestion_id)
        elif state == "irrelevant":
            self._irrelevant_suggestions.add((person_id, suggestion_id))
        elif state == "snoozed":
            if snoozed_until is None:
                raise ApiError("INVALID_FEEDBACK", "Snooze requires an until timestamp.", 422)
            self._snoozed_suggestions[(person_id, suggestion_id)] = snoozed_until
        else:
            raise ApiError("INVALID_FEEDBACK", "Unsupported suggestion state.", 422)

    async def suggestion_states(self, person_id: UUID) -> BuddySuggestionStates:
        return BuddySuggestionStates(
            dismissed=frozenset(self._dismissed_suggestions.get(person_id, set())),
            irrelevant=frozenset(
                suggestion_id
                for person, suggestion_id in self._irrelevant_suggestions
                if person == person_id
            ),
            snoozed=tuple(
                (suggestion_id, until)
                for (person, suggestion_id), until in self._snoozed_suggestions.items()
                if person == person_id
            ),
        )


class BuddyConversationService:
    """Conversation flow persisted through a `BuddyStorage` (restart-safe)."""

    def __init__(self, storage: BuddyStorage | None = None) -> None:
        self._storage = storage or MemoryBuddyStorage()

    @property
    def storage(self) -> BuddyStorage:
        return self._storage

    @staticmethod
    def _participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError("FORBIDDEN", "Buddy is available to a participant.", 403)

    async def create_thread(self, actor: ActorContext) -> BuddyThread:
        self._participant(actor)
        await self._memory_allowed(actor)
        return await self._storage.create_thread(actor.person_id)

    async def thread(self, actor: ActorContext, thread_id: UUID) -> BuddyThread:
        self._participant(actor)
        await self._memory_allowed(actor)
        return await self._storage.load_thread(actor.person_id, thread_id)

    async def add_message(
        self,
        actor: ActorContext,
        thread_id: UUID,
        *,
        client_message_id: str,
        content: str,
    ) -> BuddyMessage:
        thread = await self.thread(actor, thread_id)
        if thread.status != "active":
            raise ApiError("THREAD_NOT_ACTIVE", "Buddy thread is not active.", 409)
        return await self._storage.append_message(
            thread_id,
            client_message_id,
            role="user",
            content=content,
            created_at=datetime.now(UTC),
        )

    async def cancel(self, actor: ActorContext, thread_id: UUID) -> BuddyThread:
        thread = await self.thread(actor, thread_id)
        return await self._storage.set_thread_status(thread.id, "cancelled")

    async def feedback(self, actor: ActorContext, thread_id: UUID, *, rating: int) -> BuddyFeedback:
        await self.thread(actor, thread_id)
        return await self._storage.upsert_feedback(thread_id, actor.person_id, rating=rating)

    async def dismiss_suggestion(self, actor: ActorContext, suggestion_id: str) -> None:
        """Remember the dismissed home-card version; never mutates growth state."""
        self._participant(actor)
        await self._storage.append_suggestion_state(
            actor.person_id, suggestion_id, "dismissed", snoozed_until=None
        )

    async def dismissed_suggestion(self, person_id: UUID) -> str | None:
        states = await self._storage.suggestion_states(person_id)
        return next(iter(states.dismissed), None)

    async def suggestion_hidden(
        self, person_id: UUID, suggestion_id: str, *, now: datetime
    ) -> bool:
        states = await self._storage.suggestion_states(person_id)
        if suggestion_id in states.dismissed:
            return True
        if suggestion_id in states.irrelevant:
            return True
        snoozed_until = states.snoozed_until(suggestion_id)
        return snoozed_until is not None and snoozed_until > now

    async def snooze_suggestion(
        self, actor: ActorContext, suggestion_id: str, *, until: datetime
    ) -> None:
        self._participant(actor)
        await self._storage.append_suggestion_state(
            actor.person_id, suggestion_id, "snoozed", snoozed_until=until
        )

    async def mark_suggestion_irrelevant(self, actor: ActorContext, suggestion_id: str) -> None:
        self._participant(actor)
        await self._storage.append_suggestion_state(
            actor.person_id, suggestion_id, "irrelevant", snoozed_until=None
        )

    async def withdraw_memory(self, actor: ActorContext) -> BuddyDeletionAudit:
        """Stop reads synchronously, then remove content while retaining minimal audit."""
        self._participant(actor)
        await self._storage.block_memory(actor.person_id)
        deleted = await self._storage.delete_person_threads(actor.person_id)
        return await self._storage.add_deletion_audit(
            actor.person_id, "consent_withdrawn", deleted, datetime.now(UTC)
        )

    async def cleanup_before(self, cutoff: datetime) -> int:
        return await self._storage.purge_messages_before(cutoff)

    async def deletion_audits(self) -> tuple[BuddyDeletionAudit, ...]:
        return await self._storage.deletion_audits()

    async def _memory_allowed(self, actor: ActorContext) -> None:
        if await self._storage.is_memory_blocked(actor.person_id):
            raise ApiError("AI_MEMORY_DISABLED", "AI memory consent is not active.", 409)


@dataclass(frozen=True, slots=True)
class BuddySuggestionState:
    """Home-card outcome: explainable suggestion plus its dismissal flag."""

    suggestions: tuple[BuddySuggestion, ...]
    dismissed: bool

    @property
    def suggestion(self) -> BuddySuggestion | None:
        """Compatibility projection for clients on contract v1."""
        return self.suggestions[0] if self.suggestions else None


class BuddySuggestionService:
    """Объяснимая детерминированная рекомендация главной (openspec 22.3).

    Анализ строится только из разрешённых данных (`GrowthService.next_step`,
    Bootcamp-сертификаты). Модель не вызывается, запись на курс не создается,
    траектория и уровень не меняются; dismiss не удаляет Growth snapshot.
    """

    def __init__(
        self,
        growth: GrowthService,
        development: DevelopmentService,
        conversations: BuddyConversationService,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._growth = growth
        self._development = development
        self._conversations = conversations
        self._now = now or (lambda: datetime.now(UTC).replace(microsecond=0))

    async def state(self, actor: ActorContext) -> BuddySuggestionState:
        self._check_participant(actor)
        _roadmaps, result = await self._growth.next_step(actor)
        now = self._now()
        available = tuple(step for step in result.steps if step.available)
        built = tuple([await self._build(actor.person_id, step, now) for step in available[:6]])
        visible: tuple[BuddySuggestion, ...] = ()
        for item in built:
            if not await self._conversations.suggestion_hidden(
                actor.person_id, item.suggestion_id, now=now
            ):
                visible = (*visible, item)
        visible = visible[:3]
        return BuddySuggestionState(
            suggestions=visible,
            dismissed=bool(built) and not visible,
        )

    async def dismiss(self, actor: ActorContext, suggestion_id: str) -> None:
        self._check_participant(actor)
        await self._conversations.dismiss_suggestion(actor, suggestion_id)

    async def feedback(
        self,
        actor: ActorContext,
        suggestion_id: str,
        *,
        action: str,
        snooze_until: datetime | None = None,
    ) -> None:
        """Store a preference only; never complete or mutate the target object."""
        self._check_participant(actor)
        suggestion = await self.resolve(actor, suggestion_id)
        if action == "dismiss":
            await self._conversations.dismiss_suggestion(actor, suggestion_id)
            return
        if action == "irrelevant":
            await self._conversations.mark_suggestion_irrelevant(actor, suggestion_id)
            return
        if action != "snooze":
            raise ApiError("INVALID_FEEDBACK", "Unsupported suggestion feedback.", 422)
        until = snooze_until or (self._now() + timedelta(days=7))
        deadline = suggestion.action.deadline_at if suggestion.action is not None else None
        if deadline is not None and deadline <= self._now() + timedelta(days=3):
            raise ApiError(
                "URGENT_SUGGESTION",
                "Urgent mandatory work cannot be hidden by snooze.",
                409,
            )
        await self._conversations.snooze_suggestion(actor, suggestion_id, until=until)

    async def resolve(self, actor: ActorContext, suggestion_id: str) -> BuddySuggestion:
        """Re-read permitted sources immediately before navigation."""
        self._check_participant(actor)
        _roadmaps, result = await self._growth.next_step(actor)
        now = self._now()
        for step in result.steps:
            if not step.available:
                continue
            suggestion = await self._build(actor.person_id, step, now)
            if suggestion.suggestion_id == suggestion_id:
                return suggestion
        raise ApiError(
            "SUGGESTION_STALE",
            "The recommended object is no longer available. Refresh recommendations.",
            409,
        )

    async def _track_title(self, trajectory_key: str) -> str:
        for track in await self._development.store.tracks():
            if track.key == trajectory_key:
                return track.title
        return trajectory_key

    async def _build(
        self,
        person_id: UUID,
        step: ScoredStep,
        now: datetime,
    ) -> BuddySuggestion:
        spec: StepSpec = step.spec
        trajectory_key = spec.trajectory_key
        track_title = await self._track_title(trajectory_key)
        last_verified_at = await self._last_verified_checkpoint_at(person_id)
        idle = last_verified_at is None or (now - last_verified_at).days >= (
            BOOTCAMP_IDLE_THRESHOLD_DAYS
        )
        if idle:
            suggestion = build_bootcamp_idle_suggestion(
                now=now,
                last_verified_at=last_verified_at,
                track_title=track_title,
                step_kind=spec.target_kind,
                step_key=spec.target_key,
                step_title=spec.target_title,
                checkpoint_id=spec.milestone_key,
                effort_hours=step.state.effort_hours,
                deadline_at=step.state.deadline_at,
                rank_score=str(step.score),
            )
        else:
            suggestion = build_domain_next_suggestion(
                now=now,
                track_title=track_title,
                step_kind=spec.target_kind,
                step_key=spec.target_key,
                step_title=spec.target_title,
                checkpoint_id=spec.milestone_key,
                effort_hours=step.state.effort_hours,
                deadline_at=step.state.deadline_at,
                rank_score=str(step.score),
            )
        categories = tuple(
            dict.fromkeys(
                (
                    *suggestion.source_categories,
                    "participant_scope",
                    *step.factors,
                )
            )
        )
        reason = "; ".join(step.reasons) if step.reasons else "стабильный tie-break"
        return replace(
            suggestion,
            source_categories=categories,
            explanation=f"{suggestion.explanation} Факторы policy: {reason}.",
        )

    async def _last_verified_checkpoint_at(self, person_id: UUID) -> datetime | None:
        certificates = self._development.certificates
        if certificates is None:
            return None
        issued = await certificates.course_certificates(person_id)
        last = max((item.issued_at for item in issued), default=None)
        if last is None:
            return None
        return last if last.tzinfo is not None else last.replace(tzinfo=UTC)

    @staticmethod
    def _check_participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError("FORBIDDEN", "Buddy suggestions are available to a participant.", 403)


__all__ = [
    "BuddyConversationService",
    "BuddyDeletionAudit",
    "BuddyFeedback",
    "BuddyMessage",
    "BuddySuggestionService",
    "BuddySuggestionState",
    "BuddyThread",
]
