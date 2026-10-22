"""Persistent Buddy conversation storage (restart-safe history).

Revision ID: 20261022_0025
Revises: 20261020_0024
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261022_0025"
down_revision: str | Sequence[str] | None = "20261020_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

_DOMAIN_COLUMNS = [
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


def _buddy_table(name: str, *columns: sa.Column) -> sa.Table:
    op.create_table(
        name,
        *_DOMAIN_COLUMNS,
        *columns,
        sa.CheckConstraint("version > 0", name=op.f(f"ck_{name}_version_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{name}")),
    )


def upgrade() -> None:
    _buddy_table(
        "buddy_threads",
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("content_deleted", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_threads_owner_id_persons"),
        ),
    )
    _buddy_table(
        "buddy_messages",
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("client_message_id", sa.String(128), nullable=False),
        sa.Column("role", sa.String(24), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["buddy_threads.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_messages_thread_id_buddy_threads"),
        ),
        sa.UniqueConstraint(
            "thread_id",
            "client_message_id",
            name=op.f("uq_buddy_messages_thread_id_client_message_id"),
        ),
    )
    _buddy_table(
        "buddy_feedback",
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["buddy_threads.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_feedback_thread_id_buddy_threads"),
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_feedback_actor_id_persons"),
        ),
        sa.UniqueConstraint(
            "thread_id", "actor_id", name=op.f("uq_buddy_feedback_thread_id_actor_id")
        ),
    )
    op.create_table(
        "buddy_memory_suppression",
        *_DOMAIN_COLUMNS,
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "version > 0", name=op.f("ck_buddy_memory_suppression_version_positive")
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_memory_suppression_person_id_persons"),
        ),
        sa.UniqueConstraint("person_id", name=op.f("uq_buddy_memory_suppression_person_id")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_buddy_memory_suppression")),
    )
    op.create_table(
        "buddy_suggestion_states",
        *_DOMAIN_COLUMNS,
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("suggestion_id", sa.String(192), nullable=False),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version > 0", name=op.f("ck_buddy_suggestion_states_version_positive")),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_suggestion_states_person_id_persons"),
        ),
        sa.UniqueConstraint(
            "person_id",
            "suggestion_id",
            "state",
            name=op.f("uq_buddy_suggestion_states_person_id_suggestion_id_state"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_buddy_suggestion_states")),
    )
    op.create_table(
        "buddy_deletion_audits",
        *_DOMAIN_COLUMNS,
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(64), nullable=False),
        sa.Column("deleted_messages", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name=op.f("ck_buddy_deletion_audits_version_positive")),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["persons.id"],
            ondelete="RESTRICT",
            name=op.f("fk_buddy_deletion_audits_owner_id_persons"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_buddy_deletion_audits")),
    )


def downgrade() -> None:
    for name in (
        "buddy_deletion_audits",
        "buddy_suggestion_states",
        "buddy_memory_suppression",
        "buddy_feedback",
        "buddy_messages",
        "buddy_threads",
    ):
        op.drop_table(name)
