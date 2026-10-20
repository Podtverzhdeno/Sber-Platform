"""Discussion of task deadlines across terms versions.

Revision ID: 20261020_0020
Revises: 20261017_0019
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0020"
down_revision: str | Sequence[str] | None = "20261017_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "deadline_requests",
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
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("addressee_id", sa.Uuid(), nullable=False),
        sa.Column("base_terms_version", sa.Integer(), nullable=False),
        sa.Column("proposed_deadline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("impact", sa.String(1000), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_comment", sa.String(1000), nullable=True),
        sa.CheckConstraint(
            "version > 0",
            name=op.f("ck_deadline_requests_version_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["addressee_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_deadline_requests_addressee_id_persons"),
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_deadline_requests_requested_by_persons"),
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            ondelete="RESTRICT",
            name=op.f("fk_deadline_requests_task_id_tasks"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deadline_requests")),
    )


def downgrade() -> None:
    op.drop_table("deadline_requests")
