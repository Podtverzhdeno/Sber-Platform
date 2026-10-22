"""Persistent Buddy conversation tables (restart-safe history, 29.3)."""

from sqlalchemy import Boolean, DateTime, Text

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

buddy_threads = domain_table(
    "buddy_threads",
    uuid_field("owner_id", "persons.id"),
    typed_field("content_deleted", Boolean()),
)
buddy_messages = domain_table(
    "buddy_messages",
    uuid_field("thread_id", "buddy_threads.id"),
    string_field("client_message_id", 128),
    string_field("role", 24),
    typed_field("content", Text()),
    uniques=(("thread_id", "client_message_id"),),
)
buddy_feedback = domain_table(
    "buddy_feedback",
    uuid_field("thread_id", "buddy_threads.id"),
    uuid_field("actor_id", "persons.id"),
    integer_field("rating"),
    uniques=(("thread_id", "actor_id"),),
)
buddy_memory_suppression = domain_table(
    "buddy_memory_suppression",
    uuid_field("person_id", "persons.id"),
    uniques=(("person_id",),),
)
buddy_suggestion_states = domain_table(
    "buddy_suggestion_states",
    uuid_field("person_id", "persons.id"),
    string_field("suggestion_id", 192),
    string_field("state", 24),
    typed_field("snoozed_until", DateTime(timezone=True), nullable=True),
    uniques=(("person_id", "suggestion_id", "state"),),
)
buddy_deletion_audits = domain_table(
    "buddy_deletion_audits",
    uuid_field("owner_id", "persons.id"),
    string_field("reason", 64),
    integer_field("deleted_messages"),
    typed_field("completed_at", DateTime(timezone=True)),
)
