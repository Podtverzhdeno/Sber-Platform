"""PostgreSQL restart harness for persistent Buddy conversations (29.3)."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, func, select

from impulse.api.errors import ApiError
from impulse.application.buddy import BuddyConversationService
from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.domain.identity import ActorContext, Role
from impulse.infrastructure.buddy_store import SqlBuddyStorage
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.buddy import (
    buddy_deletion_audits,
    buddy_feedback,
    buddy_memory_suppression,
    buddy_messages,
    buddy_suggestion_states,
    buddy_threads,
)
from impulse.infrastructure.models.identity import persons

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


def participant(person_key: str) -> ActorContext:
    return ActorContext(
        person_id=demo_id(person_key),
        display_name="Owner",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


@pytest.fixture
async def buddy_database() -> Database:
    """Fresh seeded database with empty buddy tables (test ordering isolation)."""
    database = Database(integration_url())
    await seed_demo(database)
    async with database.session() as session:
        for table in (
            buddy_messages,
            buddy_feedback,
            buddy_memory_suppression,
            buddy_suggestion_states,
            buddy_deletion_audits,
            buddy_threads,
        ):
            await session.execute(delete(table))
        await session.commit()
    return database


@pytest.mark.asyncio
async def test_thread_history_and_feedback_survive_sql_restart(buddy_database: Database) -> None:
    actor = participant("participant-alex")
    before_service = BuddyConversationService(SqlBuddyStorage(buddy_database))
    thread = await before_service.create_thread(actor)
    message = await before_service.add_message(
        actor, thread.id, client_message_id="m1", content="история диалога"
    )
    await before_service.feedback(actor, thread.id, rating=5)

    after_service = BuddyConversationService(SqlBuddyStorage(buddy_database))
    seen = await after_service.thread(actor, thread.id)
    assert seen.messages == (message,)
    replayed = await after_service.add_message(
        actor, thread.id, client_message_id="m1", content="повторный запрос"
    )
    assert replayed.id == message.id
    updated = await after_service.feedback(actor, thread.id, rating=4)
    assert updated.rating == 4


@pytest.mark.asyncio
async def test_foreign_thread_is_not_readable(buddy_database: Database) -> None:
    owner = participant("participant-alex")
    stranger = participant("participant-maria")
    service = BuddyConversationService(SqlBuddyStorage(buddy_database))
    thread = await service.create_thread(owner)
    await service.add_message(owner, thread.id, client_message_id="m1", content="private")
    with pytest.raises(ApiError) as caught:
        await service.thread(stranger, thread.id)
    assert caught.value.status_code == 404


@pytest.mark.asyncio
async def test_withdrawal_purges_messages_but_keeps_audit(buddy_database: Database) -> None:
    actor = participant("participant-alex")
    service = BuddyConversationService(SqlBuddyStorage(buddy_database))
    thread = await service.create_thread(actor)
    await service.add_message(actor, thread.id, client_message_id="m1", content="данные")
    audit = await service.withdraw_memory(actor)
    assert audit.deleted_messages == 1

    restarted = BuddyConversationService(SqlBuddyStorage(buddy_database))
    audits = await restarted.deletion_audits()
    assert any(item.reason == "consent_withdrawn" for item in audits)
    with pytest.raises(ApiError) as blocked_write:
        await restarted.add_message(actor, thread.id, client_message_id="m2", content="later")
    assert blocked_write.value.code == "AI_MEMORY_DISABLED"
    with pytest.raises(ApiError) as blocked_read:
        await restarted.thread(actor, thread.id)
    assert blocked_read.value.code == "AI_MEMORY_DISABLED"


@pytest.mark.asyncio
async def test_retention_purge_and_suggestion_states(buddy_database: Database) -> None:
    storage = SqlBuddyStorage(buddy_database)
    actor = participant("participant-alex")
    service = BuddyConversationService(storage)
    thread = await service.create_thread(actor)
    await storage.append_message(
        thread.id,
        "stale",
        role="user",
        content="старая реплика",
        created_at=datetime.now(UTC) - timedelta(hours=1),
    )
    assert await storage.purge_messages_before(datetime.now(UTC) + timedelta(seconds=1)) == 1
    seen = await storage.load_thread(actor.person_id, thread.id)
    assert seen.messages == ()
    assert seen.content_deleted is True

    await service.dismiss_suggestion(actor, "s-1")
    snoozed_until = datetime.now(UTC) + timedelta(days=1)
    await service.snooze_suggestion(actor, "s-2", until=snoozed_until)
    restarted_states = await storage.suggestion_states(actor.person_id)
    assert "s-1" in restarted_states.dismissed
    assert restarted_states.snoozed_until("s-2") == snoozed_until


@pytest.mark.asyncio
async def test_demo_reset_purges_persona_buddy_rows(buddy_database: Database) -> None:
    """Runtime buddy rows of demo personas must not block demo reset (FK persons)."""
    storage = SqlBuddyStorage(buddy_database)
    actor = participant("participant-alex")
    service = BuddyConversationService(storage)
    thread = await service.create_thread(actor)
    await service.add_message(actor, thread.id, client_message_id="m1", content="демо-данные")
    await service.feedback(actor, thread.id, rating=3)
    await storage.block_memory(actor.person_id)
    await service.dismiss_suggestion(actor, "s-9")
    await service.withdraw_memory(actor)
    assert await service.deletion_audits()

    await reset_demo_data(buddy_database, demo_mode=True)

    async with buddy_database.session() as session:
        for table in (
            buddy_messages,
            buddy_feedback,
            buddy_memory_suppression,
            buddy_suggestion_states,
            buddy_deletion_audits,
            buddy_threads,
        ):
            remaining = await session.scalar(select(func.count()).select_from(table))
            assert remaining == 0
    await seed_demo(buddy_database)
    async with buddy_database.session() as session:
        restored = await session.execute(
            select(persons.c.id).where(persons.c.id == demo_id("participant-alex"))
        )
        assert restored.first() is not None
