"""Restart, idempotency, and owner isolation for agent checkpoints."""

from uuid import uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.agents import MemoryAgentCheckpointStore, RunStatus


@pytest.mark.asyncio
async def test_awaiting_run_restores_and_resumes_exactly_once_after_restart() -> None:
    owner = uuid4()
    store = MemoryAgentCheckpointStore()
    created = await store.create_awaiting(
        owner,
        thread_key="buddy:roadmap",
        agent_kind="buddy",
        client_request_id="request-1",
        policy_version="buddy-v1",
        state={"node": "awaiting_human"},
    )
    restarted_service = store
    duplicate = await restarted_service.create_awaiting(
        owner,
        thread_key="buddy:roadmap",
        agent_kind="buddy",
        client_request_id="request-1",
        policy_version="buddy-v1",
        state={"node": "ignored"},
    )
    assert duplicate.run_id == created.run_id
    resumed = await restarted_service.resume(owner, created.run_id)
    assert resumed.status is RunStatus.RESUMED
    assert resumed.state == {"node": "awaiting_human"}
    with pytest.raises(ApiError) as caught:
        await restarted_service.resume(owner, created.run_id)
    assert caught.value.status_code == 409


@pytest.mark.asyncio
async def test_foreign_owner_cannot_discover_checkpoint() -> None:
    owner = uuid4()
    foreign = uuid4()
    store = MemoryAgentCheckpointStore()
    created = await store.create_awaiting(
        owner,
        thread_key="mentor:review",
        agent_kind="mentor",
        client_request_id="request-2",
        policy_version="mentor-v1",
        state={"artifact_version": 3},
    )
    with pytest.raises(ApiError) as caught:
        await store.resume(foreign, created.run_id)
    assert caught.value.status_code == 404
