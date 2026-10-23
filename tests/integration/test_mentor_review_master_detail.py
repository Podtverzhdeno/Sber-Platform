"""Seeded mentor journey: versioned rubric queue and messaging work context."""

from __future__ import annotations

import os

import httpx
import pytest
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService
from impulse.application.messaging import MessagingService, WorkTaskChannelSource
from impulse.application.reward import (
    DEFAULT_REVIEW_RUBRIC,
    RewardService,
    WorkReviewEvidenceProvider,
)
from impulse.application.work import WorkService
from impulse.bootstrap import demo_seed
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, reset_demo_data, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.messaging_store import SqlMessagingStore
from impulse.infrastructure.reward_store import SqlRewardStore
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def _historical_task_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep these historical mentor/messaging fixtures on their original timeline."""
    monkeypatch.setattr(demo_seed, "_catalog_seed_time", lambda: demo_seed.DEMO_NOW)


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


async def _demo_app() -> httpx.AsyncClient:
    database = Database(integration_url())
    await reset_demo_data(database, demo_mode=True)
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("mentor-integration-secret-long"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work_store = SqlWorkStore(database)
    work_service = WorkService(work_store)
    work_service.consent_store = auth.store
    reward_store = SqlRewardStore(database)
    reward_service = RewardService(
        reward_store,
        WorkReviewEvidenceProvider(work_store),
        work_store,
        identity=auth.store,
    )
    messaging_service = MessagingService(SqlMessagingStore(database))
    messaging_service.task_channels = WorkTaskChannelSource(
        work_service.store, reward_service.store
    )
    app = create_app(
        settings,
        auth_service=auth,
        work_service=work_service,
        reward_service=reward_service,
        messaging_service=messaging_service,
    )
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.asyncio
async def test_review_queue_enriches_rubric_participant_and_project() -> None:
    async with await _demo_app() as client:
        await client.post("/api/v1/auth/demo-login", json={"persona_key": "mentor-elena"})
        response = await client.get("/api/v1/mentor/review-queue")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 8

        alex_item = next(
            item
            for item in items
            if item["review"]["contribution_id"] == str(demo_id("contribution:1:1"))
        )
        assert alex_item["participant_name"] == "Алекс Речной"
        assert alex_item["project_key"] == "demo-rd-lab"
        assert alex_item["task_kind"] == "task"
        assert alex_item["rubric_key"] == DEFAULT_REVIEW_RUBRIC.key
        assert alex_item["rubric_version"] == DEFAULT_REVIEW_RUBRIC.version
        assert alex_item["review"]["rubric_id"] == str(DEFAULT_REVIEW_RUBRIC.rubric_id)
        assert alex_item["rubric_criteria"] == [
            {"key": criterion.key, "title": criterion.title}
            for criterion in DEFAULT_REVIEW_RUBRIC.criteria
        ]
        assert alex_item["contribution_accepted"] is True
        assert alex_item["task_title"].startswith("Прототип рекомендательной системы")
        assert alex_item["deadline_at"].startswith("2026-09-16T09:00:00")


@pytest.mark.asyncio
async def test_review_queue_is_mentor_only() -> None:
    async with await _demo_app() as client:
        await client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        denied = await client.get("/api/v1/mentor/review-queue")
        assert denied.status_code == 404
        assert denied.json()["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.asyncio
async def test_messaging_task_channel_exposes_work_context() -> None:
    async with await _demo_app() as client:
        await client.post("/api/v1/auth/demo-login", json={"persona_key": "mentor-elena"})
        channels = (await client.get("/api/v1/me/messaging/channels")).json()
        task_channel = next(channel for channel in channels if channel["task_id"] is not None)
        personal_channel = next(channel for channel in channels if channel["task_id"] is None)

        context_response = await client.get(
            f"/api/v1/me/messaging/channels/{task_channel['id']}/context"
        )
        assert context_response.status_code == 200
        context = context_response.json()
        assert context["project_key"] == "demo-rd-lab"
        assert context["task_title"] == "Прототип рекомендательной системы для научных статей"
        assert context["deadline_at"].startswith("2026-09-16T09:00:00")
        assert context["contribution_version"] == 1
        assert context["contribution_accepted"] is True
        assert context["review_status"] == "published"

        personal_context = await client.get(
            f"/api/v1/me/messaging/channels/{personal_channel['id']}/context"
        )
        assert personal_context.status_code == 200
        assert personal_context.json() is None
