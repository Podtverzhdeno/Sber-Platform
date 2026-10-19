"""PostgreSQL persistence for the notification feed."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import CursorResult, Row, desc, func, insert, select, update

from impulse.domain.notifications import Notification, NotificationKind
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.notifications import notifications


class SqlNotificationsStore:
    """PostgreSQL adapter implementing NotificationStore."""

    def __init__(self, database: Database) -> None:
        self.database = database

    def _row_notification(self, row: Row[Any]) -> Notification:
        return Notification(
            id=row.id,
            person_id=row.person_id,
            kind=NotificationKind(row.kind),
            title=row.title,
            body=row.body,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            read_at=row.read_at,
            created_at=row.created_at,
        )

    async def list(self, person_id: UUID) -> tuple[Notification, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(notifications)
                    .where(notifications.c.person_id == person_id)
                    .order_by(desc(notifications.c.created_at), notifications.c.id)
                    .limit(100)
                )
            ).all()
            return tuple(self._row_notification(row) for row in rows)

    async def unread_count(self, person_id: UUID) -> int:
        async with self.database.sessions() as session:
            count = (
                await session.scalar(
                    select(func.count())
                    .select_from(notifications)
                    .where(
                        notifications.c.person_id == person_id,
                        notifications.c.read_at.is_(None),
                    )
                )
                or 0
            )
        return int(count)

    async def append(self, notification: Notification) -> Notification:
        async with self.database.session() as session:
            await session.execute(
                insert(notifications).values(
                    id=notification.id,
                    person_id=notification.person_id,
                    kind=notification.kind.value,
                    title=notification.title,
                    body=notification.body,
                    entity_type=notification.entity_type,
                    entity_id=notification.entity_id,
                    read_at=notification.read_at,
                    created_at=notification.created_at,
                    data_origin="demo_runtime",
                    created_by=notification.person_id,
                )
            )
            return notification

    async def mark_read(self, person_id: UUID, notification_id: UUID) -> Notification | None:
        async with self.database.session() as session:
            mentioned = await session.execute(
                update(notifications)
                .where(
                    notifications.c.person_id == person_id,
                    notifications.c.id == notification_id,
                    notifications.c.read_at.is_(None),
                )
                .values(read_at=datetime.now(UTC), version=notifications.c.version + 1)
                .returning(notifications)
            )
            row = mentioned.one_or_none()
            return self._row_notification(row) if row is not None else None

    async def mark_all_read(self, person_id: UUID) -> int:
        async with self.database.session() as session:
            changed = await session.execute(
                update(notifications)
                .where(
                    notifications.c.person_id == person_id,
                    notifications.c.read_at.is_(None),
                )
                .values(read_at=datetime.now(UTC), version=notifications.c.version + 1)
            )
            return cast(CursorResult[Any], changed).rowcount or 0
