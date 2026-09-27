"""Career tracks, roadmaps and Bootcamp learning tables."""

from sqlalchemy import Date

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

tracks = domain_table(
    "tracks", string_field("slug", 96), string_field("title", 160), uniques=(("slug",),)
)
track_attempts = domain_table(
    "track_attempts",
    uuid_field("person_id", "persons.id"),
    uuid_field("track_id", "tracks.id"),
    integer_field("attempt_number"),
    uniques=(("person_id", "track_id", "attempt_number"),),
)
roadmap_versions = domain_table(
    "roadmap_versions",
    uuid_field("track_id", "tracks.id"),
    integer_field("policy_version"),
    uniques=(("track_id", "policy_version"),),
)
milestones = domain_table(
    "milestones",
    uuid_field("roadmap_version_id", "roadmap_versions.id"),
    string_field("milestone_key", 96),
    integer_field("position"),
    uniques=(("roadmap_version_id", "milestone_key"),),
)
courses = domain_table(
    "courses", string_field("slug", 128), string_field("title", 200), uniques=(("slug",),)
)
course_track_links = domain_table(
    "course_track_links",
    uuid_field("course_id", "courses.id"),
    uuid_field("track_id", "tracks.id"),
    uniques=(("course_id", "track_id"),),
)
enrollments = domain_table(
    "enrollments",
    uuid_field("person_id", "persons.id"),
    uuid_field("course_id", "courses.id"),
    integer_field("attempt_number"),
    uniques=(("person_id", "course_id", "attempt_number"),),
)
learning_days = domain_table(
    "learning_days",
    uuid_field("enrollment_id", "enrollments.id"),
    typed_field("local_date", Date()),
    string_field("timezone", 64),
    uniques=(("enrollment_id", "local_date"),),
)
