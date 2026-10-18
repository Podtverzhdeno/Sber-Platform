"""Messaging channels, memberships, messages, and read cursors."""

from sqlalchemy import Boolean

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

messaging_channels = domain_table(
    "messaging_channels",
    string_field("kind", 32),
    string_field("context_key", 160),
    string_field("title", 240, nullable=True),
    uuid_field("task_id", "tasks.id", nullable=True),
    uniques=(("kind", "context_key"),),
)
messaging_memberships = domain_table(
    "messaging_memberships",
    uuid_field("channel_id", "messaging_channels.id"),
    uuid_field("person_id", "persons.id"),
    string_field("role", 32),
    typed_field("muted", Boolean(), nullable=False),
    typed_field("sender_enabled", Boolean(), nullable=False),
    uniques=(("channel_id", "person_id"),),
)
messaging_messages = domain_table(
    "messaging_messages",
    uuid_field("channel_id", "messaging_channels.id"),
    uuid_field("author_id", "persons.id", nullable=True),
    string_field("kind", 16),
    string_field("body", 4000),
    integer_field("sequence"),
    uniques=(("channel_id", "sequence"),),
)
messaging_read_cursors = domain_table(
    "messaging_read_cursors",
    uuid_field("channel_id", "messaging_channels.id"),
    uuid_field("person_id", "persons.id"),
    integer_field("last_sequence"),
    uniques=(("channel_id", "person_id"),),
)
