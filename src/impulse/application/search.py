"""Applications layer global search over tasks, courses, events, people, messages and documents."""

from __future__ import annotations

from dataclasses import dataclass

from impulse.application.development import DevelopmentStore
from impulse.application.ecosystem import EcosystemStore
from impulse.application.identity import ActorContext, DemoAuthService
from impulse.application.messaging import MessagingService
from impulse.application.recognition import RecognitionStore
from impulse.application.work import WorkStore


@dataclass(frozen=True, slots=True)
class SearchHit:
    kind: str
    ref: str
    title: str
    meta: str


def _contains(query: str, *fields: str | None) -> bool:
    return any(field is not None and query in field.casefold() for field in fields)


class SearchService:
    """RBAC-filtered search over tasks, courses, events plus people, messages and own documents."""

    def __init__(
        self,
        work_store: WorkStore,
        development_store: DevelopmentStore,
        ecosystem_store: EcosystemStore,
        *,
        messaging_service: MessagingService | None = None,
        auth_service: DemoAuthService | None = None,
        recognition_store: RecognitionStore | None = None,
    ) -> None:
        self.work_store = work_store
        self.development_store = development_store
        self.ecosystem_store = ecosystem_store
        self.messaging_service = messaging_service
        self.auth_service = auth_service
        self.recognition_store = recognition_store

    async def search(
        self,
        actor_context: ActorContext,
        query: str,
        *,
        limit: int,
    ) -> tuple[SearchHit, ...]:
        prepared = query.strip().casefold()
        if len(prepared) < 2:
            return ()
        hits: list[SearchHit] = []

        for task in await self.work_store.published_tasks():
            if _contains(prepared, task.title, task.aggregate.brief.problem):
                hits.append(
                    SearchHit(
                        kind="task",
                        ref=f"task:{task.task_key}",
                        title=task.title,
                        meta=task.aggregate.status.value,
                    )
                )

        for course in await self.development_store.courses():
            if _contains(prepared, course.title):
                hits.append(
                    SearchHit(
                        kind="course",
                        ref=f"course:{course.key}",
                        title=course.title,
                        meta=course.availability,
                    )
                )

        for event in await self.ecosystem_store.events():
            if _contains(prepared, event.title, event.organizer):
                hits.append(
                    SearchHit(
                        kind="event",
                        ref=f"event:{event.key}",
                        title=event.title,
                        meta=event.organizer,
                    )
                )

        if self.messaging_service is not None:
            hits.extend(await self._people_hits(prepared, actor_context))
            hits.extend(await self._message_hits(prepared, limit, actor_context))
        if self.recognition_store is not None:
            hits.extend(await self._document_hits(prepared, actor_context))

        return tuple(hits[:limit])

    async def _people_hits(
        self, prepared: str, actor_context: ActorContext
    ) -> tuple[SearchHit, ...]:
        """People from shared messaging channels only; personas of other chats stay invisible."""
        messaging = self.messaging_service
        auth = self.auth_service
        if messaging is None or auth is None:
            return ()
        hits: list[SearchHit] = []
        for peer_id in await messaging.accessible_peers(actor_context):
            persona = await auth.store.get_persona_by_id(peer_id)
            if persona is None or not _contains(prepared, persona.display_name):
                continue
            roles = ",".join(role.value for role in persona.roles)
            hits.append(
                SearchHit(
                    kind="person",
                    ref=f"person:{peer_id}",
                    title=persona.display_name,
                    meta=roles,
                )
            )
        return tuple(hits)

    async def _message_hits(
        self, prepared: str, limit: int, actor_context: ActorContext
    ) -> tuple[SearchHit, ...]:
        messaging = self.messaging_service
        if messaging is None:
            return ()
        hits: list[SearchHit] = []
        for hit in await messaging.search_messages(actor_context, prepared, limit=limit):
            snippet = hit.body if len(hit.body) <= 80 else f"{hit.body[:77]}…"
            hits.append(
                SearchHit(
                    kind="message",
                    ref=f"message:{hit.channel_id}:{hit.message_id}",
                    title=snippet,
                    meta=hit.channel_title or "Личный чат",
                )
            )
        return tuple(hits)

    async def _document_hits(
        self, prepared: str, actor_context: ActorContext
    ) -> tuple[SearchHit, ...]:
        recognition = self.recognition_store
        if recognition is None:
            return ()
        hits: list[SearchHit] = []
        for credential in await recognition.person_credentials(actor_context.person_id):
            if _contains(prepared, credential.title, credential.level, credential.verification_id):
                hits.append(
                    SearchHit(
                        kind="document",
                        ref=f"credential:{credential.verification_id}",
                        title=credential.title,
                        meta=credential.status.value,
                    )
                )
        return tuple(hits)
