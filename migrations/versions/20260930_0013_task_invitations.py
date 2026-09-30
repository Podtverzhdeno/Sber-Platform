"""Persist addressable task invitations.

Revision ID: 20260930_0013
Revises: 20260928_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260930_0013"
down_revision: str | Sequence[str] | None = "20260928_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    json = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.create_table(
        "task_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="pending", nullable=False),
        sa.Column("provenance", json, server_default="{}", nullable=False),
        sa.Column("payload", json, server_default="{}", nullable=False),
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
        sa.Column(
            "task_id", sa.Uuid(), sa.ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "person_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("terms_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_task_invitations_version_positive"),
        sa.UniqueConstraint("task_id", "person_id", name="uq_task_invitations_task_id_person_id"),
    )
    op.create_table(
        "team_request_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column("provenance", json, server_default="{}", nullable=False),
        sa.Column("payload", json, server_default="{}", nullable=False),
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
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column(
            "owner_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("request_version", sa.Integer(), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_team_request_versions_version_positive"),
        sa.UniqueConstraint(
            "request_id",
            "request_version",
            name="uq_team_request_versions_request_id_request_version",
        ),
    )
    op.create_table(
        "candidate_reservations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column("provenance", json, server_default="{}", nullable=False),
        sa.Column("payload", json, server_default="{}", nullable=False),
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
        sa.Column(
            "owner_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column(
            "person_id", sa.Uuid(), sa.ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "evidence_contribution_id",
            sa.Uuid(),
            sa.ForeignKey("contributions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint("version > 0", name="ck_candidate_reservations_version_positive"),
        sa.UniqueConstraint(
            "owner_id",
            "request_id",
            "person_id",
            name="uq_candidate_reservations_owner_id_request_id_person_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("candidate_reservations")
    op.drop_table("team_request_versions")
    op.drop_table("task_invitations")
