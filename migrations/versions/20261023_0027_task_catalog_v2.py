"""Participant task bookmarks for catalog v2.

Revision ID: 20261023_0027
Revises: 20261022_0026
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261023_0027"
down_revision: str | Sequence[str] | None = "20261022_0026"
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
        "task_bookmarks",
        *_DOMAIN_COLUMNS,
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_task_bookmarks_task_id_tasks"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            name=op.f("fk_task_bookmarks_person_id_persons"),
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "task_id", "person_id", name=op.f("uq_task_bookmarks_task_id_person_id")
        ),
        sa.CheckConstraint("version > 0", name=op.f("ck_task_bookmarks_version_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_bookmarks")),
    )
    op.create_index(
        op.f("ix_task_bookmarks_person_task"),
        "task_bookmarks",
        ["person_id", "task_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_task_bookmarks_person_task"), table_name="task_bookmarks")
    op.drop_table("task_bookmarks")
