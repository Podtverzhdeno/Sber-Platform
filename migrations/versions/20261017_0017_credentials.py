"""Persist verified documents (course certificates, project credentials).

Revision ID: 20261017_0017
Revises: 20261017_0016
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261017_0017"
down_revision: str | Sequence[str] | None = "20261017_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _domain_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("data_origin", sa.String(32), server_default="system", nullable=False),
        sa.Column("status", sa.String(64), server_default="active", nullable=False),
        sa.Column("provenance", JSON, server_default="{}", nullable=False),
        sa.Column("payload", JSON, server_default="{}", nullable=False),
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
    ]


def upgrade() -> None:
    op.create_table(
        "course_certificates",
        *_domain_columns(),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("course_key", sa.String(64), nullable=False),
        sa.Column("course_title", sa.String(255), nullable=False),
        sa.Column("verification_id", sa.String(64), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_course_certificates_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_course_certificates_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_course_certificates")),
        sa.UniqueConstraint(
            "person_id",
            "course_key",
            name="uq_course_certificates_person_id_course_key",
        ),
        sa.UniqueConstraint(
            "verification_id",
            name="uq_course_certificates_verification_id",
        ),
    )
    op.create_index(
        "ix_course_certificates_person_id",
        "course_certificates",
        ["person_id"],
    )

    op.create_table(
        "project_credentials",
        *_domain_columns(),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("contribution_id", sa.Uuid(), nullable=True),
        sa.Column("contribution_version", sa.Integer(), nullable=False),
        sa.Column("verification_id", sa.String(64), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_project_credentials_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_project_credentials_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_credentials")),
        sa.UniqueConstraint(
            "contribution_id",
            "contribution_version",
            name="uq_project_credentials_contribution_id_contribution_version",
        ),
        sa.UniqueConstraint(
            "verification_id",
            name="uq_project_credentials_verification_id",
        ),
    )
    op.create_index(
        "ix_project_credentials_person_id",
        "project_credentials",
        ["person_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_credentials_person_id", table_name="project_credentials")
    op.drop_table("project_credentials")
    op.drop_index("ix_course_certificates_person_id", table_name="course_certificates")
    op.drop_table("course_certificates")
