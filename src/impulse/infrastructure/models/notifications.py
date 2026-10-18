"""Per-person notification feed rows."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    string_field,
    typed_field,
    uuid_field,
)

notifications = domain_table(
    "notifications",
    uuid_field("person_id", "persons.id"),
    string_field("kind", 32),
    string_field("title", 255),
    string_field("body", 1000),
    string_field("entity_type", 64, nullable=True),
    uuid_field("entity_id", nullable=True),
    typed_field("read_at", DateTime(timezone=True), nullable=True),
)
