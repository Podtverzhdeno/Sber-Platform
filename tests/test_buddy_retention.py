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


def test_withdrawal_stops_reads_and_deletes_content_but_keeps_audit() -> None:
    service = BuddyConversationService()
    actor = participant()
    thread = service.create_thread(actor)
    service.add_message(actor, thread.id, client_message_id="one", content="private text")
    audit = service.withdraw_memory(actor)
    assert audit.deleted_messages == 1
    assert audit.reason == "consent_withdrawn"
    assert service.deletion_audit == [audit]
    with pytest.raises(ApiError) as caught:
        service.add_message(actor, thread.id, client_message_id="two", content="blocked")
    assert caught.value.code == "AI_MEMORY_DISABLED"


def test_retention_cleanup_is_idempotent() -> None:
    service = BuddyConversationService()
    actor = participant()
    thread = service.create_thread(actor)
    service.add_message(actor, thread.id, client_message_id="old", content="expired")
    cutoff = datetime.now(UTC) + timedelta(seconds=1)
    assert service.cleanup_before(cutoff) == 1
    assert service.cleanup_before(cutoff) == 0
