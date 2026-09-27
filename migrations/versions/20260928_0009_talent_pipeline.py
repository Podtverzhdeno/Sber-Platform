"""Add append-only human talent pipeline.

Revision ID: 20260928_0009
Revises: 20260928_0008
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260928_0009"
down_revision: str | Sequence[str] | None = "20260928_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "talent_pipeline_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column(
            "provenance",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "payload",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("candidate_id", sa.Uuid(), nullable=False),
        sa.Column("hr_id", sa.Uuid(), nullable=False),
        sa.Column("stage", sa.String(32), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_talent_pipeline_events_version_positive")),
        sa.CheckConstraint("data_origin = 'human'", name="ck_talent_pipeline_events_human_origin"),
        sa.ForeignKeyConstraint(
            ["candidate_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_talent_pipeline_events_candidate_id_persons"),
        ),
        sa.ForeignKeyConstraint(
            ["hr_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_talent_pipeline_events_hr_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_talent_pipeline_events")),
        sa.UniqueConstraint(
            "candidate_id",
            "hr_id",
            "stage",
            name="uq_talent_pipeline_events_candidate_id_hr_id_stage",
        ),
    )
    op.execute("""
        CREATE FUNCTION impulse_reject_talent_pipeline_mutation() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'talent pipeline is append-only'; END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_talent_pipeline_append_only BEFORE UPDATE OR DELETE
        ON talent_pipeline_events FOR EACH ROW
        EXECUTE FUNCTION impulse_reject_talent_pipeline_mutation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_talent_pipeline_append_only ON talent_pipeline_events")
    op.execute("DROP FUNCTION IF EXISTS impulse_reject_talent_pipeline_mutation()")
    op.drop_table("talent_pipeline_events")
