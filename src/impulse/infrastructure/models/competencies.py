"""Versioned competency frameworks and evidence-anchored observed levels."""

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    uuid_field,
)

competency_models = domain_table(
    "competency_models",
    string_field("framework_key", 96),
    string_field("domain", 32),
    integer_field("framework_version"),
    string_field("title", 255),
    uniques=(("framework_key", "framework_version"),),
)

competency_definitions = domain_table(
    "competency_definitions",
    uuid_field("model_id", "competency_models.id"),
    string_field("competency_key", 120),
    string_field("title", 255),
    uniques=(("model_id", "competency_key"),),
)

competency_evidence = domain_table(
    "competency_evidence",
    uuid_field("person_id", "persons.id"),
    string_field("competency_key", 120),
    string_field("source_kind", 32),
    string_field("source_ref", 200),
    string_field("level", 64),
    uniques=(("person_id", "competency_key", "source_kind", "source_ref"),),
)
