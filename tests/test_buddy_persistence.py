"""Restart safety of Buddy history on the shared storage (29.3)."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.buddy import BuddyConversationService, MemoryBuddyStorage
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
async def test_history_and_feedback_survive_service_restart() -> None:
    storage = MemoryBuddyStorage()
    actor = participant()
    before = BuddyConversationService(storage)
    thread = await before.create_thread(actor)
    message = await before.add_message(
        actor, thread.id, client_message_id="m1", content="история диалога"
    )
    feedback = await before.feedback(actor, thread.id, rating=4)

    after = BuddyConversationService(storage)
    seen = await after.thread(actor, thread.id)
    assert seen.messages == (message,)
    assert seen.status == "active"
    replayed = await after.add_message(
        actor, thread.id, client_message_id="m1", content="повторный запрос"
    )
    assert replayed is message
    updated = await after.feedback(actor, thread.id, rating=5)
    assert updated.rating == 5
    assert feedback.rating == 4


@pytest.mark.asyncio
async def test_consent_withdrawal_survives_restart() -> None:
    storage = MemoryBuddyStorage()
    actor = participant()
    before = BuddyConversationService(storage)
    thread = await before.create_thread(actor)
    await before.add_message(actor, thread.id, client_message_id="seed", content="данные")
    await before.withdraw_memory(actor)

    restarted = BuddyConversationService(storage)
    with pytest.raises(ApiError) as blocked_write:
        await restarted.add_message(actor, thread.id, client_message_id="later", content="blocked")
    assert blocked_write.value.code == "AI_MEMORY_DISABLED"
    with pytest.raises(ApiError) as blocked_read:
        await restarted.thread(actor, thread.id)
    assert blocked_read.value.code == "AI_MEMORY_DISABLED"
    audits = await restarted.deletion_audits()
    assert len(audits) == 1
    assert audits[0].reason == "consent_withdrawn"
    assert audits[0].deleted_messages == 1


@pytest.mark.asyncio
async def test_suggestion_hiding_survives_restart() -> None:
    storage = MemoryBuddyStorage()
    actor = participant()
    before = BuddyConversationService(storage)
    await before.dismiss_suggestion(actor, "s-dismissed")
    await before.mark_suggestion_irrelevant(actor, "s-irrelevant")
    snoozed_until = datetime.now(UTC) + timedelta(days=1)
    await before.snooze_suggestion(actor, "s-snoozed", until=snoozed_until)

    restarted = BuddyConversationService(storage)
    now = datetime.now(UTC)
    assert await restarted.suggestion_hidden(actor.person_id, "s-dismissed", now=now) is True
    assert await restarted.suggestion_hidden(actor.person_id, "s-irrelevant", now=now) is True
    assert await restarted.suggestion_hidden(actor.person_id, "s-snoozed", now=now) is True
    later = now + timedelta(days=2)
    assert await restarted.suggestion_hidden(actor.person_id, "s-snoozed", now=later) is False
