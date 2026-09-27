"""Protect non-seed score ledger history from mutation.

Revision ID: 20260928_0008
Revises: 20260927_0007
Create Date: 2026-09-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260928_0008"
down_revision: str | Sequence[str] | None = "20260927_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION impulse_reject_score_mutation()
        RETURNS trigger AS $$
        BEGIN
            IF OLD.data_origin <> 'demo_seed'
               AND current_setting('impulse.demo_reset', true) IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'score ledger is append-only';
            END IF;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_score_ledger_append_only
        BEFORE UPDATE OR DELETE ON score_ledger
        FOR EACH ROW EXECUTE FUNCTION impulse_reject_score_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_score_ledger_append_only ON score_ledger;")
    op.execute("DROP FUNCTION IF EXISTS impulse_reject_score_mutation();")
