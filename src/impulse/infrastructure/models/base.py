"""Shared relational primitives for every bounded context."""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.schema import SchemaItem
from sqlalchemy.sql.type_api import TypeEngine

from impulse.infrastructure.database import Base

metadata: MetaData = Base.metadata
json_type = JSON().with_variant(JSONB(), "postgresql")


def uuid_field(
    name: str, foreign_key: str | None = None, *, nullable: bool = False
) -> Column[UUID]:
    args: list[Any] = [Uuid(as_uuid=True)]
    if foreign_key is not None:
        args.append(ForeignKey(foreign_key, ondelete="RESTRICT"))
    return Column(name, *args, nullable=nullable)


def string_field(name: str, length: int = 128, *, nullable: bool = False) -> Column[str]:
    return Column(name, String(length), nullable=nullable)


def integer_field(name: str, *, nullable: bool = False) -> Column[int]:
    return Column(name, Integer, nullable=nullable)


def typed_field[T](name: str, field_type: TypeEngine[T], *, nullable: bool = False) -> Column[T]:
    return Column(name, field_type, nullable=nullable)


def constraint_name(table: str, columns: tuple[str, ...]) -> str:
    raw = f"uq_{table}_{'_'.join(columns)}"
    if len(raw) <= 63:
        return raw
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]
    return f"{raw[:52]}_{digest}"


def domain_table(
    name: str,
    *domain_columns: SchemaItem,
    uniques: tuple[tuple[str, ...], ...] = (),
) -> Table:
    constraints: list[SchemaItem] = [
        CheckConstraint("version > 0", name="version_positive"),
    ]
    constraints.extend(
        UniqueConstraint(*columns, name=constraint_name(name, columns)) for columns in uniques
    )
    return Table(
        name,
        metadata,
        Column("id", Uuid(as_uuid=True), primary_key=True, default=uuid4),
        Column("version", Integer, nullable=False, default=1, server_default="1"),
        Column("data_origin", String(32), nullable=False, server_default="system"),
        Column("status", String(64), nullable=False, server_default="active"),
        Column("provenance", json_type, nullable=False, default=dict, server_default="{}"),
        Column("payload", json_type, nullable=False, default=dict, server_default="{}"),
        Column(
            "created_at",
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        Column(
            "updated_at",
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            onupdate=datetime.now,
        ),
        Column("created_by", Uuid(as_uuid=True), nullable=True),
        *domain_columns,
        *constraints,
    )
