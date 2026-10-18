"""PostgreSQL restart harness for exactly-once agent resume."""

from __future__ import annotations

import os

import pytest

from impulse.api.errors import ApiError
from impulse.application.agents import RunStatus
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.infrastructure.agent_checkpoint_store import SqlAgentCheckpointStore
from impulse.infrastructure.database import Database, async_database_url

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_awaiting_checkpoint_survives_adapter_restart_and_resumes_once() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    owner = demo_id("participant-alex")
    request_id = "checkpoint-restart-integration-v1"
    created = await SqlAgentCheckpointStore(database).create_awaiting(
        owner,
        thread_key="buddy:integration-restart",
        agent_kind="buddy",
        client_request_id=request_id,
        policy_version="buddy-v1",
        state={"node": "awaiting_human", "attempt": 1},
    )
    restarted = SqlAgentCheckpointStore(database)
    duplicate = await restarted.create_awaiting(
        owner,
        thread_key="buddy:integration-restart",
        agent_kind="buddy",
        client_request_id=request_id,
        policy_version="buddy-v1",
        state={"node": "must-not-overwrite"},
    )
    assert duplicate.run_id == created.run_id
    resumed = await restarted.resume(owner, created.run_id)
    assert resumed.status is RunStatus.RESUMED
    assert resumed.state["node"] == "awaiting_human"
    with pytest.raises(ApiError) as caught:
        await restarted.resume(owner, created.run_id)
    assert caught.value.status_code == 409
    await database.close()
