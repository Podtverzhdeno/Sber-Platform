"""Bounded parallel composition of independent read queries."""

from __future__ import annotations

from asyncio import Semaphore, gather
from collections.abc import Awaitable, Callable, Sequence

READ_CONCURRENCY_LIMIT = 8


async def compose_reads[ITEM, OUTPUT](
    items: Sequence[ITEM], worker: Callable[[ITEM], Awaitable[OUTPUT]]
) -> tuple[OUTPUT, ...]:
    if not items:
        return ()
    semaphore = Semaphore(READ_CONCURRENCY_LIMIT)

    async def bounded(item: ITEM) -> OUTPUT:
        async with semaphore:
            return await worker(item)

    return tuple(await gather(*(bounded(item) for item in items)))
