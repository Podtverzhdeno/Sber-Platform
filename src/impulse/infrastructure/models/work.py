"""R&D/MVP projects, tasks, applications and contribution evidence."""

from sqlalchemy import DateTime

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

projects = domain_table(
    "projects",
    string_field("project_key", 96),
    string_field("title", 200),
    uniques=(("project_key",),),
)
tasks = domain_table(
    "tasks",
    uuid_field("project_id", "projects.id"),
    uuid_field("customer_id", "persons.id"),
    string_field("task_key", 96),
    uniques=(("project_id", "task_key"),),
)
task_terms_versions = domain_table(
    "task_terms_versions",
    uuid_field("task_id", "tasks.id"),
    integer_field("terms_version"),
    typed_field("deadline_at", DateTime(timezone=True)),
    uniques=(("task_id", "terms_version"),),
)
applications = domain_table(
    "applications",
    uuid_field("task_id", "tasks.id"),
    uuid_field("person_id", "persons.id"),
    integer_field("accepted_terms_version"),
    uniques=(("task_id", "person_id"),),
)
assignments = domain_table(
    "assignments",
    uuid_field("task_id", "tasks.id"),
    uuid_field("person_id", "persons.id"),
    uuid_field("application_id", "applications.id"),
    uniques=(("task_id", "person_id"), ("application_id",)),
)
contributions = domain_table(
    "contributions",
    uuid_field("assignment_id", "assignments.id"),
    integer_field("contribution_version"),
    string_field("summary", 2000),
    uniques=(("assignment_id", "contribution_version"),),
)
artifacts = domain_table(
    "artifacts",
    uuid_field("contribution_id", "contributions.id"),
    string_field("artifact_key", 128),
    string_field("uri", 2048),
    uniques=(("contribution_id", "artifact_key"),),
)
acceptances = domain_table(
    "acceptances",
    uuid_field("contribution_id", "contributions.id"),
    uuid_field("decided_by", "persons.id"),
    integer_field("contribution_version"),
    uniques=(("contribution_id", "contribution_version"),),
)
appeals = domain_table(
    "appeals",
    uuid_field("person_id", "persons.id"),
    string_field("subject_type", 64),
    uuid_field("subject_id"),
    integer_field("subject_version"),
    uniques=(("person_id", "subject_type", "subject_id", "subject_version"),),
)
