"""Privacy-safe, idempotent participant task-catalog analytics (TC-050).

Only the closed event dictionary below is accepted. Search text, titles, briefs,
URLs, evidence and arbitrary client properties are not part of the contract.
The append-only store is an analytics sink; failures never mutate work or skills.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID

from impulse.api.errors import ApiError
from impulse.domain.events import EventValue, safe_event_payload
from impulse.domain.identity import ActorContext, Role

ANALYTICS_DICTIONARY_VERSION = "task-catalog-analytics-v1"
_EVENT_KEY = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


class CatalogEventName(StrEnum):
    CATALOG_VIEW = "catalog_view"
    TASK_SELECT = "task_select"
    CONDITIONS_OPEN = "conditions_open"
    APPLICATION_RESULT = "application_result"
    GROWTH_EXPAND = "growth_expand"
    VIEW_CHANGE = "view_change"


class CatalogApplicationResult(StrEnum):
    SUCCESS = "success"
    ERROR = "error"
    TERMS_CHANGED = "terms_changed"
    OFFLINE = "offline"


@dataclass(frozen=True, slots=True)
class CatalogAnalyticsCommand:
    event_id: UUID
    event_name: CatalogEventName
    task_id: UUID | None = None
    view: str | None = None
    result: CatalogApplicationResult | None = None
    algorithm_version: str | None = None
    snapshot_version: str | None = None
    terms_version: int | None = None


@dataclass(frozen=True, slots=True)
class CatalogAnalyticsEvent:
    event_key: str
    event_name: CatalogEventName
    person_id: UUID
    payload: dict[str, EventValue]
    occurred_at: datetime


@dataclass(frozen=True, slots=True)
class CatalogAnalyticsReceipt:
    event_id: UUID
    duplicate: bool


class CatalogAnalyticsConflict(ValueError):
    """One client event id was reused for a different event payload."""


class CatalogAnalyticsStore(Protocol):
    async def append(self, event: CatalogAnalyticsEvent) -> bool:
        """Append once; return True for an identical duplicate, else raise on conflict."""
        ...


class MemoryCatalogAnalyticsStore:
    def __init__(self) -> None:
        self._events: dict[str, CatalogAnalyticsEvent] = {}

    @property
    def events(self) -> tuple[CatalogAnalyticsEvent, ...]:
        return tuple(self._events.values())

    async def append(self, event: CatalogAnalyticsEvent) -> bool:
        existing = self._events.get(event.event_key)
        if existing is not None:
            if (
                existing.event_name != event.event_name
                or existing.person_id != event.person_id
                or existing.payload != event.payload
            ):
                raise CatalogAnalyticsConflict("Analytics event id has a different payload")
            return True
        self._events[event.event_key] = event
        return False


class TaskCatalogAnalyticsService:
    def __init__(self, store: CatalogAnalyticsStore) -> None:
        self._store = store

    @staticmethod
    def _validate(command: CatalogAnalyticsCommand) -> None:
        task_events = {
            CatalogEventName.TASK_SELECT,
            CatalogEventName.CONDITIONS_OPEN,
            CatalogEventName.APPLICATION_RESULT,
            CatalogEventName.GROWTH_EXPAND,
        }
        if command.event_name in task_events and command.task_id is None:
            raise ApiError(
                code="ANALYTICS_TASK_REQUIRED",
                message="Для этого события нужен идентификатор задачи.",
                status_code=422,
            )
        if command.event_name not in task_events and command.task_id is not None:
            raise ApiError(
                code="ANALYTICS_TASK_NOT_ALLOWED",
                message="Событие представления не принимает идентификатор задачи.",
                status_code=422,
            )
        if command.event_name is CatalogEventName.APPLICATION_RESULT:
            if command.result is None:
                raise ApiError(
                    code="ANALYTICS_RESULT_REQUIRED",
                    message="Для результата отклика нужен закрытый код результата.",
                    status_code=422,
                )
        elif command.result is not None:
            raise ApiError(
                code="ANALYTICS_RESULT_NOT_ALLOWED",
                message="Код результата допустим только для события отклика.",
                status_code=422,
            )
        if command.event_name is CatalogEventName.VIEW_CHANGE and command.view not in {
            "cards",
            "list",
        }:
            raise ApiError(
                code="ANALYTICS_VIEW_REQUIRED",
                message="Для смены представления нужен cards или list.",
                status_code=422,
            )
        if command.view is not None and command.view not in {"cards", "list"}:
            raise ApiError(
                code="ANALYTICS_VIEW_INVALID",
                message="Неизвестное представление каталога.",
                status_code=422,
            )
        for value in (command.algorithm_version, command.snapshot_version):
            if value is not None and not value.strip():
                raise ApiError(
                    code="ANALYTICS_VERSION_INVALID",
                    message="Версия не может быть пустой.",
                    status_code=422,
                )
        if command.terms_version is not None and command.terms_version < 1:
            raise ApiError(
                code="ANALYTICS_VERSION_INVALID",
                message="Версия условий должна быть положительной.",
                status_code=422,
            )

    async def record(
        self, actor: ActorContext, command: CatalogAnalyticsCommand
    ) -> CatalogAnalyticsReceipt:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для текущей роли.", status_code=403
            )
        self._validate(command)
        event_key = f"task-catalog:{actor.person_id}:{command.event_id}"
        if not _EVENT_KEY.fullmatch(event_key):
            raise ApiError(
                code="ANALYTICS_EVENT_ID_INVALID",
                message="Некорректный идемпотентный идентификатор события.",
                status_code=422,
            )
        payload = safe_event_payload(
            {
                "dictionary_version": ANALYTICS_DICTIONARY_VERSION,
                "event_id": str(command.event_id),
                "task_id": str(command.task_id) if command.task_id is not None else None,
                "view": command.view,
                "result": command.result.value if command.result is not None else None,
                "algorithm_version": command.algorithm_version,
                "snapshot_version": command.snapshot_version,
                "terms_version": command.terms_version,
            }
        )
        event = CatalogAnalyticsEvent(
            event_key=event_key,
            event_name=command.event_name,
            person_id=actor.person_id,
            payload=payload,
            occurred_at=datetime.now(UTC),
        )
        try:
            duplicate = await self._store.append(event)
        except CatalogAnalyticsConflict as exc:
            raise ApiError(
                code="ANALYTICS_EVENT_CONFLICT",
                message="Идентификатор события уже использован для другого payload.",
                status_code=409,
            ) from exc
        return CatalogAnalyticsReceipt(event_id=command.event_id, duplicate=duplicate)


__all__ = [
    "ANALYTICS_DICTIONARY_VERSION",
    "CatalogAnalyticsCommand",
    "CatalogAnalyticsConflict",
    "CatalogAnalyticsEvent",
    "CatalogAnalyticsReceipt",
    "CatalogAnalyticsStore",
    "CatalogApplicationResult",
    "CatalogEventName",
    "MemoryCatalogAnalyticsStore",
    "TaskCatalogAnalyticsService",
]
