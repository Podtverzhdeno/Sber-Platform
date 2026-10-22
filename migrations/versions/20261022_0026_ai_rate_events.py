"""Shared cross-instance AI rate-limit buckets.

Revision ID: 20261022_0026
Revises: 20261022_0025
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261022_0026"
down_revision: str | Sequence[str] | None = "20261022_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

_DOMAIN_COLUMNS = [
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
]


def upgrade() -> None:
    op.create_table(
        "ai_rate_events",
        *_DOMAIN_COLUMNS,
        sa.Column("category", sa.String(24), nullable=False),
        sa.Column("actor_key", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_ai_rate_events_version_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_rate_events")),
    )
    op.create_index(
        op.f("ix_ai_rate_events_bucket_timeline"),
        "ai_rate_events",
        ["category", "actor_key", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_rate_events_bucket_timeline"), table_name="ai_rate_events")
    op.drop_table("ai_rate_events")
