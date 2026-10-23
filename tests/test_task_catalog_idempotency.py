"""Application idempotency contract used by the catalog apply lane."""

from __future__ import annotations

from uuid import uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.work import MemoryWorkStore


@pytest.mark.asyncio
async def test_repeated_scoped_key_is_one_application_and_conflicting_key_is_rejected() -> None:
    store = MemoryWorkStore()
    person_id = uuid4()
    task_id = uuid4()
    await store.accept_terms(person_id, task_id, 1)

    first = await store.apply(person_id, task_id, 1, "catalog-key-0001")
    second = await store.apply(person_id, task_id, 1, "catalog-key-0001")

    assert first == second
    assert first.idempotency_key == "catalog-key-0001"
    with pytest.raises(ApiError) as error:
        await store.apply(person_id, task_id, 1, "catalog-key-0002")
    assert error.value.code == "IDEMPOTENCY_KEY_REUSED"
