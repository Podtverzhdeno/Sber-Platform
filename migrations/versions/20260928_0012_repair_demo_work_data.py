"""Repair demo task lifecycle and unpaid compensation rows.

Revision ID: 20260928_0012
Revises: 20260928_0011
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260928_0012"
down_revision: str | Sequence[str] | None = "20260928_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Task lifecycle describes publication, while execution progress belongs to
    # assignments. Older demo seeds accidentally stored assignment statuses on
    # task aggregates, which made domain hydration fail.
    op.execute(
        """
        UPDATE tasks
        SET status = 'published',
            version = version + 1,
            updated_at = now()
        WHERE data_origin = 'demo_seed'
          AND status IN ('accepted', 'in_progress')
        """
    )
    op.execute(
        """
        UPDATE compensation_terms
        SET base_amount = NULL,
            currency = NULL,
            version = version + 1,
            updated_at = now()
        WHERE data_origin = 'demo_seed'
          AND paid = false
          AND (base_amount IS NOT NULL OR currency IS NOT NULL)
        """
    )
    op.execute(
        """
        UPDATE compensation_terms
        SET base_amount = COALESCE(base_amount, 50000),
            currency = COALESCE(currency, 'RUB'),
            version = version + 1,
            updated_at = now()
        WHERE data_origin = 'demo_seed'
          AND paid = true
          AND (base_amount IS NULL OR currency IS NULL)
        """
    )


def downgrade() -> None:
    # The previous values violate current domain invariants and cannot be
    # restored safely. Downgrade intentionally keeps the repaired demo rows.
    pass
