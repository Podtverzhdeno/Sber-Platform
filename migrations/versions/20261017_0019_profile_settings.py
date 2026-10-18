"""Persist profile skills with provenance.

Revision ID: 20261017_0019
Revises: 20261017_0018
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261017_0019"
down_revision: str | Sequence[str] | None = "20261017_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "profile_skills",
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
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("origin", sa.String(32), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_profile_skills_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_profile_skills_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_profile_skills")),
        sa.UniqueConstraint(
            "person_id",
            "title",
            "origin",
            name="uq_profile_skills_person_id_title_origin",
        ),
    )
    op.create_index("ix_profile_skills_person_id", "profile_skills", ["person_id"])


def downgrade() -> None:
    op.drop_index("ix_profile_skills_person_id", table_name="profile_skills")
    op.drop_table("profile_skills")
