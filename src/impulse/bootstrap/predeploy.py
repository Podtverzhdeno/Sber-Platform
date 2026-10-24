"""Railway pre-deploy: migrate first, seed only when explicitly in demo mode.

This is a single executable command so Dockerfile deployments do not depend on
Railway's interpretation of shell operators inside preDeployCommand.
"""

from __future__ import annotations

import asyncio

from alembic import command
from alembic.config import Config

from impulse.bootstrap.demo_seed import seed_demo
from impulse.bootstrap.settings import Settings
from impulse.infrastructure.database import Database


async def _seed_and_verify(database_url: str) -> None:
    database = Database(database_url)
    try:
        counts = await seed_demo(database)
    finally:
        await database.close()

    # A healthy web process does not guarantee that the demo catalog was
    # populated. Fail the deploy before switching traffic if it is empty.
    if counts.get("tasks", 0) < 12:
        raise RuntimeError("Demo seed incomplete: published task catalog is missing")
    print(f"Demo data verified: {counts['tasks']} task rows")


def main() -> None:
    settings = Settings()
    if settings.database_url is None:
        raise RuntimeError("DATABASE_URL is required for database migrations")

    command.upgrade(Config("alembic.ini"), "head")
    print("Alembic migrations completed")

    if not settings.demo_mode:
        print("DEMO_MODE=false: production data is unchanged; demo seed skipped")
        return

    asyncio.run(_seed_and_verify(settings.database_url.get_secret_value()))


if __name__ == "__main__":
    main()
