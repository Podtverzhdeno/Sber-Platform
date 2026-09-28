"""Versioned, privacy-safe domain event envelope."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import cast
from uuid import UUID

type EventValue = str | int | float | bool | list[EventValue] | dict[str, EventValue] | None

FORBIDDEN_EVENT_FIELDS = frozenset(
    {
        "raw_chat",
        "chat_text",
        "prompt",
        "response",
        "card_number",
        "bank_account",
        "payment_details",
        "secret",
        "token",
        "api_key",
    }
)


class UnsafeEventPayload(ValueError):
    pass


def safe_event_payload(payload: Mapping[str, object] | None) -> dict[str, EventValue]:
    """Validate metadata-only analytics payload; content and payment details are forbidden."""

    def value(item: object, path: str) -> EventValue:
        if item is None or isinstance(item, str | int | float | bool):
            return item
        if isinstance(item, UUID | datetime):
            return str(item)
        if isinstance(item, list | tuple):
            sequence = cast(list[object] | tuple[object, ...], item)
            return [value(child, path) for child in sequence]
        if isinstance(item, Mapping):
            mapping = cast(Mapping[object, object], item)
            result: dict[str, EventValue] = {}
            for raw_key, child in mapping.items():
                key = str(raw_key)
                if key.casefold() in FORBIDDEN_EVENT_FIELDS:
                    raise UnsafeEventPayload(f"Forbidden event field: {path}{key}")
                result[key] = value(child, f"{path}{key}.")
            return result
        raise UnsafeEventPayload(f"Unsupported event value at {path.rstrip('.')}")

    checked = value(dict(payload or {}), "")
    if not isinstance(checked, dict):
        raise UnsafeEventPayload("Event payload must be an object")
    return checked


@dataclass(frozen=True, slots=True)
class DomainEventEnvelope:
    event_key: str
    event_type: str
    schema_version: int
    entity_type: str
    entity_id: UUID
    entity_version: int
    actor_id: UUID | None
    occurred_at: datetime
    payload: dict[str, EventValue]
