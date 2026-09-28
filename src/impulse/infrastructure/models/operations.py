"""Operator cases and append-only human decisions."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

operations_cases = domain_table(
    "operations_cases",
    string_field("case_type", 64),
    string_field("title", 240),
    string_field("priority", 16),
    typed_field("due_at", DateTime(timezone=True), nullable=True),
)
case_decisions = domain_table(
    "case_decisions",
    uuid_field("case_id", "operations_cases.id"),
    integer_field("case_version"),
    uuid_field("actor_id", "persons.id"),
    string_field("outcome", 64),
    string_field("reason", 1000),
    uniques=(("case_id", "case_version"),),
)
