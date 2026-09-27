"""Identity, role, session and consent tables."""

from sqlalchemy import Boolean, DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    string_field,
    typed_field,
    uuid_field,
)

persons = domain_table(
    "persons",
    string_field("display_name", 160),
    string_field("external_key", 160),
    uniques=(("external_key",),),
)
actor_roles = domain_table(
    "actor_roles",
    uuid_field("person_id", "persons.id"),
    string_field("role", 48),
    string_field("program_key", 96),
    uniques=(("person_id", "role", "program_key"),),
)
sessions = domain_table(
    "sessions",
    uuid_field("person_id", "persons.id"),
    string_field("token_digest", 128),
    typed_field("expires_at", DateTime(timezone=True)),
    uniques=(("token_digest",),),
)
consents = domain_table(
    "consents",
    uuid_field("person_id", "persons.id"),
    string_field("scope", 64),
    typed_field("granted", Boolean()),
    uniques=(("person_id", "scope", "version"),),
)
visibility_settings = domain_table(
    "visibility_settings",
    uuid_field("person_id", "persons.id"),
    string_field("scope", 64),
    typed_field("visible", Boolean()),
    uniques=(("person_id", "scope"),),
)
