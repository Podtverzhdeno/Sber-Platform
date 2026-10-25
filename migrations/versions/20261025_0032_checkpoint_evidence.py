"""Persist participant checkpoint submissions and private evidence attachments.

Revision ID: 20261025_0032
Revises: 20261025_0031
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0032"
down_revision: str | Sequence[str] | None = "20261025_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "checkpoint_evidence_files",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "assignment_id", sa.UUID(),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("person_id", sa.UUID(), sa.ForeignKey("persons.id"), nullable=False),
        sa.Column("checkpoint_key", sa.String(128), nullable=False),
        sa.Column("contribution_id", sa.UUID(), sa.ForeignKey("contributions.id"), nullable=True),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.CheckConstraint("size_bytes > 0 AND size_bytes <= 5242880", name="ck_checkpoint_evidence_size"),
    )
    op.create_index(
        "ix_checkpoint_evidence_assignment", "checkpoint_evidence_files",
        ["assignment_id", "checkpoint_key"],
    )
    op.create_table(
        "checkpoint_submissions",
        sa.Column(
            "contribution_id", sa.UUID(),
            sa.ForeignKey("contributions.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column(
            "assignment_id", sa.UUID(),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("checkpoint_key", sa.String(128), nullable=False),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_checkpoint_submissions_assignment", "checkpoint_submissions",
        ["assignment_id", "checkpoint_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_checkpoint_submissions_assignment", table_name="checkpoint_submissions")
    op.drop_table("checkpoint_submissions")
    op.drop_index("ix_checkpoint_evidence_assignment", table_name="checkpoint_evidence_files")
    op.drop_table("checkpoint_evidence_files")
