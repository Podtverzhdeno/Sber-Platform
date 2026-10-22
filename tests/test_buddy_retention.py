"""Immediate consent withdrawal and bounded retention cleanup."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.buddy import BuddyConversationService
from impulse.domain.identity import ActorContext, Role


def participant() -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Owner",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


@pytest.mark.asyncio
async def test_withdrawal_stops_reads_and_deletes_content_but_keeps_audit() -> None:
    service = BuddyConversationService()
    actor = participant()
    thread = await service.create_thread(actor)
    await service.add_message(actor, thread.id, client_message_id="one", content="private text")
    audit = await service.withdraw_memory(actor)
    assert audit.deleted_messages == 1
    assert audit.reason == "consent_withdrawn"
    assert await service.deletion_audits() == (audit,)
    with pytest.raises(ApiError) as blocked_add:
        await service.add_message(actor, thread.id, client_message_id="two", content="blocked")
    assert blocked_add.value.code == "AI_MEMORY_DISABLED"
    with pytest.raises(ApiError) as blocked_read:
        await service.thread(actor, thread.id)
    assert blocked_read.value.code == "AI_MEMORY_DISABLED"


@pytest.mark.asyncio
async def test_retention_cleanup_is_idempotent() -> None:
    service = BuddyConversationService()
    actor = participant()
    thread = await service.create_thread(actor)
    await service.add_message(actor, thread.id, client_message_id="old", content="expired")
    cutoff = datetime.now(UTC) + timedelta(seconds=1)
    assert await service.cleanup_before(cutoff) == 1
    assert await service.cleanup_before(cutoff) == 0
