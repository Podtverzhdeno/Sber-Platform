"""Persist versioned competency frameworks and evidence.

Revision ID: 20261017_0018
Revises: 20261017_0017
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261017_0018"
down_revision: str | Sequence[str] | None = "20261017_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _evidence_unique_name() -> str:
    raw = "uq_competency_evidence_person_id_competency_key_source_kind_source_ref"
    if len(raw) <= 63:
        return raw
    import hashlib

    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]
    return f"{raw[:52]}_{digest}"


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
        "competency_models",
        *_domain_columns(),
        sa.Column("framework_key", sa.String(96), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("framework_version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_competency_models_version_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_competency_models")),
        sa.UniqueConstraint(
            "framework_key",
            "framework_version",
            name="uq_competency_models_framework_key_framework_version",
        ),
    )

    op.create_table(
        "competency_definitions",
        *_domain_columns(),
        sa.Column("model_id", sa.Uuid(), nullable=False),
        sa.Column("competency_key", sa.String(120), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_competency_definitions_version_positive")),
        sa.ForeignKeyConstraint(
            ["model_id"],
            ["competency_models.id"],
            ondelete="RESTRICT",
            name=op.f("fk_competency_definitions_model_id_competency_models"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_competency_definitions")),
        sa.UniqueConstraint(
            "model_id",
            "competency_key",
            name="uq_competency_definitions_model_id_competency_key",
        ),
    )
    op.create_index(
        "ix_competency_definitions_model_id",
        "competency_definitions",
        ["model_id"],
    )

    op.create_table(
        "competency_evidence",
        *_domain_columns(),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("competency_key", sa.String(120), nullable=False),
        sa.Column("source_kind", sa.String(32), nullable=False),
        sa.Column("source_ref", sa.String(200), nullable=False),
        sa.Column("level", sa.String(64), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_competency_evidence_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_competency_evidence_person_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_competency_evidence")),
        sa.UniqueConstraint(
            "person_id",
            "competency_key",
            "source_kind",
            "source_ref",
            name=_evidence_unique_name(),
        ),
    )
    op.create_index(
        "ix_competency_evidence_person_id",
        "competency_evidence",
        ["person_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_competency_evidence_person_id", table_name="competency_evidence")
    op.drop_table("competency_evidence")
    op.drop_index("ix_competency_definitions_model_id", table_name="competency_definitions")
    op.drop_table("competency_definitions")
    op.drop_table("competency_models")
