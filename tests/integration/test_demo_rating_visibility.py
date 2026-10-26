"""Public demo names and runtime privacy choices must survive reseeding.

Requires TEST_DATABASE_URL to reference a dedicated migrated test database.
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import select

from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.bootstrap.demo_seed import PERSONAS, demo_id, seed_demo
from impulse.domain.identity import ConsentScope
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.identity import visibility_settings

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_seeded_fictional_rating_is_named_and_optout_survives_reseed() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("TEST_DATABASE_URL is required")

    db = Database(async_database_url(url))
    try:
        await seed_demo(db)
        participant_keys = [key for key, _name, role in PERSONAS if role == "participant"]
        async with db.sessions() as session:
            rows = (await session.execute(
                select(visibility_settings.c.person_id, visibility_settings.c.visible)
                .where(visibility_settings.c.scope == "public_rating")
            )).all()
        names = {row.person_id: row.visible for row in rows}
        assert all(names[demo_id(key)] is True for key in participant_keys)

        alex_id = demo_id("participant-alex")
        store = SqlIdentityStore(db)
        await store.set_consent(alex_id, ConsentScope.PUBLIC_RATING, False)

        await seed_demo(db)
        await seed_demo(db)
        async with db.sessions() as session:
            row = (await session.execute(
                select(visibility_settings.c.visible)
                .where(
                    visibility_settings.c.person_id == alex_id,
                    visibility_settings.c.scope == "public_rating",
                )
            )).scalar_one()
        assert row is False
        assert ConsentScope.PUBLIC_RATING not in await store.granted_consents(alex_id)
        assert names[demo_id("participant-maria")] is True
    finally:
        await db.close()
