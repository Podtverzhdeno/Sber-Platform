"""Add unified operator cases.

Revision ID: 20260928_0010
Revises: 20260928_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260928_0010"
down_revision: str | Sequence[str] | None = "20260928_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def common() -> list[sa.Column]:
    json = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column("provenance", json, server_default="{}", nullable=False),
        sa.Column("payload", json, server_default="{}", nullable=False),
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
    ]


def upgrade() -> None:
    op.create_table(
        "operations_cases",
        *common(),
        sa.Column("case_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version > 0", name="ck_operations_cases_version_positive"),
    )
    op.create_table(
        "case_decisions",
        *common(),
        sa.Column(
            "case_id",
            sa.Uuid(),
            sa.ForeignKey("operations_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("case_version", sa.Integer(), nullable=False),
        sa.Column(
            "actor_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("outcome", sa.String(64), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_case_decisions_version_positive"),
        sa.UniqueConstraint(
            "case_id", "case_version", name="uq_case_decisions_case_id_case_version"
        ),
    )


def downgrade() -> None:
    op.drop_table("case_decisions")
    op.drop_table("operations_cases")
