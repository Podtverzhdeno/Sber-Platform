"""Synchronize seven demo AI career labels without modifying learner state.

Revision ID: 20261025_0028
Revises: 20261023_0027

Only tracks owned by the synthetic demo seed are updated. Slugs/UUIDs,
roadmap milestones, track attempts, verified outcomes and grade policies
are not touched. Production-owned tracks are intentionally excluded.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0028"
down_revision: str | Sequence[str] | None = "20261023_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AI_ROLE_TITLES = {
    "product": "AI Architect",
    "ml": "AI Engineer",
    "python": "AI Security Engineer",
    "data": "AI Data Engineer",
    "backend": "MLOps Engineer",
    "design": "AI Agent Engineer",
    "manager": "AI Product Engineer",
}


def upgrade() -> None:
    # A narrow, idempotent UPDATE avoids a destructive demo reseed.
    # Preserve every stable key and any existing participant progress.
    for slug, title in AI_ROLE_TITLES.items():
        op.execute(
            sa.text(
                "UPDATE tracks SET title = :title "
                "WHERE slug = :slug AND data_origin = 'demo_seed' "
                "AND title IS DISTINCT FROM :title"
            ).bindparams(slug=slug, title=title)
        )


def downgrade() -> None:
    # Retain canonical titles: reverting them could overwrite subsequent
    # edits and resurrect obsolete role names while user attempts persist.
    pass
