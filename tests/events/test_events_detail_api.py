"""Contract tests for the participant event detail and registration counters."""

from __future__ import annotations

import asyncio
import uuid
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.ecosystem import ClaimStatus
from impulse.domain.identity import ActorContext, Role
from impulse.events.models import RegistrationCounts
from impulse.events.service import ParticipantEventsService
from impulse.events.store import MemoryEventDetailStore


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _events_store() -> tuple[ParticipantEventsService, MemoryEventDetailStore]:
    service = ParticipantEventsService(MemoryEventDetailStore())
    store = service.detail_store
    assert isinstance(store, MemoryEventDetailStore)
    return service, store


def _memory_events_service_from_app(
    app: FastAPI,
) -> tuple[ParticipantEventsService, MemoryEventDetailStore]:
    service = cast(ParticipantEventsService, app.state.participant_events_service)
    store = service.detail_store
    assert isinstance(store, MemoryEventDetailStore)
    return service, store


@pytest.mark.spec("22.19")
def test_event_detail_exposes_published_facts() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        login(client, "participant-alex")
        response = client.get("/api/v1/ecosystem/events/mayaki-2026")
        assert response.status_code == 200
        payload = response.json()
        assert payload["key"] == "mayaki-2026"
        assert payload["title"] == "МАЯКИ 2026"
        assert payload["organizer"] == "Сбер"
        assert payload["conditions"]
        assert payload["source_url"] == "https://example.test/events/mayaki"
        assert payload["source_status"] == "current"
        assert payload["source_checked_at"]
        assert payload["recommendation_reason"]
        assert payload["description"]
        assert payload["target_audience"]
        assert payload["participation_rules"]
        assert payload["timezone"] == "Europe/Moscow"
        assert "venue_format" in payload
        program = payload["program"]
        assert program is not None and len(program) >= 2
        assert {"day", "title", "detail"} <= set(program[0])
        assert payload["track_keys"] == ["python", "data", "product"]
        rewards = payload["rewards"]
        assert rewards is not None
        assert rewards[0]["kind"] == "frozen_points"
        assert payload["starts_at"] is None
        assert payload["deadline_at"] is None


@pytest.mark.spec("22.19")
def test_event_detail_serves_other_roles() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        personas = [
            persona["key"]
            for persona in client.get("/api/v1/auth/personas").json()
            if "participant" in persona["roles"]
        ]
        assert personas
        login(client, personas[0])
        response = client.get("/api/v1/ecosystem/events/research-grant-2026")
        assert response.status_code == 200


@pytest.mark.spec("22.19")
def test_unauthenticated_detail_and_counters_are_rejected() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        for path in (
            "/api/v1/ecosystem/events/mayaki-2026",
            "/api/v1/ecosystem/events/mayaki-2026/registration",
        ):
            response = client.get(path)
            assert response.status_code == 401
            assert response.json()["code"] == "AUTH_REQUIRED"


@pytest.mark.spec("22.19")
def test_unknown_event_returns_identical_nondisclosing_404() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        login(client, "participant-alex")
        detail = client.get("/api/v1/ecosystem/events/unknown-key")
        counters = client.get("/api/v1/ecosystem/events/unknown-key/registration")
        assert detail.status_code == counters.status_code == 404
        detail_body, counters_body = detail.json(), counters.json()
        assert detail_body["code"] == counters_body["code"] == "RESOURCE_NOT_FOUND"
        assert detail_body["message"] == counters_body["message"]
        assert "mayaki" not in detail.text
        assert "mayaki" not in counters.text


@pytest.mark.spec("22.19")
def test_registration_aggregate_distinguishes_confirmed_and_participation() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        _service, store = _memory_events_service_from_app(app)
        store.record_claim("mayaki-2026", "person-started", ClaimStatus.REPORTED)
        store.record_claim("mayaki-2026", "person-confirmed", ClaimStatus.AWAITING_VERIFICATION)
        store.record_claim("mayaki-2026", "person-verified", ClaimStatus.VERIFIED)
        login(client, "participant-alex")
        response = client.get("/api/v1/ecosystem/events/mayaki-2026/registration")
        assert response.status_code == 200
        payload = response.json()
        assert payload["started_registrations"] == 1
        assert payload["confirmed_registrations"] == 2
        assert payload["participations"] == 1
        assert payload["counter_state"] == "ok"
        assert payload["computed_at"]
        assert payload["definition_version"] == 1
        assert payload["definition"] == "confirmed_registrations"
        assert payload["contains_personal_data"] is False
        assert "подтверждённ" in payload["definition_text"]


@pytest.mark.spec("22.19")
def test_registration_aggregate_reports_zero_when_no_claims() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        login(client, "participant-alex")
        response = client.get("/api/v1/ecosystem/events/green-hack-2026/registration")
        assert response.status_code == 200
        payload = response.json()
        assert payload["counter_state"] == "zero"
        assert payload["started_registrations"] == 0
        assert payload["confirmed_registrations"] == 0
        assert payload["participations"] == 0


@pytest.mark.spec("22.19")
def test_registration_aggregate_marks_unavailable_projection_unknown() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        _service, store = _memory_events_service_from_app(app)
        store.mark_projection_unavailable("mayaki-2026")
        login(client, "participant-alex")
        response = client.get("/api/v1/ecosystem/events/mayaki-2026/registration")
        assert response.status_code == 200
        payload = response.json()
        assert payload["counter_state"] == "unknown"
        assert payload["started_registrations"] is None
        assert payload["confirmed_registrations"] is None
        assert payload["participations"] is None


@pytest.mark.spec("22.19")
def test_revoked_and_rejected_claims_leave_public_counters() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        _service, store = _memory_events_service_from_app(app)
        login(client, "participant-alex")
        store.record_claim("mayaki-2026", "person-revoked", ClaimStatus.REVOKED)
        store.record_claim("mayaki-2026", "person-rejected", ClaimStatus.REJECTED)
        response = client.get("/api/v1/ecosystem/events/mayaki-2026/registration")
        payload = response.json()
        assert payload["counter_state"] == "zero"
        assert payload["started_registrations"] == 0


def test_service_aggregate_reuses_published_record() -> None:
    _service, store = _events_store()
    actor = ActorContext(
        person_id=uuid.uuid4(),
        display_name="Алекс",
        active_role=Role.PARTICIPANT,
        assigned_roles=(),
        scopes=frozenset(),
        program_key="impulse-demo",
        consent_scopes=frozenset(),
    )
    store.record_claim("research-grant-2026", "person", ClaimStatus.REPORTED)
    aggregate = asyncio.run(_service.registration_aggregate(actor, "research-grant-2026"))
    assert aggregate.counter_state == "ok"
    assert aggregate.started_registrations == 1
    assert aggregate.confirmed_registrations == 0
    assert aggregate.participations == 0
    counts = asyncio.run(store.registration_counts("research-grant-2026"))
    assert counts == RegistrationCounts(1, 0, 0)
