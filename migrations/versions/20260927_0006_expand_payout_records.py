"""Expand payout claims and settlement attempts.

Revision ID: 20260927_0006
Revises: 20260927_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260927_0006"
down_revision: str | None = "20260927_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("payout_claims", sa.Column("review_id", sa.Uuid(), nullable=True))
    op.add_column("payout_claims", sa.Column("review_version", sa.Integer(), nullable=True))
    op.add_column("payout_claims", sa.Column("grade", sa.String(length=8), nullable=True))
    op.add_column("payout_claims", sa.Column("approved_by", sa.Uuid(), nullable=True))
    op.alter_column("payout_claims", "amount", nullable=True)
    op.alter_column("payout_claims", "currency", nullable=True)
    op.execute("UPDATE payout_claims SET review_id = id WHERE review_id IS NULL")
    op.execute("UPDATE payout_claims SET review_version = 1 WHERE review_version IS NULL")
    op.execute("UPDATE payout_claims SET grade = 'B' WHERE grade IS NULL")
    op.alter_column("payout_claims", "review_id", nullable=False)
    op.alter_column("payout_claims", "review_version", nullable=False)
    op.alter_column("payout_claims", "grade", nullable=False)

    op.add_column(
        "settlement_attempts",
        sa.Column("request_key", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "settlement_attempts",
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="payment"),
    )
    op.add_column(
        "settlement_attempts",
        sa.Column("demo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute("UPDATE settlement_attempts SET request_key = id::text WHERE request_key IS NULL")
    op.alter_column("settlement_attempts", "request_key", nullable=False)
    op.alter_column("settlement_attempts", "kind", server_default=None)
    op.alter_column("settlement_attempts", "demo", server_default=None)
    op.create_unique_constraint(
        "uq_settlement_attempts_payout_claim_id_request_key",
        "settlement_attempts",
        ["payout_claim_id", "request_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_settlement_attempts_payout_claim_id_request_key",
        "settlement_attempts",
        type_="unique",
    )
    op.drop_column("settlement_attempts", "demo")
    op.drop_column("settlement_attempts", "kind")
    op.drop_column("settlement_attempts", "request_key")
    op.alter_column("payout_claims", "currency", nullable=False)
    op.alter_column("payout_claims", "amount", nullable=False)
    op.drop_column("payout_claims", "approved_by")
    op.drop_column("payout_claims", "grade")
    op.drop_column("payout_claims", "review_version")
    op.drop_column("payout_claims", "review_id")
