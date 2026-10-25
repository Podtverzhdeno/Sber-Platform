"""Persist self-paced Impulse course progress independently of provider certificates.

Revision ID: 20261025_0029
Revises: 20261025_0028
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0029"
down_revision: str | Sequence[str] | None = "20261025_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "impulse_course_progress",
        sa.Column(
            "person_id", sa.UUID(), sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("course_key", sa.String(length=96), nullable=False),
        sa.Column("completed_units", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_units", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certificate_id", sa.UUID(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("person_id", "course_key", name="pk_impulse_course_progress"),
        sa.UniqueConstraint("certificate_id", name="uq_impulse_course_certificate_id"),
        sa.CheckConstraint(
            "completed_units >= 0 AND completed_units <= total_units AND total_units = 8",
            name="ck_impulse_progress_range",
        ),
    )


def downgrade() -> None:
    op.drop_table("impulse_course_progress")
