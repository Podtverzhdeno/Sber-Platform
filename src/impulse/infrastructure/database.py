"""Async SQLAlchemy engine and transaction ownership."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator, Mapping
from contextlib import asynccontextmanager

from sqlalchemy import MetaData, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def async_database_url(url: str) -> str:
    """Normalize common PostgreSQL URLs to the asyncpg SQLAlchemy dialect."""
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    return url


def required_database_url(
    environ: Mapping[str, str] | None = None,
    *,
    purpose: str = "database startup",
) -> str:
    """Return a validated database URL without exposing credentials in errors."""
    source = os.environ if environ is None else environ
    raw = source.get("DATABASE_URL", "").strip()
    if not raw:
        raise RuntimeError(
            f"DATABASE_URL is required for {purpose}. "
            "On Railway, add a PostgreSQL service and set DATABASE_URL to the "
            "Postgres service reference variable."
        )
    try:
        parsed = make_url(raw)
    except Exception as exc:
        raise RuntimeError(f"DATABASE_URL is invalid for {purpose}") from exc
    if source.get("RAILWAY_ENVIRONMENT") and parsed.host in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError(
            f"DATABASE_URL for {purpose} points to localhost inside Railway. "
            "Use the private PostgreSQL service reference variable instead."
        )
    return raw


class Database:
    """Own the engine and provide one transaction per application command."""

    def __init__(self, url: str, *, echo: bool = False) -> None:
        self.engine: AsyncEngine = create_async_engine(
            async_database_url(url),
            echo=echo,
            pool_pre_ping=True,
        )
        self.sessions = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession]:
        async with self.sessions() as session:
            try:
                yield session
                await session.commit()
            except BaseException:
                await session.rollback()
                raise

    async def ready(self) -> bool:
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        except Exception:
            return False
        return True

    async def close(self) -> None:
        await self.engine.dispose()
