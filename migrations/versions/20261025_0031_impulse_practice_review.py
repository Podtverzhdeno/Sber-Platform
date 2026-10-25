"""Add separate verified practical knowledge certificate and reviewer trace.

Revision ID: 20261025_0031
Revises: 20261025_0030
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0031"
down_revision: str | Sequence[str] | None = "20261025_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "impulse_practical_submissions",
        sa.Column("practical_certificate_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "impulse_practical_submissions",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "impulse_practical_submissions",
        sa.Column("reviewed_by", sa.UUID(), sa.ForeignKey("persons.id"), nullable=True),
    )
    op.create_unique_constraint(
        "uq_impulse_practice_certificate_id",
        "impulse_practical_submissions",
        ["practical_certificate_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_impulse_practice_certificate_id", "impulse_practical_submissions", type_="unique"
    )
    op.drop_column("impulse_practical_submissions", "reviewed_by")
    op.drop_column("impulse_practical_submissions", "reviewed_at")
    op.drop_column("impulse_practical_submissions", "practical_certificate_id")
