"""Persist messaging channels, memberships, messages and read cursors.

Revision ID: 20261017_0014
Revises: 20260930_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261017_0014"
down_revision: str | Sequence[str] | None = "20260930_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _domain_columns(status_default: str) -> list[sa.Column]:
    json = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default=status_default, nullable=False),
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
        "messaging_channels",
        *_domain_columns("active"),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("context_key", sa.String(160), nullable=False),
        sa.Column("title", sa.String(240), nullable=True),
        sa.Column(
            "task_id", sa.Uuid(), sa.ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=True
        ),
        sa.CheckConstraint("version > 0", name="ck_messaging_channels_version_positive"),
        sa.UniqueConstraint("kind", "context_key", name="uq_messaging_channels_kind_context_key"),
    )
    op.create_table(
        "messaging_memberships",
        *_domain_columns("active"),
        sa.Column(
            "channel_id",
            sa.Uuid(),
            sa.ForeignKey("messaging_channels.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "person_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("muted", sa.Boolean(), nullable=False),
        sa.Column("sender_enabled", sa.Boolean(), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_messaging_memberships_version_positive"),
        sa.UniqueConstraint(
            "channel_id", "person_id", name="uq_messaging_memberships_channel_id_person_id"
        ),
    )
    op.create_table(
        "messaging_messages",
        *_domain_columns("active"),
        sa.Column(
            "channel_id",
            sa.Uuid(),
            sa.ForeignKey("messaging_channels.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "author_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=True
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("body", sa.String(4000), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_messaging_messages_version_positive"),
        sa.UniqueConstraint(
            "channel_id", "sequence", name="uq_messaging_messages_channel_id_sequence"
        ),
    )
    op.create_table(
        "messaging_read_cursors",
        *_domain_columns("active"),
        sa.Column(
            "channel_id",
            sa.Uuid(),
            sa.ForeignKey("messaging_channels.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "person_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("last_sequence", sa.Integer(), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_messaging_read_cursors_version_positive"),
        sa.UniqueConstraint(
            "channel_id", "person_id", name="uq_messaging_read_cursors_channel_id_person_id"
        ),
    )


def downgrade() -> None:
    op.drop_table("messaging_read_cursors")
    op.drop_table("messaging_messages")
    op.drop_table("messaging_memberships")
    op.drop_table("messaging_channels")
