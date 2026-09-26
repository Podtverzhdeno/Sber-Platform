"""Shared API v1 serialization contracts."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

StrictAmount = Annotated[Decimal, Field(strict=True, max_digits=18, decimal_places=2)]
CurrencyCode = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TimestampedModel(ApiModel):
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def require_aware_datetime(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timestamp must include a timezone")
        return value.astimezone(UTC)

    @field_serializer("occurred_at")
    def serialize_utc(self, value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")


class Money(ApiModel):
    amount: StrictAmount
    currency: CurrencyCode


class CursorPage[T](ApiModel):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False

    @model_validator(mode="after")
    def validate_cursor_state(self) -> Self:
        if self.has_more and self.next_cursor is None:
            raise ValueError("next_cursor is required when has_more=true")
        if not self.has_more and self.next_cursor is not None:
            raise ValueError("next_cursor must be absent when has_more=false")
        return self
