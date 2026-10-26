"""Agent checkpoint contracts with owner isolation and exactly-once resume."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from impulse.ai.gateway import JsonValue
from impulse.application.errors import ApiError


class RunStatus(StrEnum):
    AWAITING_HUMAN = "awaiting_human"
    RESUMED = "resumed"
    CANCELLED = "cancelled"


@dataclass(frozen=True, slots=True)
class AgentCheckpoint:
    run_id: UUID
    thread_id: UUID
    owner_id: UUID
    client_request_id: str
    policy_version: str
    status: RunStatus
    state: dict[str, JsonValue]


class AgentCheckpointStore(Protocol):
    async def create_awaiting(
        self,
        owner_id: UUID,
        *,
        thread_key: str,
        agent_kind: str,
        client_request_id: str,
        policy_version: str,
        state: Mapping[str, JsonValue],
    ) -> AgentCheckpoint: ...

    async def resume(self, owner_id: UUID, run_id: UUID) -> AgentCheckpoint: ...


class MemoryAgentCheckpointStore:
    def __init__(self) -> None:
        self._threads: dict[tuple[UUID, str], UUID] = {}
        self._runs: dict[UUID, AgentCheckpoint] = {}
        self._requests: dict[tuple[UUID, str], UUID] = {}

    async def create_awaiting(
        self,
        owner_id: UUID,
        *,
        thread_key: str,
        agent_kind: str,
        client_request_id: str,
        policy_version: str,
        state: Mapping[str, JsonValue],
    ) -> AgentCheckpoint:
        del agent_kind
        existing_id = self._requests.get((owner_id, client_request_id))
        if existing_id is not None:
            return self._runs[existing_id]
        thread_id = self._threads.setdefault((owner_id, thread_key), uuid4())
        checkpoint = AgentCheckpoint(
            run_id=uuid4(),
            thread_id=thread_id,
            owner_id=owner_id,
            client_request_id=client_request_id,
            policy_version=policy_version,
            status=RunStatus.AWAITING_HUMAN,
            state=dict(state),
        )
        self._runs[checkpoint.run_id] = checkpoint
        self._requests[(owner_id, client_request_id)] = checkpoint.run_id
        return checkpoint

    async def resume(self, owner_id: UUID, run_id: UUID) -> AgentCheckpoint:
        checkpoint = self._runs.get(run_id)
        if checkpoint is None or checkpoint.owner_id != owner_id:
            raise ApiError("RESOURCE_NOT_FOUND", "Agent run was not found.", 404)
        if checkpoint.status is not RunStatus.AWAITING_HUMAN:
            raise ApiError("AGENT_RUN_ALREADY_RESUMED", "Agent run is no longer awaiting.", 409)
        resumed = AgentCheckpoint(
            run_id=checkpoint.run_id,
            thread_id=checkpoint.thread_id,
            owner_id=checkpoint.owner_id,
            client_request_id=checkpoint.client_request_id,
            policy_version=checkpoint.policy_version,
            status=RunStatus.RESUMED,
            state=checkpoint.state,
        )
        self._runs[run_id] = resumed
        return resumed
