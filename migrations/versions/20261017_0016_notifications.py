"""Persist the per-person notification feed.

Revision ID: 20261017_0016
Revises: 20261017_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261017_0016"
down_revision: str | Sequence[str] | None = "20261017_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _domain_columns() -> list[sa.Column]:
    return [
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
        "notifications",
        *_domain_columns(),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.String(1000), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version > 0", name=op.f("ck_notifications_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_notifications_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index(
        "ix_notifications_person_id_read_at",
        "notifications",
        ["person_id", "read_at"],
    )
    op.create_index(
        "ix_notifications_person_id_created_at",
        "notifications",
        ["person_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_person_id_created_at", table_name="notifications")
    op.drop_index("ix_notifications_person_id_read_at", table_name="notifications")
    op.drop_table("notifications")
