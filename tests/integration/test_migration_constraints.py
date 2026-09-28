"""PostgreSQL migration and business-key regression tests."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine

from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.ecosystem import external_sources, provider_records
from impulse.infrastructure.models.identity import persons
from impulse.infrastructure.models.insight import audit_entries, domain_events
from impulse.infrastructure.models.recognition import score_ledger, seasons
from impulse.infrastructure.persistence import StaleVersionError, mutate_with_history

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_unique_business_keys_are_enforced_by_migration() -> None:
    engine = create_async_engine(integration_url())
    suffix = uuid4().hex
    person_id = uuid4()
    source_id = uuid4()
    season_id = uuid4()
    score_source_id = uuid4()

    async with engine.begin() as connection:
        await connection.execute(
            insert(persons).values(
                id=person_id,
                display_name="Тестовый участник",
                external_key=f"person-{suffix}",
            )
        )
        await connection.execute(
            insert(external_sources).values(
                id=source_id,
                provider="demo-provider",
                source_key=f"source-{suffix}",
                source_url="https://example.test/source",
            )
        )
        await connection.execute(
            insert(provider_records).values(
                provider_id="demo-provider",
                external_id=f"record-{suffix}",
                source_id=source_id,
            )
        )
        await connection.execute(
            insert(seasons).values(id=season_id, season_key=f"season-{suffix}", title="Сезон")
        )
        await connection.execute(
            insert(score_ledger).values(
                season_id=season_id,
                person_id=person_id,
                source_type="project",
                source_id=score_source_id,
                rule_id="accepted-project",
                points="100.0000",
            )
        )

    duplicate_cases = (
        insert(persons).values(display_name="Дубль", external_key=f"person-{suffix}"),
        insert(provider_records).values(
            provider_id="demo-provider",
            external_id=f"record-{suffix}",
            source_id=source_id,
        ),
        insert(score_ledger).values(
            season_id=season_id,
            person_id=person_id,
            source_type="project",
            source_id=score_source_id,
            rule_id="accepted-project",
            points="50.0000",
        ),
    )
    for statement in duplicate_cases:
        with pytest.raises(IntegrityError):
            async with engine.begin() as connection:
                await connection.execute(statement)

    await engine.dispose()


@pytest.mark.asyncio
async def test_optimistic_history_is_atomic_and_append_only() -> None:
    database = Database(integration_url())
    person_id = uuid4()
    event_key = f"person-renamed-{uuid4().hex}"

    async with database.session() as session:
        await session.execute(
            insert(persons).values(
                id=person_id,
                display_name="До изменения",
                external_key=f"person-{uuid4().hex}",
            )
        )

    async with database.session() as session:
        next_version = await mutate_with_history(
            session,
            table=persons,
            entity_id=person_id,
            expected_version=1,
            changes={"display_name": "После изменения"},
            actor_id=person_id,
            action="person.renamed",
            event_key=event_key,
            event_type="person.renamed.v1",
        )
    assert next_version == 2

    with pytest.raises(StaleVersionError):
        async with database.session() as session:
            await mutate_with_history(
                session,
                table=persons,
                entity_id=person_id,
                expected_version=1,
                changes={"display_name": "Устаревшая запись"},
                actor_id=person_id,
                action="person.renamed",
                event_key=f"stale-{uuid4().hex}",
                event_type="person.renamed.v1",
            )

    async with database.session() as session:
        repeated_version = await mutate_with_history(
            session,
            table=persons,
            entity_id=person_id,
            expected_version=2,
            changes={"display_name": "Idempotent replay must not apply"},
            actor_id=person_id,
            action="person.renamed",
            event_key=event_key,
            event_type="person.renamed.v1",
        )
    assert repeated_version == 2

    async with database.sessions() as session:
        version = await session.scalar(select(persons.c.version).where(persons.c.id == person_id))
        audit_count = await session.scalar(
            select(func.count())
            .select_from(audit_entries)
            .where(audit_entries.c.entity_id == person_id)
        )
        event_count = await session.scalar(
            select(func.count())
            .select_from(domain_events)
            .where(domain_events.c.entity_id == person_id)
        )
        event_entity_version = await session.scalar(
            select(domain_events.c.entity_version).where(domain_events.c.event_key == event_key)
        )
        audit_id = await session.scalar(
            select(audit_entries.c.id).where(audit_entries.c.entity_id == person_id)
        )
    assert (version, audit_count, event_count) == (2, 1, 1)
    assert event_entity_version == 2
    assert audit_id is not None

    with pytest.raises(DBAPIError):
        async with database.session() as session:
            await session.execute(
                update(audit_entries)
                .where(audit_entries.c.id == audit_id)
                .values(action="rewritten")
            )

    await database.close()


@pytest.mark.asyncio
async def test_demo_seed_is_linked_and_idempotent() -> None:
    database = Database(integration_url())

    first = await seed_demo(database)
    second = await seed_demo(database)

    assert first == second
    assert second["persons"] == 8
    assert second["courses"] == 12
    assert second["events"] == 8
    assert second["tasks"] == 8
    assert second["appeals"] == 1
    assert second["score_ledger"] == 3

    async with database.sessions() as session:
        alex = await session.execute(
            select(persons.c.id, persons.c.data_origin).where(
                persons.c.id == demo_id("participant-alex")
            )
        )
        assert alex.one() == (demo_id("participant-alex"), "demo_seed")

    await database.close()


@pytest.mark.asyncio
async def test_demo_reset_removes_only_seed_owned_rows() -> None:
    database = Database(integration_url())
    await seed_demo(database)

    async with database.sessions() as session:
        non_demo_before = int(
            await session.scalar(
                select(func.count())
                .select_from(persons)
                .where(persons.c.data_origin != "demo_seed")
            )
            or 0
        )

    await reset_demo_data(database, demo_mode=True)

    async with database.sessions() as session:
        demo_after = int(
            await session.scalar(
                select(func.count())
                .select_from(persons)
                .where(persons.c.data_origin == "demo_seed")
            )
            or 0
        )
        non_demo_after = int(
            await session.scalar(
                select(func.count())
                .select_from(persons)
                .where(persons.c.data_origin != "demo_seed")
            )
            or 0
        )

    assert demo_after == 0
    assert non_demo_after == non_demo_before
    await database.close()
