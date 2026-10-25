"""Server-owned Impulse role levels; independent of corporate career grades.

Revision ID: 20261025_0034
Revises: 20261025_0033
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0034"
down_revision: str | Sequence[str] | None = "20261025_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "impulse_role_levels",
        sa.Column("person_id", sa.Uuid(), sa.ForeignKey("persons.id"), nullable=False),
        sa.Column("track_key", sa.String(96), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cycle_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("advanced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("policy_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("history", sa.JSON(), nullable=False, server_default="[]"),
        sa.PrimaryKeyConstraint("person_id", "track_key", name="pk_impulse_role_levels"),
        sa.CheckConstraint("level >= 0 AND level <= 10", name="ck_impulse_level_range"),
        sa.CheckConstraint("cycle_number = level + 1", name="ck_impulse_cycle_matches_level"),
    )


def downgrade() -> None:
    op.drop_table("impulse_role_levels")
