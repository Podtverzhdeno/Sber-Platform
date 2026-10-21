"""Engagement qualification API: idempotent accrual and exclusion of passive events."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import DevelopmentService, MemoryDevelopmentStore
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def _client() -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("engagement-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryDevelopmentStore()
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(store),
    )
    return TestClient(app), store


def _freeze_client() -> tuple[TestClient, MemoryDevelopmentStore]:
    """Standalone app instance so tests can pin the server-side clock override."""
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("engagement-freeze-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryDevelopmentStore()
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(store),
    )
    app.state.local_today_override = date(2026, 10, 22)
    return TestClient(app), store


def _login(client: TestClient, persona_key: str = "participant-alex") -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
    assert response.status_code == 200
    token = response.json()["csrf_token"]
    assert isinstance(token, str)
    return token


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_qualify_creates_one_day_and_is_idempotent_per_source_ref() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        payload = {
            "source": "project_submission",
            "source_ref": "contribution-1",
            "occurred_at": "2026-10-19T21:00:00Z",
        }
        first = client.post(
            "/api/v1/me/engagement/qualify", json=payload, headers={"X-CSRF-Token": csrf}
        )
        assert first.status_code == 200
        assert first.json()["qualified_dates"] == ["2026-10-20"]
        assert first.json()["current_days"] == 1
        assert first.json()["best_days"] == 1

        repeat = client.post(
            "/api/v1/me/engagement/qualify", json=payload, headers={"X-CSRF-Token": csrf}
        )
        assert repeat.status_code == 200
        assert repeat.json()["qualified_dates"] == ["2026-10-20"]
        assert repeat.json()["current_days"] == 1


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_second_qualifying_action_of_same_day_does_not_double_credit() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        for source, ref in (
            ("project_submission", "contribution-1"),
            ("accepted_revision", "revision-7"),
        ):
            response = client.post(
                "/api/v1/me/engagement/qualify",
                json={
                    "source": source,
                    "source_ref": ref,
                    "occurred_at": "2026-10-19T21:00:00Z",
                },
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200
        assert response.json()["qualified_dates"] == ["2026-10-20"]
        assert response.json()["current_days"] == 1


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_passive_and_unknown_sources_rejected() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        passive = client.post(
            "/api/v1/me/engagement/qualify",
            json={
                "source": "login",
                "source_ref": "session-1",
                "occurred_at": "2026-10-19T21:00:00Z",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert passive.status_code == 422
        empty_ref = client.post(
            "/api/v1/me/engagement/qualify",
            json={
                "source": "course_learning",
                "source_ref": "  ",
                "occurred_at": "2026-10-19T21:00:00Z",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert empty_ref.status_code == 422
        assert empty_ref.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.spec("participant-experience/engagement-qualification")
def test_overview_survives_break_and_exposes_best_run() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        for day in ("2026-10-01", "2026-10-02", "2026-10-03"):
            response = client.post(
                "/api/v1/me/engagement/qualify",
                json={
                    "source": "course_learning",
                    "source_ref": f"course-day-{day}",
                    "occurred_at": f"{day}T21:00:00Z",
                },
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200
        overview = client.get("/api/v1/me/engagement/overview")
        assert overview.status_code == 200
        body = overview.json()
        assert body["best_days"] == 3
        assert body["current_days"] == 0
        assert "прервана" in body["reason"]


def test_non_participant_cannot_qualify() -> None:
    client, _store = _client()
    with client:
        _login(client, "mentor-elena")
        response = client.get("/api/v1/me/engagement/overview")
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def _seed_inventory(store: MemoryDevelopmentStore, person_id: UUID, count: int) -> None:
    """Grant stock outside of actor-driven milestones so unittests pin exact inventory."""

    async def seed(count: int) -> None:
        for _ in range(count):
            await store.grant_freeze_day(person_id, datetime.now(UTC), "milestone_1")

    asyncio.run(seed(count))


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_freeze_summary_reports_versioned_policy() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        client.post(
            "/api/v1/me/engagement/qualify",
            json={
                "source": "course_learning",
                "source_ref": "course-day-1",
                "occurred_at": "2026-10-19T21:00:00Z",
            },
            headers={"X-CSRF-Token": csrf},
        )
        summary = client.get("/api/v1/me/engagement/freeze")
        assert summary.status_code == 200
        body = summary.json()
        assert body["policy_version"] == 1
        assert body["granted_total"] == 0
        assert body["available"] == 0
        assert body["consumed_total"] == 0


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_freeze_use_applies_yesterday_bridge_once() -> None:
    client, _store = _freeze_client()
    with client:
        csrf = _login(client)
        for day in ("2026-10-18", "2026-10-19"):
            client.post(
                "/api/v1/me/engagement/qualify",
                json={
                    "source": "project_submission",
                    "source_ref": f"project-{day}",
                    "occurred_at": f"{day}T21:00:00Z",
                },
                headers={"X-CSRF-Token": csrf},
            )
        # Seed exact freeze stock to simulate milestone-earned inventory.
        _seed_inventory(_store, _store.first_engagement_person(), 2)
        result = client.post("/api/v1/me/engagement/freeze/use", headers={"X-CSRF-Token": csrf})
        assert result.status_code == 200
        body = result.json()
        assert body["freeze_state"] == "frozen"
        assert body["current_days"] == 3
        assert "2026-10-21" in " ".join(str(item) for item in body["frozen_dates"])
        summary = client.get("/api/v1/me/engagement/freeze")
        assert summary.json()["available"] == 1
        assert summary.json()["consumed_total"] == 1


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_repeat_overview_never_double_spends_freeze_stock() -> None:
    """B1: repeated dashboard fetches must not consume a second stock day."""
    client, _store = _freeze_client()
    with client:
        csrf = _login(client)
        for day in ("2026-10-18", "2026-10-19"):
            client.post(
                "/api/v1/me/engagement/qualify",
                json={
                    "source": "project_submission",
                    "source_ref": f"project-{day}",
                    "occurred_at": f"{day}T21:00:00Z",
                },
                headers={"X-CSRF-Token": csrf},
            )
        _seed_inventory(_store, _store.first_engagement_person(), 2)
        first = client.get("/api/v1/me/engagement/overview")
        assert first.status_code == 200
        assert first.json()["freeze_state"] == "frozen"
        second = client.get("/api/v1/me/engagement/overview")
        assert second.status_code == 200
        assert second.json()["freeze_state"] == "idle"
        summary = client.get("/api/v1/me/engagement/freeze")
        assert summary.json()["available"] == 1
        assert summary.json()["consumed_total"] == 1
        third = client.get("/api/v1/me/engagement/overview")
        assert third.json()["current_days"] == 3
        assert third.json()["best_days"] == 3


@pytest.mark.spec("participant-experience/engagement-freeze")
def test_freeze_service_block_records_audit_without_consumption() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        client.post(
            "/api/v1/me/engagement/qualify",
            json={
                "source": "course_learning",
                "source_ref": "course-day-1",
                "occurred_at": "2026-10-19T21:00:00Z",
            },
            headers={"X-CSRF-Token": csrf},
        )
        _seed_inventory(_store, _store.first_engagement_person(), 1)
        response = client.post(
            "/api/v1/me/engagement/freeze/service-block",
            json={
                "scope": "provider_outage",
                "explanation": "LMS недоступен весь вечер",
                "occurred_at": "2026-10-20T19:00:00Z",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        audit = response.json()["audit"]
        assert "provider_outage" in audit
        assert "LMS недоступен" in audit
        assert "без расхода заморозки" in audit
        summary = client.get("/api/v1/me/engagement/freeze")
        assert summary.json()["available"] == 1
        assert summary.json()["consumed_total"] == 0
