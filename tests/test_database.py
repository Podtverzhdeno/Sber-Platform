"""Database adapter unit tests independent of a running server."""

from impulse.infrastructure.database import async_database_url


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
