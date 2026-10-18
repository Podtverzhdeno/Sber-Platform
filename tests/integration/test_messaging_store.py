"""PostgreSQL messaging persistence and demo reset clearing scenarios."""

from __future__ import annotations

import os
import uuid as uuid_module

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from impulse.application.identity import DemoAuthService
from impulse.application.messaging import (
    ChannelKind,
    MemberRole,
    MemoryMessagingStore,
    MessagingService,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.identity import ActorContext, Role
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.messaging_store import SqlMessagingStore
from impulse.infrastructure.models.insight import domain_events
from impulse.infrastructure.models.messaging import (
    messaging_channels,
    messaging_memberships,
    messaging_messages,
    messaging_read_cursors,
)

pytestmark = pytest.mark.integration

PERSONA = "participant-alex"
PEER = "participant-anna"


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


def _settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("integration-session-secret-longer-than-32"),
    )


def _actor(person: str) -> ActorContext:
    return ActorContext(
        person_id=demo_id(person),
        display_name=person,
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="impulse-demo",
        consent_scopes=frozenset(),
    )


@pytest.mark.asyncio
async def test_messaging_messages_persist_to_postgresql_and_reset_clears() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    report = await seed_demo(database)
    assert report["messaging_channels"] == 2
    assert report["messaging_messages"] == 4

    store = SqlMessagingStore(database)
    settings = _settings()
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(
        settings,
        auth_service=auth,
        messaging_service=MessagingService(store),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        login = await client.post("/api/v1/auth/demo-login", json={"persona_key": PERSONA})
        csrf = login.json()["csrf_token"]
        opened = await client.post(
            "/api/v1/me/messaging/channels/personal",
            json={"peer_id": str(demo_id(PEER))},
            headers={"X-CSRF-Token": csrf},
        )
        assert opened.status_code == 200
        channel = opened.json()
        sent = await client.post(
            f"/api/v1/me/messaging/channels/{channel['id']}/messages",
            json={"body": "Транзакционная проверка записи в PostgreSQL.", "artifact_refs": []},
            headers={"X-CSRF-Token": csrf},
        )
        assert sent.status_code == 200

        history = await client.get(f"/api/v1/me/messaging/channels/{channel['id']}/messages")
        assert history.status_code == 200
        rows = history.json()
        assert len(rows) == 1
        assert rows[0]["body"] == "Транзакционная проверка записи в PostgreSQL."
        assert rows[0]["sequence"] == 1
        assert rows[0]["author_id"] == str(demo_id(PERSONA))

    async with database.sessions() as session:
        created_id = uuid_module.UUID(channel["id"])
        message_count = int(
            await session.scalar(
                select(func.count())
                .select_from(messaging_messages)
                .where(messaging_messages.c.channel_id == created_id)
            )
            or 0
        )
        membership_count = int(
            await session.scalar(
                select(func.count())
                .select_from(messaging_memberships)
                .where(messaging_memberships.c.channel_id == created_id)
            )
            or 0
        )
    assert message_count == 1
    assert membership_count == 2

    async with database.sessions() as session:
        rows = (
            (
                await session.execute(
                    select(domain_events).where(domain_events.c.event_key.like("messaging.%"))
                )
            )
            .mappings()
            .all()
        )
    channel_rows = [row for row in rows if row["payload"].get("channel_id") == str(created_id)]
    channel_created = [
        row
        for row in channel_rows
        if row["event_type"] == "messaging.channel.created"
        and row["entity_type"] == "messaging_channels"
    ]
    message_events = [
        row
        for row in rows
        if row["event_type"] == "messaging.message.appended"
        and row["entity_type"] == "messaging_messages"
        and row["payload"].get("channel_id") == str(created_id)
    ]
    assert channel_created and message_events, "messaging audit trail is missing"
    for event in message_events:
        forbidden = {"body", "chat_text", "raw_chat", "prompt", "response"}
        assert forbidden.isdisjoint(event["payload"])
        assert event["payload"].get("kind") == "text"
        assert event["payload"].get("sequence") == 1

    await reset_demo_data(database, demo_mode=True)

    async with database.sessions() as session:
        for table in (
            messaging_channels,
            messaging_memberships,
            messaging_messages,
            messaging_read_cursors,
        ):
            left = int(await session.scalar(select(func.count()).select_from(table)) or 0)
            assert left == 0, f"{table.name} rows survive demo reset"

    await database.close()


@pytest.mark.asyncio
async def test_personal_channel_flows_match_memory_and_sql_stores() -> None:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    await seed_demo(database)
    sql_service = MessagingService(SqlMessagingStore(database))
    memory_service = MessagingService(MemoryMessagingStore())
    actor = _actor(PERSONA)

    for service in (sql_service, memory_service):
        channel = await service.open_personal_channel(actor, peer_id=demo_id(PEER))
        reopened = await service.open_personal_channel(actor, peer_id=demo_id(PEER))
        assert reopened.id == channel.id

        message = await service.send(actor, channel.id, "Дублирующая проверка записи")
        assert message.sequence == 1

        muted = await service.set_mute(actor, channel.id, muted=True)
        assert muted.muted is True

        view = await service.channel_view(actor, channel.id)
        assert view is not None
        assert view.channel.kind is ChannelKind.PERSONAL
        assert view.membership.role is MemberRole.MEMBER
        assert view.membership.muted is True
        assert view.last_message is not None
        assert view.last_message.body == "Дублирующая проверка записи"
        assert view.unread == 0

        history = await service.messages(actor, channel.id, limit=10, before_sequence=None)
        assert [item.sequence for item in history] == [1]

    await database.close()
