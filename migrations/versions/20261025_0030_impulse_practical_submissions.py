"""Record authentic practice submissions separately from self-paced course completion.

Revision ID: 20261025_0030
Revises: 20261025_0029
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0030"
down_revision: str | Sequence[str] | None = "20261025_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table(
        "impulse_practical_submissions",
        sa.Column("person_id", sa.UUID(), sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_key", sa.String(96), nullable=False),
        sa.Column("description", sa.String(5000), nullable=False),
        sa.Column("artifact_url", sa.String(2000), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("person_id", "course_key", name="pk_impulse_practical_submissions"),
        sa.CheckConstraint("status IN ('pending','approved','needs_revision')", name="ck_impulse_practice_status"),
    )

def downgrade() -> None:
    op.drop_table("impulse_practical_submissions")
