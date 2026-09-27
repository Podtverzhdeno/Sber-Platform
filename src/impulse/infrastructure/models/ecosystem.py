"""Events, programs and verified external participation evidence."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    string_field,
    typed_field,
    uuid_field,
)

external_sources = domain_table(
    "external_sources",
    string_field("provider", 96),
    string_field("source_key", 128),
    string_field("source_url", 2048),
    uniques=(("provider", "source_key"),),
)
programs = domain_table(
    "programs",
    string_field("program_key", 128),
    string_field("title", 200),
    uuid_field("source_id", "external_sources.id"),
    uniques=(("program_key",),),
)
events = domain_table(
    "events",
    uuid_field("program_id", "programs.id", nullable=True),
    string_field("event_key", 128),
    string_field("title", 200),
    typed_field("deadline_at", DateTime(timezone=True), nullable=True),
    uuid_field("source_id", "external_sources.id"),
    uniques=(("event_key",),),
)
participation_claims = domain_table(
    "participation_claims",
    uuid_field("person_id", "persons.id"),
    uuid_field("event_id", "events.id"),
    string_field("claim_type", 64),
    uniques=(("person_id", "event_id", "claim_type"),),
)
provider_records = domain_table(
    "provider_records",
    string_field("provider_id", 96),
    string_field("external_id", 160),
    uuid_field("source_id", "external_sources.id"),
    uniques=(("provider_id", "external_id"),),
)
