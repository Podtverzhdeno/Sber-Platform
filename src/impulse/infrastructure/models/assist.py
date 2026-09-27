"""Agent threads, runs, suggestions and human decisions."""

from sqlalchemy import Integer

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

agent_threads = domain_table(
    "agent_threads",
    uuid_field("owner_id", "persons.id"),
    string_field("agent_kind", 48),
    string_field("thread_key", 128),
    uniques=(("owner_id", "thread_key"),),
)
agent_messages = domain_table(
    "agent_messages",
    uuid_field("thread_id", "agent_threads.id"),
    string_field("client_message_id", 128),
    string_field("role", 24),
    uniques=(("thread_id", "client_message_id"),),
)
agent_runs = domain_table(
    "agent_runs",
    uuid_field("actor_id", "persons.id"),
    uuid_field("thread_id", "agent_threads.id"),
    string_field("client_request_id", 128),
    string_field("model_policy_version", 96),
    uniques=(("actor_id", "client_request_id"),),
)
agent_suggestions = domain_table(
    "agent_suggestions",
    uuid_field("run_id", "agent_runs.id"),
    string_field("suggestion_type", 64),
    integer_field("source_version"),
    uniques=(("run_id", "suggestion_type"),),
)
human_decisions = domain_table(
    "human_decisions",
    uuid_field("suggestion_id", "agent_suggestions.id"),
    uuid_field("actor_id", "persons.id"),
    string_field("decision", 32),
    uniques=(("suggestion_id",),),
)
agent_feedback = domain_table(
    "agent_feedback",
    uuid_field("run_id", "agent_runs.id"),
    uuid_field("actor_id", "persons.id"),
    typed_field("rating", Integer()),
    uniques=(("run_id", "actor_id"),),
)
model_policies = domain_table(
    "model_policies",
    string_field("purpose", 64),
    integer_field("policy_version"),
    string_field("model_slug", 200),
    uniques=(("purpose", "policy_version"),),
)
