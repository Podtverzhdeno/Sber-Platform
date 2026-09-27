"""Add stable identity to append-only 5+ review versions.

Revision ID: 20260927_0005
Revises: 20260927_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260927_0005"
down_revision: str | None = "20260927_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "review_5plus_versions",
        sa.Column("review_id", sa.Uuid(), nullable=True),
    )
    op.execute("UPDATE review_5plus_versions SET review_id = id WHERE review_id IS NULL")
    op.alter_column("review_5plus_versions", "review_id", nullable=False)
    op.create_unique_constraint(
        "uq_review_5plus_versions_review_id_review_version",
        "review_5plus_versions",
        ["review_id", "review_version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_review_5plus_versions_review_id_review_version",
        "review_5plus_versions",
        type_="unique",
    )
    op.drop_column("review_5plus_versions", "review_id")
