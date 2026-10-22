"""GET /participant/me/development-overview: canonical home-v2 read contract."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import (
    DevelopmentService,
    MemoryDevelopmentStore,
)
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.engagement import EngagementSource, WeeklyRhythm

LOCAL_TODAY = date(2026, 10, 20)  # Tuesday of ISO week 43
OVERVIEW_PATH = "/api/v1/participant/me/development-overview"
PARTICIPANT = demo_id("participant-alex")

INDEPENDENT_CONCEPT_SURFACES = (
    "competency_level",
    "stage_progress",
    "readiness_percent",
    "rating_xp",
    "review_grade",
)


def _client(local_today: date = LOCAL_TODAY) -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("development-overview-test-secret-32"),
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


def _login(client: TestClient, persona_key: str = "participant-alex") -> None:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
    assert response.status_code == 200


def _overview(client: TestClient) -> Any:
    response = client.get(OVERVIEW_PATH)
    assert response.status_code == 200
    return response.json()


@pytest.mark.spec("participant-experience/home-data-real-fresh")
def test_overview_requires_participant_session() -> None:
    client, _store = _client()
    assert client.get(OVERVIEW_PATH).status_code == 401
    with client:
        _login(client, "customer-roman")
        forbidden = client.get(OVERVIEW_PATH)
    assert forbidden.status_code == 403


@pytest.mark.spec("career-grades/concepts-are-independent")
def test_overview_reports_not_evaluable_grade_and_independent_concepts() -> None:
    client, _store = _client()
    with client:
        _login(client)
        payload = _overview(client)
    assert payload["overview_version"] == 1
    assert payload["local_today"] == LOCAL_TODAY.isoformat()
    assert payload["permissions"] == {
        "trajectory_switch": True,
        "grade_request": False,
        "share": False,
    }
    concepts = payload["concepts"]
    assert set(concepts) == {"career_grade", *INDEPENDENT_CONCEPT_SURFACES}
    grade = concepts["career_grade"]
    assert grade["state"] == "not_evaluable"
    assert grade["current_grade"] is None
    assert grade["catalog_version"] is None
    assert grade["auto_transition"] is False
    for name in INDEPENDENT_CONCEPT_SURFACES:
        assert concepts[name]["independent"] is True
        assert concepts[name]["value_state"] == "separate_surface"


@pytest.mark.spec("participant-experience/weekly-focus-navigable")
def test_weekly_focus_reflects_saved_rhythm_and_qualified_days() -> None:
    client, store = _client()
    asyncio.run(
        store.save_weekly_rhythm(
            PARTICIPANT,
            WeeklyRhythm(
                version=1,
                preset="workdays",
                active_days=frozenset({1, 2, 3, 4, 5}),
                reminder_hour=18,
                reminder_window_hours=2,
                effective_from=date(2026, 10, 1),
            ),
        )
    )
    for day in (date(2026, 10, 20), date(2026, 10, 21)):
        asyncio.run(
            store.record_engagement_event(
                PARTICIPANT,
                EngagementSource.COURSE_LEARNING,
                f"course:{day.isoformat()}",
                day,
                "Europe/Moscow",
            )
        )
    with client:
        _login(client)
        payload = _overview(client)
    focus = payload["weekly_focus"]
    assert focus["versioned"] is True
    assert focus["preset"] == "workdays"
    assert focus["week_start"] == "2026-10-19"
    assert focus["week_end"] == "2026-10-25"
    assert focus["target_days"] == 5
    assert focus["done_days"] == 2
    days = focus["days"]
    assert len(days) == 7
    by_date = {item["date"]: item for item in days}
    assert by_date["2026-10-19"]["planned"] is True
    assert by_date["2026-10-19"]["done"] is False
    assert by_date["2026-10-20"]["done"] is True
    assert by_date["2026-10-21"]["done"] is True
    assert by_date["2026-10-24"]["planned"] is False  # Saturday


@pytest.mark.spec("career-grades/multiple-trajectories-remain-isolated")
def test_roles_distinguish_active_paused_and_unselected_states() -> None:
    client, store = _client()
    asyncio.run(
        store.replace_attempts(
            PARTICIPANT,
            (
                TrackAttempt("python", 2, TrackStatus.ACTIVE, frozenset({"foundation"})),
                TrackAttempt("data", 1, TrackStatus.FROZEN),
            ),
        )
    )
    with client:
        _login(client)
        payload = _overview(client)
    roles = {role["track_key"]: role for role in payload["roles"]}
    assert set(roles) == {"python", "data", "product", "ml"}
    python = roles["python"]
    assert python["state"] == "active"
    assert python["attempt_number"] == 2
    assert python["completed_milestones"] == 1
    assert python["total_milestones"] == 2
    data = roles["data"]
    assert data["state"] == "paused"
    assert data["attempt_number"] == 1
    for unselected in ("product", "ml"):
        assert roles[unselected]["state"] == "unselected"
        assert roles[unselected]["attempt_number"] is None
        assert roles[unselected]["completed_milestones"] == 0


@pytest.mark.spec("participant-experience/next-outcome-first-row")
def test_next_outcome_uses_priority_engine_on_active_trajectory() -> None:
    client, _store = _client()
    with client:
        _login(client)
        payload = _overview(client)
    next_outcome = payload["next_outcome"]
    assert next_outcome is not None
    assert next_outcome["trajectory_key"] == "python"
    assert next_outcome["target_kind"] == "course"
    assert next_outcome["target_key"] == "python-base"
    assert next_outcome["milestone_position"] == 1
    assert next_outcome["policy_version"] >= 1
    assert isinstance(next_outcome["reasons"], list)


def test_next_outcome_is_none_without_active_attempts() -> None:
    client, store = _client()
    asyncio.run(store.replace_attempts(PARTICIPANT, ()))
    with client:
        _login(client)
        payload = _overview(client)
    assert payload["next_outcome"] is None
