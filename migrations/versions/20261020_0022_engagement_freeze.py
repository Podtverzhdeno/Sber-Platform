"""Versioned freeze inventory and service-block audit for engagement.

Revision ID: 20261020_0022
Revises: 20261020_0021
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0022"
down_revision: str | Sequence[str] | None = "20261020_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "freeze_days",
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
        sa.Column("local_date", sa.Date(), nullable=True),
        sa.CheckConstraint("version > 0", name=op.f("ck_freeze_days_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_freeze_days_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_freeze_days")),
    )
    op.create_table(
        "freeze_exceptions",
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
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("scope", sa.String(96), nullable=False),
        sa.Column("explanation", sa.String(400), nullable=False),
        sa.CheckConstraint(
            "version > 0", name=op.f("ck_freeze_exceptions_version_positive")
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_freeze_exceptions_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_freeze_exceptions")),
    )


def downgrade() -> None:
    op.drop_table("freeze_exceptions")
    op.drop_table("freeze_days")
