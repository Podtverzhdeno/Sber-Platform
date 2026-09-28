"""Append-only domain events, audit entries and metric snapshots."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

domain_events = domain_table(
    "domain_events",
    string_field("event_key", 128),
    string_field("event_type", 128),
    integer_field("schema_version"),
    string_field("entity_type", 64),
    uuid_field("entity_id"),
    integer_field("entity_version"),
    typed_field("occurred_at", DateTime(timezone=True)),
    uniques=(("event_key",),),
)
audit_entries = domain_table(
    "audit_entries",
    string_field("action", 96),
    string_field("entity_type", 64),
    uuid_field("entity_id"),
    integer_field("entity_version"),
    uuid_field("actor_id", "persons.id", nullable=True),
    uniques=(("entity_type", "entity_id", "entity_version", "action"),),
)
metric_snapshots = domain_table(
    "metric_snapshots",
    string_field("metric_key", 128),
    string_field("cohort_key", 128),
    typed_field("period_start", DateTime(timezone=True)),
    typed_field("period_end", DateTime(timezone=True)),
    uniques=(("metric_key", "cohort_key", "period_start", "period_end"),),
)
