"""PostgreSQL checkpoint adapter using the existing agent tables."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from impulse.ai.gateway import JsonObject, JsonValue
from impulse.api.errors import ApiError
from impulse.application.agents import AgentCheckpoint, AgentCheckpointStore, RunStatus
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.assist import agent_runs, agent_threads


class SqlAgentCheckpointStore(AgentCheckpointStore):
    def __init__(self, database: Database) -> None:
        self.database = database

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
        async with self.database.session() as session:
            thread_id = uuid4()
            await session.execute(
                insert(agent_threads)
                .values(
                    id=thread_id,
                    owner_id=owner_id,
                    agent_kind=agent_kind,
                    thread_key=thread_key,
                    created_by=owner_id,
                )
                .on_conflict_do_nothing(index_elements=["owner_id", "thread_key"])
            )
            thread_id = (
                await session.execute(
                    select(agent_threads.c.id).where(
                        agent_threads.c.owner_id == owner_id,
                        agent_threads.c.thread_key == thread_key,
                    )
                )
            ).scalar_one()
            run_id = uuid4()
            await session.execute(
                insert(agent_runs)
                .values(
                    id=run_id,
                    actor_id=owner_id,
                    thread_id=thread_id,
                    client_request_id=client_request_id,
                    model_policy_version=policy_version,
                    status=RunStatus.AWAITING_HUMAN.value,
                    payload={"state": dict(state)},
                    created_by=owner_id,
                )
                .on_conflict_do_nothing(index_elements=["actor_id", "client_request_id"])
            )
            row = (
                await session.execute(
                    select(agent_runs, agent_threads.c.owner_id)
                    .join(agent_threads, agent_threads.c.id == agent_runs.c.thread_id)
                    .where(
                        agent_runs.c.actor_id == owner_id,
                        agent_runs.c.client_request_id == client_request_id,
                    )
                )
            ).one()
            return _checkpoint(row)

    async def resume(self, owner_id: UUID, run_id: UUID) -> AgentCheckpoint:
        async with self.database.session() as session:
            changed = await session.execute(
                update(agent_runs)
                .where(
                    agent_runs.c.id == run_id,
                    agent_runs.c.actor_id == owner_id,
                    agent_runs.c.status == RunStatus.AWAITING_HUMAN.value,
                )
                .values(status=RunStatus.RESUMED.value, version=agent_runs.c.version + 1)
                .returning(agent_runs.c.id)
            )
            if changed.scalar_one_or_none() is None:
                exists = (
                    await session.execute(
                        select(agent_runs.c.status).where(
                            agent_runs.c.id == run_id, agent_runs.c.actor_id == owner_id
                        )
                    )
                ).scalar_one_or_none()
                if exists is None:
                    raise ApiError("RESOURCE_NOT_FOUND", "Agent run was not found.", 404)
                raise ApiError("AGENT_RUN_ALREADY_RESUMED", "Agent run is no longer awaiting.", 409)
            row = (
                await session.execute(
                    select(agent_runs, agent_threads.c.owner_id)
                    .join(agent_threads, agent_threads.c.id == agent_runs.c.thread_id)
                    .where(agent_runs.c.id == run_id)
                )
            ).one()
            return _checkpoint(row)


def _checkpoint(row: Any) -> AgentCheckpoint:
    payload = cast(JsonObject, dict(row.payload))
    raw_state = payload.get("state")
    state = cast(dict[str, JsonValue], raw_state) if isinstance(raw_state, dict) else {}
    return AgentCheckpoint(
        run_id=row.id,
        thread_id=row.thread_id,
        owner_id=row.owner_id,
        client_request_id=row.client_request_id,
        policy_version=row.model_policy_version,
        status=RunStatus(row.status),
        state=state,
    )
