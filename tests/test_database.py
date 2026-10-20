"""Database adapter unit tests independent of a running server."""

import pytest

from impulse.infrastructure.database import async_database_url, required_database_url


def test_railway_postgres_url_uses_asyncpg() -> None:
    assert async_database_url("postgres://user:pass@host/db") == (
        "postgresql+asyncpg://user:pass@host/db"
    )


def test_standard_postgresql_url_uses_asyncpg() -> None:
    assert async_database_url("postgresql://user:pass@host/db") == (
        "postgresql+asyncpg://user:pass@host/db"
    )


def test_existing_async_url_is_unchanged() -> None:
    url = "postgresql+asyncpg://user:pass@host/db"
    assert async_database_url(url) == url


def test_database_url_is_required_for_deployment_commands() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        required_database_url({}, purpose="Alembic migrations")


def test_railway_rejects_container_local_postgres() -> None:
    with pytest.raises(RuntimeError, match="points to localhost inside Railway"):
        required_database_url(
            {
                "DATABASE_URL": "postgresql://user:secret@127.0.0.1:5432/app",
                "RAILWAY_ENVIRONMENT": "production",
            }
        )


def test_railway_accepts_private_postgres_reference_value() -> None:
    value = "postgresql://user:secret@postgres.railway.internal:5432/app"
    assert (
        required_database_url({"DATABASE_URL": value, "RAILWAY_ENVIRONMENT": "production"}) == value
    )
