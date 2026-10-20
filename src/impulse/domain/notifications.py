"""Notification feed record for per-person in-app activity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID


class NotificationKind(StrEnum):
    """Semantic kinds served to the topbar notification center."""

    MESSAGE = "message"
    APPLICATION = "application"
    REVIEW = "review"
    CHECKPOINT = "checkpoint"
    DEADLINE = "deadline"
    CERTIFICATE = "certificate"
    SYSTEM = "system"


@dataclass(slots=True)
class Notification:
    """One feed entry addressed to a single person."""

    id: UUID
    person_id: UUID
    kind: NotificationKind
    title: str
    body: str
    entity_type: str | None = None
    entity_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def read(self) -> bool:
        return self.read_at is not None
