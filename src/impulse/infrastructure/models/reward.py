"""5+ reviews, immutable compensation terms and payout records."""

from sqlalchemy import Boolean, Numeric

from impulse.infrastructure.models.base import (
    domain_table,
    integer_field,
    string_field,
    typed_field,
    uuid_field,
)

review_rubrics = domain_table(
    "review_rubrics",
    string_field("rubric_key", 96),
    integer_field("rubric_version"),
    uniques=(("rubric_key", "rubric_version"),),
)
review_5plus_versions = domain_table(
    "review_5plus_versions",
    uuid_field("contribution_id", "contributions.id"),
    uuid_field("rubric_id", "review_rubrics.id"),
    integer_field("review_version"),
    string_field("grade", 8, nullable=True),
    uniques=(("contribution_id", "review_version"),),
)
compensation_terms = domain_table(
    "compensation_terms",
    uuid_field("task_terms_version_id", "task_terms_versions.id"),
    typed_field("paid", Boolean()),
    typed_field("base_amount", Numeric(18, 2), nullable=True),
    typed_field("b_multiplier", Numeric(4, 2)),
    typed_field("a_multiplier", Numeric(4, 2)),
    typed_field("quantum", Numeric(18, 4)),
    string_field("rounding_mode", 32),
    integer_field("policy_version"),
    string_field("payout_condition", 1000),
    string_field("currency", 3, nullable=True),
    uniques=(("task_terms_version_id",),),
)
payout_claims = domain_table(
    "payout_claims",
    uuid_field("assignment_id", "assignments.id"),
    integer_field("contribution_version"),
    integer_field("terms_version"),
    typed_field("amount", Numeric(18, 2)),
    string_field("currency", 3),
    uniques=(("assignment_id", "contribution_version", "terms_version"),),
)
settlement_attempts = domain_table(
    "settlement_attempts",
    uuid_field("payout_claim_id", "payout_claims.id"),
    integer_field("attempt_number"),
    string_field("provider_reference", 160, nullable=True),
    uniques=(("payout_claim_id", "attempt_number"),),
)
