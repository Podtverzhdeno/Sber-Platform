"""Demo data commands must not become a production API surface."""

import pytest
from fastapi.testclient import TestClient

from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import reset_demo_data
from impulse.bootstrap.settings import Settings
from impulse.infrastructure.database import Database


@pytest.mark.asyncio
async def test_reset_refuses_non_demo_before_database_access() -> None:
    database = Database("postgresql+asyncpg://unused:unused@127.0.0.1:1/unused")
    try:
        with pytest.raises(RuntimeError, match="DEMO_MODE=false"):
            await reset_demo_data(database, demo_mode=False)
    finally:
        await database.close()


def test_non_demo_has_no_public_reset_endpoint() -> None:
    settings = Settings.model_validate(
        {
            "demo_mode": False,
            "auth_provider_url": "https://auth.example.test",
        }
    )
    response = TestClient(create_app(settings)).post("/api/v1/admin/demo/reset")

    assert response.status_code == 404
