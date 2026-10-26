"""Persist the learner-chosen self-service practical task with their submission.

Revision ID: 20261026_0035
Revises: 20261025_0034
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261026_0035"
down_revision: str | Sequence[str] | None = "20261025_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "impulse_practical_submissions",
        sa.Column("practice_task_key", sa.String(32), nullable=True),
    )
    op.create_check_constraint(
        "ck_impulse_practice_task_key",
        "impulse_practical_submissions",
        "practice_task_key IS NULL OR practice_task_key ~ '^lesson:[0-7]$'",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_impulse_practice_task_key", "impulse_practical_submissions", type_="check"
    )
    op.drop_column("impulse_practical_submissions", "practice_task_key")
