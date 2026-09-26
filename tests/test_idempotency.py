"""Concurrent idempotency behavior at the API boundary."""

import asyncio

import httpx
import pytest
from fastapi import Header

from impulse.api.errors import ApiError
from impulse.application.idempotency import InMemoryIdempotencyStore
from impulse.bootstrap.app import create_app


@pytest.mark.asyncio
async def test_concurrent_command_executes_once() -> None:
    app = create_app()
    store = InMemoryIdempotencyStore()
    calls = 0

    @app.post("/api/v1/test-command")
    async def command(idempotency_key: str = Header(alias="Idempotency-Key")) -> dict[str, int]:
        async def operation() -> dict[str, int]:
            nonlocal calls
            calls += 1
            await asyncio.sleep(0.02)
            return {"sequence": calls}

        return await store.execute(
            scope="test-command",
            key=idempotency_key,
            fingerprint="same-body",
            operation=operation,
        )

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first, second = await asyncio.gather(
            client.post("/api/v1/test-command", headers={"Idempotency-Key": "request-00000001"}),
            client.post("/api/v1/test-command", headers={"Idempotency-Key": "request-00000001"}),
        )

    assert calls == 1
    assert first.json() == second.json() == {"sequence": 1}


@pytest.mark.asyncio
async def test_same_key_with_changed_payload_is_rejected() -> None:
    store = InMemoryIdempotencyStore()

    async def operation() -> str:
        return "ok"

    await store.execute(
        scope="task:accept",
        key="request-00000002",
        fingerprint="v1",
        operation=operation,
    )

    with pytest.raises(ApiError, match="другого набора данных") as captured:
        await store.execute(
            scope="task:accept",
            key="request-00000002",
            fingerprint="v2",
            operation=operation,
        )
    assert captured.value.code == "IDEMPOTENCY_CONFLICT"
