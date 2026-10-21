"""Monthly goal contract: versioned plans and evidence-safe contours."""

from __future__ import annotations

import asyncio
from datetime import date

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import (
    DevelopmentService,
    MemoryDevelopmentStore,
)
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.engagement import WeeklyRhythm


def _client(local_today: date = date(2026, 10, 20)) -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("monthly-goal-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryDevelopmentStore()
    app = create_app(settings, auth_service=auth, development_service=DevelopmentService(store))
    app.state.local_today_override = local_today
    return TestClient(app), store


def _login(client: TestClient, persona_key: str = "participant-alex") -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
    assert response.status_code == 200
    return str(response.json()["csrf_token"])


def _claim(client: TestClient, csrf: str, milestone: str = "practice"):
    return client.post(
        "/api/v1/me/growth/monthly-goal",
        json={"track_key": "python", "milestone_key": milestone},
        headers={"X-CSRF-Token": csrf},
    )


def test_goal_is_empty_until_participant_claims_it() -> None:
    client, _store = _client()
    with client:
        _login(client)
        response = client.get("/api/v1/me/growth/monthly-goal")
    assert response.status_code == 200
    assert response.json() is None


def test_goal_exposes_baseline_plan_partial_coverage_and_version_history() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        first = _claim(client, csrf)
        second = _claim(client, csrf)
    assert first.status_code == 200
    assert first.json()["contours"] == {
        "baseline": 0,
        "current": 0,
        "projected": 0,
        "target": 2,
    }
    assert first.json()["remaining"] == 2
    assert first.json()["partial_forecast"] is True
    assert first.json()["missing_mappings"] == ["checkpoint:practice"]
    assert first.json()["plan_version"] == 1
    assert second.json()["plan_version"] == 2
    assert second.json()["history_count"] == 2


def test_reported_checkpoint_changes_projected_but_not_current() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        reported = client.post(
            "/api/v1/me/courses/python-base/completion",
            headers={"X-CSRF-Token": csrf},
        )
        assert reported.status_code == 200
        goal = _claim(client, csrf, "foundation")
    assert goal.status_code == 200
    assert goal.json()["steps"][0]["status"] == "submitted"
    assert goal.json()["contours"]["current"] == 0
    assert goal.json()["contours"]["projected"] == 1


def test_verified_roadmap_fact_moves_current_contour() -> None:
    client, store = _client()
    participant_id = demo_personas()[0].person_id
    with client:
        csrf = _login(client)
        assert _claim(client, csrf, "foundation").status_code == 200
        asyncio.run(
            store.replace_attempts(
                participant_id,
                (TrackAttempt("python", 1, TrackStatus.ACTIVE, frozenset({"foundation"})),),
            )
        )
        refreshed = client.get("/api/v1/me/growth/monthly-goal")
    assert refreshed.json()["contours"]["baseline"] == 0
    assert refreshed.json()["contours"]["current"] == 1
    assert refreshed.json()["contours"]["projected"] == 1


def test_infeasible_goal_explains_concrete_rhythm_deficit() -> None:
    client, store = _client(date(2026, 10, 30))
    participant_id = demo_personas()[0].person_id
    asyncio.run(
        store.save_weekly_rhythm(
            participant_id,
            WeeklyRhythm(
                version=1,
                preset="custom",
                active_days=frozenset({1}),
                reminder_hour=18,
                reminder_window_hours=2,
                effective_from=date(2026, 10, 1),
            ),
        )
    )
    with client:
        csrf = _login(client)
        response = _claim(client, csrf)
    feasibility = response.json()["feasibility"]
    assert feasibility["known"] is True
    assert feasibility["feasible"] is False
    assert feasibility["required_steps"] == 2
    assert feasibility["capacity_days"] == 0
    assert feasibility["deficit"] == 2
    assert "2" in feasibility["text"]


def test_monthly_goal_is_participant_only() -> None:
    client, _store = _client()
    with client:
        _login(client, "mentor-elena")
        response = client.get("/api/v1/me/growth/monthly-goal")
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
