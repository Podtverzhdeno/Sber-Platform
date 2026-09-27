"""Rating seasons, score ledger, credentials, trophies and offers."""

from sqlalchemy import Numeric

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

seasons = domain_table(
    "seasons",
    string_field("season_key", 96),
    string_field("title", 200),
    uniques=(("season_key",),),
)
rating_policies = domain_table(
    "rating_policies",
    uuid_field("season_id", "seasons.id"),
    integer_field("policy_version"),
    uniques=(("season_id", "policy_version"),),
)
score_ledger = domain_table(
    "score_ledger",
    uuid_field("season_id", "seasons.id"),
    uuid_field("person_id", "persons.id"),
    string_field("source_type", 64),
    uuid_field("source_id"),
    string_field("rule_id", 96),
    typed_field("points", Numeric(18, 4)),
    uniques=(("season_id", "source_type", "source_id", "rule_id"),),
)
standings = domain_table(
    "standings",
    uuid_field("season_id", "seasons.id"),
    uuid_field("person_id", "persons.id"),
    integer_field("place"),
    typed_field("score", Numeric(18, 4)),
    uniques=(("season_id", "person_id"), ("season_id", "place")),
)
credentials = domain_table(
    "credentials",
    uuid_field("season_id", "seasons.id"),
    uuid_field("person_id", "persons.id"),
    string_field("verification_id", 128),
    integer_field("credential_version"),
    uniques=(("verification_id",), ("season_id", "person_id", "credential_version")),
)
trophies = domain_table(
    "trophies",
    uuid_field("person_id", "persons.id"),
    uuid_field("participation_claim_id", "participation_claims.id"),
    string_field("trophy_type", 64),
    uniques=(("person_id", "participation_claim_id", "trophy_type"),),
)
offer_evidence = domain_table(
    "offer_evidence",
    uuid_field("person_id", "persons.id"),
    string_field("provider", 96),
    string_field("external_id", 160),
    uniques=(("provider", "external_id"),),
)
