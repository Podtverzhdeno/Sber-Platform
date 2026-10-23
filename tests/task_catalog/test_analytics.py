"""Closed-dictionary, privacy and idempotency contracts for TC-050."""

from __future__ import annotations

from dataclasses import replace
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from impulse.api.errors import ApiError
from impulse.api.v1.task_catalog import CatalogAnalyticsRequest
from impulse.application.task_catalog_analytics import (
    CatalogAnalyticsCommand,
    CatalogApplicationResult,
    CatalogEventName,
    MemoryCatalogAnalyticsStore,
    TaskCatalogAnalyticsService,
)
from impulse.domain.identity import ActorContext, Role

PERSON_ID = UUID("00000000-0000-0000-0000-000000000001")
TASK_ID = UUID("00000000-0000-0000-0000-000000000701")
EVENT_ID = UUID("00000000-0000-0000-0000-000000000901")


def actor(role: Role = Role.PARTICIPANT) -> ActorContext:
    return ActorContext(
        person_id=PERSON_ID,
        display_name="Синтетический участник",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="task-catalog-test",
        consent_scopes=frozenset(),
    )


def command() -> CatalogAnalyticsCommand:
    return CatalogAnalyticsCommand(
        event_id=EVENT_ID,
        event_name=CatalogEventName.TASK_SELECT,
        task_id=TASK_ID,
        algorithm_version="task-match-v1",
        snapshot_version="task-snapshot-1",
        terms_version=3,
    )


async def test_same_event_id_is_idempotent_but_payload_reuse_is_rejected() -> None:
    store = MemoryCatalogAnalyticsStore()
    service = TaskCatalogAnalyticsService(store)

    first = await service.record(actor(), command())
    duplicate = await service.record(actor(), command())

    assert first.duplicate is False
    assert duplicate.duplicate is True
    with pytest.raises(ApiError, match="другого payload") as raised:
        await service.record(actor(), replace(command(), snapshot_version="task-snapshot-2"))
    assert raised.value.code == "ANALYTICS_EVENT_CONFLICT"


async def test_event_payload_has_no_private_content_or_person_fields() -> None:
    store = MemoryCatalogAnalyticsStore()
    service = TaskCatalogAnalyticsService(store)
    await service.record(actor(), command())
    event = store.events[0]

    assert set(event.payload) == {
        "dictionary_version",
        "event_id",
        "task_id",
        "view",
        "result",
        "algorithm_version",
        "snapshot_version",
        "terms_version",
    }
    assert str(PERSON_ID) not in event.payload.values()
    assert "person_id" not in event.payload
    assert event.payload["task_id"] == str(TASK_ID)


async def test_closed_dictionary_rejects_extra_fields_and_invalid_combinations() -> None:
    with pytest.raises(ValidationError):
        CatalogAnalyticsRequest.model_validate(
            {
                "event_id": str(EVENT_ID),
                "event_name": "catalog_view",
                "title": "private title",
            }
        )
    with pytest.raises(ApiError) as raised:
        await TaskCatalogAnalyticsService(MemoryCatalogAnalyticsStore()).record(
            actor(), replace(command(), event_name=CatalogEventName.CATALOG_VIEW)
        )
    assert raised.value.code == "ANALYTICS_TASK_NOT_ALLOWED"

    with pytest.raises(ApiError) as raised:
        await TaskCatalogAnalyticsService(MemoryCatalogAnalyticsStore()).record(
            actor(), replace(command(), result=CatalogApplicationResult.SUCCESS)
        )
    assert raised.value.code == "ANALYTICS_RESULT_NOT_ALLOWED"


async def test_only_participant_can_write_catalog_analytics() -> None:
    with pytest.raises(ApiError) as raised:
        await TaskCatalogAnalyticsService(MemoryCatalogAnalyticsStore()).record(
            actor(Role.CUSTOMER), command()
        )
    assert raised.value.code == "FORBIDDEN"


async def test_application_result_requires_result_and_valid_view() -> None:
    service = TaskCatalogAnalyticsService(MemoryCatalogAnalyticsStore())
    with pytest.raises(ApiError) as raised:
        await service.record(
            actor(), replace(command(), event_name=CatalogEventName.APPLICATION_RESULT)
        )
    assert raised.value.code == "ANALYTICS_RESULT_REQUIRED"

    with pytest.raises(ApiError) as raised:
        await service.record(
            actor(),
            CatalogAnalyticsCommand(
                event_id=uuid4(), event_name=CatalogEventName.VIEW_CHANGE, view="grid"
            ),
        )
    assert raised.value.code == "ANALYTICS_VIEW_REQUIRED"
