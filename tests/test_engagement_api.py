"""Engagement qualification API: idempotent accrual and exclusion of passive events."""

from __future__ import annotations

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
