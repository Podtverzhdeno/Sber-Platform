"""Expand immutable compensation snapshot fields.

Revision ID: 20260927_0004
Revises: 20260927_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260927_0004"
down_revision: str | None = "20260927_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "compensation_terms",
        sa.Column("quantum", sa.Numeric(18, 4), nullable=False, server_default="0.01"),
    )
    op.add_column(
        "compensation_terms",
        sa.Column("rounding_mode", sa.String(32), nullable=False, server_default="half_up"),
    )
    op.add_column(
        "compensation_terms",
        sa.Column("policy_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "compensation_terms",
        sa.Column(
            "payout_condition",
            sa.String(1000),
            nullable=False,
            server_default="Принятый личный вклад и опубликованная человеком оценка.",
        ),
    )
    for column in ("quantum", "rounding_mode", "policy_version", "payout_condition"):
        op.alter_column("compensation_terms", column, server_default=None)


def downgrade() -> None:
    op.drop_column("compensation_terms", "payout_condition")
    op.drop_column("compensation_terms", "policy_version")
    op.drop_column("compensation_terms", "rounding_mode")
    op.drop_column("compensation_terms", "quantum")
