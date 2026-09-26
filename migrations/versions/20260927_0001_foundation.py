"""Create the initial migration head.

Revision ID: 20260927_0001
Revises:
Create Date: 2026-09-27
"""

from collections.abc import Sequence

revision: str = "20260927_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Foundation head; domain tables arrive in the next revision."""


def downgrade() -> None:
    """No schema objects exist in the foundation revision."""
