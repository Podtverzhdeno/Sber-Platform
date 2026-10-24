"""Railway migration/seed pre-deploy must be safe, ordered and explicit."""

from types import SimpleNamespace

import pytest
from pydantic import SecretStr

from impulse.bootstrap import predeploy


@pytest.mark.parametrize("demo_mode", [True, False])
def test_predeploy_migrates_before_optional_seed(
    monkeypatch: pytest.MonkeyPatch, demo_mode: bool
) -> None:
    calls: list[str] = []
    database_url = "postgresql+asyncpg://test:test@localhost/test"

    monkeypatch.setattr(
        predeploy,
        "Settings",
        lambda: SimpleNamespace(database_url=SecretStr(database_url), demo_mode=demo_mode),
    )

    def upgrade(_config: object, target: str) -> None:
        assert target == "head"
        calls.append("migrations")

    async def seed(url: str) -> None:
        assert url == database_url
        assert calls == ["migrations"]
        calls.append("seed")

    monkeypatch.setattr(predeploy.command, "upgrade", upgrade)
    monkeypatch.setattr(predeploy, "_seed_and_verify", seed)
    predeploy.main()

    assert calls == (["migrations", "seed"] if demo_mode else ["migrations"])


def test_predeploy_requires_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        predeploy,
        "Settings",
        lambda: SimpleNamespace(database_url=None, demo_mode=True),
    )
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        predeploy.main()


@pytest.mark.asyncio
async def test_demo_seed_fails_closed_if_catalog_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    closed: list[bool] = []

    class FakeDatabase:
        def __init__(self, _url: str) -> None:
            pass

        async def close(self) -> None:
            closed.append(True)

    async def seed(_database: object) -> dict[str, int]:
        return {"tasks": 0}

    monkeypatch.setattr(predeploy, "Database", FakeDatabase)
    monkeypatch.setattr(predeploy, "seed_demo", seed)
    with pytest.raises(RuntimeError, match="catalog is missing"):
        await predeploy._seed_and_verify("postgresql+asyncpg://test:test@localhost/test")
    assert closed == [True]


@pytest.mark.asyncio
async def test_demo_seed_verifies_twelve_tasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    closed: list[bool] = []

    class FakeDatabase:
        def __init__(self, _url: str) -> None:
            pass

        async def close(self) -> None:
            closed.append(True)

    async def seed(_database: object) -> dict[str, int]:
        return {"tasks": 12}

    monkeypatch.setattr(predeploy, "Database", FakeDatabase)
    monkeypatch.setattr(predeploy, "seed_demo", seed)
    await predeploy._seed_and_verify("postgresql+asyncpg://test:test@localhost/test")
    assert closed == [True]
