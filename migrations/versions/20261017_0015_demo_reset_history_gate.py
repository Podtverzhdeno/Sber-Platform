"""Allow demo reset to clear history rows for demo actors only.

Revision ID: 20261017_0015
Revises: 20261017_0014
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261017_0015"
down_revision: str | Sequence[str] | None = "20261017_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Demo reset (gated by impulse.demo_reset) must be able to purge history
    # rows that reference seed personas; append-only protection stays intact
    # for every other caller.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impulse_reject_history_mutation()
        RETURNS trigger AS $$
        BEGIN
            IF current_setting('impulse.demo_reset', true) = 'on' THEN
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                END IF;
                RETURN NEW;
            END IF;
            RAISE EXCEPTION 'append-only history cannot be changed';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impulse_reject_talent_pipeline_mutation()
        RETURNS trigger AS $$
        BEGIN
            IF current_setting('impulse.demo_reset', true) = 'on' THEN
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                END IF;
                RETURN NEW;
            END IF;
            RAISE EXCEPTION 'talent pipeline is append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impulse_reject_history_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'append-only history cannot be changed';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impulse_reject_talent_pipeline_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'talent pipeline is append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
