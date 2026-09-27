"""Version payout claims by the final review version.

Revision ID: 20260927_0007
Revises: 20260927_0006
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260927_0007"
down_revision: str | None = "20260927_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_payout_claims_assignment_id_contribution_version__830d137a59",
        "payout_claims",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_payout_claims_assignment_id_contribution_version__8fc8641a5d",
        "payout_claims",
        ["assignment_id", "contribution_version", "terms_version", "review_version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_payout_claims_assignment_id_contribution_version__8fc8641a5d",
        "payout_claims",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_payout_claims_assignment_id_contribution_version__830d137a59",
        "payout_claims",
        ["assignment_id", "contribution_version", "terms_version"],
    )
