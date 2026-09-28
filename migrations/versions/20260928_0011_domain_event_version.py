"""Add entity version to domain event envelope.

Revision ID: 20260928_0011
Revises: 20260928_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260928_0011"
down_revision: str | Sequence[str] | None = "20260928_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "domain_events",
        sa.Column("entity_version", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("domain_events", "entity_version")
