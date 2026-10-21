"""Versioned weekly rhythm agreements for the engagement popover.

Revision ID: 20261020_0023
Revises: 20261020_0022
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0023"
down_revision: str | Sequence[str] | None = "20261020_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "weekly_rhythm_versions",
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
        sa.Column("rhythm_version", sa.Integer(), nullable=False),
        sa.Column("preset", sa.String(32), nullable=False),
        sa.Column("active_days", sa.String(32), nullable=False),
        sa.Column("reminder_hour", sa.Integer(), nullable=False),
        sa.Column("reminder_window_hours", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.UniqueConstraint(
            "person_id",
            "rhythm_version",
            name=op.f("uq_weekly_rhythm_versions_person_id_rhythm_version"),
        ),
        sa.CheckConstraint(
            "version > 0", name=op.f("ck_weekly_rhythm_versions_version_positive")
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_weekly_rhythm_versions_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_weekly_rhythm_versions")),
    )


def downgrade() -> None:
    op.drop_table("weekly_rhythm_versions")
