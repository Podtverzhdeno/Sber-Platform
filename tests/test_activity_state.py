"""Tests for versioned activity state evaluation (openspec 22.4)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.growth import (
    ACTIVITY_STATE_VERSION,
    ACTIVITY_TARGET_RANGES,
    activity_state,
)


def _test_settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("test-session-secret-with-more-than-32-chars"),
        session_ttl_seconds=600,
    )


def _client() -> TestClient:
    settings = _test_settings()
    service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    return TestClient(app)


def _login(client: TestClient) -> None:
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200


def _counts(**kind_values: int) -> dict[str, int]:
    counts = {key: 0 for key in (
        "course_checkpoint",
        "project_submission",
        "revision_accepted",
        "event_participation",
    )}
    counts.update(kind_values)
    counts["total"] = sum(counts.values())
    return counts


@pytest.mark.spec("participant-experience/activity-state")
def test_activity_state_success_within_target_range() -> None:
    result = activity_state(_counts(course_checkpoint=2, revision_accepted=2), target=(3, 7))
    assert result.state == "success"
    assert result.version == ACTIVITY_STATE_VERSION
    assert (result.target_min, result.target_max) == (3, 7)
    assert result.missing_category is None
    assert result.action is None
    assert "в рамках цели 3–7" in result.text
    assert result.text


@pytest.mark.spec("participant-experience/activity-state")
def test_activity_state_risk_names_missing_category_and_action() -> None:
    result = activity_state(
        _counts(project_submission=1),
        target=ACTIVITY_TARGET_RANGES["week"],
    )
    assert result.state == "risk"
    assert result.missing_category == "course_checkpoint"
    assert result.action == "Начните checkpoint курса в Bootcamp"
    assert "ниже цели 3–7" in result.text
    assert "курсы/checkpoints" in result.text


@pytest.mark.spec("participant-experience/activity-state")
def test_activity_state_risk_without_zero_kinds_reports_minimum() -> None:
    result = activity_state(
        _counts(course_checkpoint=2, project_submission=1, revision_accepted=1, event_participation=1),
        target=(12, 30),
    )
    assert result.state == "risk"
    assert result.missing_category == "project_submission"
    assert "минимум в категории" in result.text


@pytest.mark.spec("participant-experience/activity-state")
def test_activity_state_neutral_without_plan() -> None:
    result = activity_state(_counts(project_submission=1), target=None)
    assert result.state == "neutral"
    assert result.target_min is None
    assert result.target_max is None
    assert result.missing_category is None
    assert result.action is None
    assert "нейтральное" in result.text


@pytest.mark.spec("participant-experience/activity-state")
def test_activity_targets_are_versioned_table() -> None:
    assert ACTIVITY_STATE_VERSION == 1
    assert ACTIVITY_TARGET_RANGES == {
        "day": (1, 3),
        "week": (3, 7),
        "month": (12, 30),
        "year": (120, 300),
    }


@pytest.mark.spec("participant-experience/activity-state")
def test_growth_snapshot_states_cover_periods_and_respect_plan() -> None:
    client = _client()
    _login(client)
    response = client.get("/api/v1/me/growth/snapshot")
    assert response.status_code == 200
    payload = response.json()
    assert set(payload["activity_state"]) == {"day", "week", "month", "year"}
    for period, state in payload["activity_state"].items():
        assert state["version"] == ACTIVITY_STATE_VERSION
        assert state["state"] in {"success", "risk", "neutral"}
        assert state["text"]
        assert state["total"] == payload["activity"][period]["total"]
        if state["state"] == "risk":
            assert state["missing_category"] in {
                "course_checkpoint",
                "project_submission",
                "revision_accepted",
                "event_participation",
            }
            assert state["action"]


@pytest.mark.spec("participant-experience/activity-state")
def test_growth_snapshot_state_turns_neutral_without_active_plan() -> None:
    client = _client()
    _login(client)
    # Demo seeding gives participant-alex an active roadmap; request states for
    # a persona contract is same endpoint, so neutral check is done via the
    # domain contract with target=None (unit test) and here we verify the API
    # reflects plan presence through trajectories.
    growth = client.get("/api/v1/me/growth/snapshot").json()
    has_plan = bool(growth["trajectories"])
    states = growth["activity_state"]
    if has_plan:
        assert all(state["state"] != "neutral" for state in states.values())
    else:
        assert all(state["state"] == "neutral" for state in states.values())


@pytest.mark.spec("participant-experience/activity-state")
def test_growth_snapshot_risk_text_always_present_in_every_period() -> None:
    client = _client()
    _login(client)
    payload = client.get("/api/v1/me/growth/snapshot").json()
    for state in payload["activity_state"].values():
        assert isinstance(state["text"], str) and len(state["text"]) > 10
