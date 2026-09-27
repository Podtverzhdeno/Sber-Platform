"""Protect audit and domain event history from mutation.

Revision ID: 20260927_0003
Revises: 20260927_0002
Create Date: 2026-09-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260927_0003"
down_revision: str | Sequence[str] | None = "20260927_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION impulse_reject_history_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'append-only history cannot be changed';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in ("audit_entries", "domain_events"):
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_append_only
            BEFORE UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION impulse_reject_history_mutation();
            """
        )


def downgrade() -> None:
    for table in ("audit_entries", "domain_events"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_append_only ON {table};")
    op.execute("DROP FUNCTION IF EXISTS impulse_reject_history_mutation();")
