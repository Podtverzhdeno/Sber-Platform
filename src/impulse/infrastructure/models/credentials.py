"""Verified documents: course certificates and customer-signed project credentials."""

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    uuid_field,
)

course_certificates = domain_table(
    "course_certificates",
    uuid_field("person_id", "persons.id"),
    string_field("course_key", 64),
    string_field("course_title", 255),
    string_field("verification_id", 64),
    uniques=(("person_id", "course_key"), ("verification_id",)),
)

project_credentials = domain_table(
    "project_credentials",
    uuid_field("person_id", "persons.id"),
    uuid_field("contribution_id", nullable=True),
    integer_field("contribution_version"),
    string_field("verification_id", 64),
    uniques=(("contribution_id", "contribution_version"), ("verification_id",)),
)
