"""Versioned domain event schema and privacy tests."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from impulse.domain.events import DomainEventEnvelope, UnsafeEventPayload, safe_event_payload


def test_event_envelope_has_explicit_schema_and_entity_versions() -> None:
    event = DomainEventEnvelope(
        event_key="case:1:resolved:v1",
        event_type="operations.case_decided",
        schema_version=1,
        entity_type="operations_cases",
        entity_id=uuid4(),
        entity_version=2,
        actor_id=uuid4(),
        occurred_at=datetime.now(UTC),
        payload=safe_event_payload({"status": "resolved", "count": 1}),
    )
    assert event.schema_version == 1
    assert event.entity_version == 2


@pytest.mark.parametrize(
    "payload",
    [
        {"raw_chat": "private conversation"},
        {"agent": {"prompt": "hidden prompt"}},
        {"payment": {"card_number": "4111111111111111"}},
        {"payment_details": {"bank": "private"}},
        {"api_key": "secret"},
    ],
)
def test_event_payload_rejects_raw_chat_and_payment_details(payload: dict[str, object]) -> None:
    with pytest.raises(UnsafeEventPayload):
        safe_event_payload(payload)


def test_event_payload_keeps_only_supported_metadata_shapes() -> None:
    entity_id = uuid4()
    payload = safe_event_payload(
        {"entity_id": entity_id, "status": "accepted", "refs": ["task:1", "review:2"]}
    )
    assert payload == {
        "entity_id": str(entity_id),
        "status": "accepted",
        "refs": ["task:1", "review:2"],
    }
