"""Versioned monthly goal plans for the participant home card.

Revision ID: 20261020_0024
Revises: 20261020_0023
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0024"
down_revision: str | Sequence[str] | None = "20261020_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "monthly_goal_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column("provenance", JSON, server_default="{}", nullable=False),
        sa.Column("payload", JSON, server_default="{}", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column("track_key", sa.String(96), nullable=False),
        sa.Column("milestone_key", sa.String(96), nullable=False),
        sa.Column("baseline_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint(
            "person_id",
            "period",
            "plan_version",
            name=op.f("uq_monthly_goal_plans_person_id_period_plan_version"),
        ),
        sa.CheckConstraint("version > 0", name=op.f("ck_monthly_goal_plans_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_monthly_goal_plans_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_monthly_goal_plans")),
    )


def downgrade() -> None:
    op.drop_table("monthly_goal_plans")
