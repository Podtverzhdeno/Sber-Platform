"""Shared AI rate-limit event rows (openspec 29.4)."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    string_field,
    typed_field,
)

ai_rate_events = domain_table(
    "ai_rate_events",
    string_field("category", 24),
    string_field("actor_key", 64),
    typed_field("occurred_at", DateTime(timezone=True)),
)
