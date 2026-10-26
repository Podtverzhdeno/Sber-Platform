"""Applications layer service and stores for the per-person notification feed."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol, runtime_checkable
from uuid import UUID, uuid4

from impulse.application.errors import ApiError
from impulse.application.identity import ActorContext, demo_personas
from impulse.domain.notifications import Notification, NotificationKind

DEMO_NOTIFICATION_SCRIPTS: tuple[tuple[str, NotificationKind, str, str], ...] = (
    (
        "participant-alex",
        NotificationKind.MESSAGE,
        "Новый комментарий ментора",
        "Елена Наставник: прототип выглядит крепко, проверим артефакты на этой неделе.",
    ),
    (
        "participant-alex",
        NotificationKind.CHECKPOINT,
        "Checkpoint «Практика API» ожидает подтверждения",
        "Завершите checkpoint до конца недели, чтобы сохранить стрик.",
    ),
    (
        "participant-alex",
        NotificationKind.CERTIFICATE,
        "Сертификат «OpenSpec» готов к скачиванию",
        "Сертификат подтверждён и доступен в портфолио.",
    ),
    (
        "customer-roman",
        NotificationKind.APPLICATION,
        "Новая заявка на задачу",
        "Алекс Речной откликнулся на прототип рекомендательной системы.",
    ),
    (
        "customer-roman",
        NotificationKind.REVIEW,
        "Ревью вклада опубликовано",
        "Елена Наставник опубликовала подтверждённую оценку по задаче.",
    ),
    (
        "mentor-elena",
        NotificationKind.REVIEW,
        "Очередь ревью обновилась",
        "Один новый вклад ждёт подтверждения человеческой оценкой.",
    ),
    (
        "manager-olga",
        NotificationKind.SYSTEM,
        "Обзор рисков недели готов",
        "Две задачи требуют управленческого внимания.",
    ),
)


def memory_demo_notifications() -> list[Notification]:
    personas = {item.key: item.person_id for item in demo_personas()}
    rows: list[Notification] = []
    total = len(DEMO_NOTIFICATION_SCRIPTS)
    for index, (key, kind, title, body) in enumerate(DEMO_NOTIFICATION_SCRIPTS):
        person_id = personas.get(key)
        if person_id is None:
            continue
        rows.append(
            Notification(
                id=uuid4(),
                person_id=person_id,
                kind=kind,
                title=title,
                body=body,
                created_at=datetime.now(UTC) - timedelta(days=total - index, hours=index),
            )
        )
    return rows


@runtime_checkable
class NotificationStore(Protocol):
    """Persistence contract for notification feed rows."""

    async def list(self, person_id: UUID) -> tuple[Notification, ...]: ...

    async def unread_count(self, person_id: UUID) -> int: ...

    async def append(self, notification: Notification) -> Notification: ...

    async def mark_read(self, person_id: UUID, notification_id: UUID) -> Notification | None: ...

    async def mark_all_read(self, person_id: UUID) -> int: ...


@dataclass
class MemoryNotificationsStore:
    """dict-backed store used for in-process and DB-less runs."""

    _items: dict[UUID, list[Notification]]

    def __init__(self, items: Mapping[UUID, tuple[Notification, ...]] | None = None) -> None:
        if items is None:
            self._items = {}
        else:
            self._items = {person_id: list(rows) for person_id, rows in items.items()}

    async def list(self, person_id: UUID) -> tuple[Notification, ...]:
        rows = self._items.get(person_id, [])
        return tuple(sorted(rows, key=lambda item: item.created_at, reverse=True))

    async def unread_count(self, person_id: UUID) -> int:
        return sum(1 for row in self._items.get(person_id, []) if row.read_at is None)

    async def append(self, notification: Notification) -> Notification:
        self._items.setdefault(notification.person_id, []).append(notification)
        return notification

    async def mark_read(self, person_id: UUID, notification_id: UUID) -> Notification | None:
        for row in self._items.get(person_id, []):
            if row.id == notification_id and row.read_at is None:
                row.read_at = datetime.now(UTC)
                return row
        return None

    async def mark_all_read(self, person_id: UUID) -> int:
        changed = 0
        for row in self._items.get(person_id, []):
            if row.read_at is None:
                row.read_at = datetime.now(UTC)
                changed += 1
        return changed


class NotificationFeedService:
    """Per-person notification feed with topbar unread counter."""

    def __init__(self, store: NotificationStore) -> None:
        self.store = store

    async def list(self, actor_context: ActorContext) -> tuple[Notification, ...]:
        return await self.store.list(actor_context.person_id)

    async def unread(self, actor_context: ActorContext) -> int:
        return await self.store.unread_count(actor_context.person_id)

    async def publish(
        self,
        person_id: UUID,
        kind: NotificationKind,
        title: str,
        body: str,
        *,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
    ) -> Notification:
        item = Notification(
            id=uuid4(),
            person_id=person_id,
            kind=kind,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        return await self.store.append(item)

    async def mark_read(self, actor_context: ActorContext, notification_id: UUID) -> Notification:
        item = await self.store.mark_read(actor_context.person_id, notification_id)
        if item is None:
            existing = await self._lookup(actor_context, notification_id)
            if existing is not None:
                return existing
            raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
        return item

    async def mark_all_read(self, actor_context: ActorContext) -> int:
        return await self.store.mark_all_read(actor_context.person_id)

    async def _lookup(
        self, actor_context: ActorContext, notification_id: UUID
    ) -> Notification | None:
        for row in await self.store.list(actor_context.person_id):
            if row.id == notification_id:
                return row
        return None
