"""Append-only human talent pipeline events."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import domain_table, string_field, typed_field, uuid_field

talent_pipeline_events = domain_table(
    "talent_pipeline_events",
    uuid_field("candidate_id", "persons.id"),
    uuid_field("hr_id", "persons.id"),
    string_field("stage", 32),
    string_field("note", 500),
    typed_field("occurred_at", DateTime(timezone=True)),
    uniques=(("candidate_id", "hr_id", "stage"),),
)
