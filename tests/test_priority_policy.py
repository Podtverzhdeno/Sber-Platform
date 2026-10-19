"""Tests for GET /me/growth/next-step — deterministic priority policy (openspec 22.12)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import (
    DevelopmentService,
    MemoryDevelopmentStore,
    RoadmapRecord,
)
from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import RoadmapMilestone
from impulse.domain.priority import (
    StepSpec,
    TargetState,
    select_steps,
)


def _test_settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("test-session-secret-with-more-than-32-chars"),
        session_ttl_seconds=600,
    )


def _client() -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = _test_settings()
    service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    client = TestClient(app)
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    return client, store


def _login(client: TestClient) -> None:
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200


def _roadmap(milestones: tuple[RoadmapMilestone, ...]) -> RoadmapRecord:
    return RoadmapRecord(track_key="python", policy_version=1, milestones=milestones)


def _install_two_milestones(store: MemoryDevelopmentStore) -> None:
    store.install_roadmap(
        _roadmap(
            (
                RoadmapMilestone(
                    "foundation",
                    1,
                    "Освоить основу",
                    "Создать базу для первой практической задачи.",
                    "Python-разработчик",
                    "course",
                    "openspec-sdd",
                ),
                RoadmapMilestone(
                    "practice",
                    2,
                    "Применить на практике",
                    "Собрать проверяемый артефакт для портфолио.",
                    "Проектная работа",
                    "task",
                    "demo-task-1",
                ),
            )
        )
    )


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_next_step_requires_authentication() -> None:
    client, _ = _client()
    response = client.get("/api/v1/me/growth/next-step")
    assert response.status_code == 401


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_next_step_returns_policy_sorted_steps() -> None:
    client, store = _client()
    _login(client)
    _install_two_milestones(store)
    response = client.get("/api/v1/me/growth/next-step")
    assert response.status_code == 200
    payload = response.json()
    assert payload["policy_version"] == 1
    assert len(payload["steps"]) == 1
    assert payload["steps"][0]["available"] is True
    scores = [item["score"] for item in payload["steps"]]
    assert scores == sorted(scores, reverse=True)
    available = payload["next_available"]
    assert available is not None
    assert available["trajectory_key"] == "python"


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_equal_score_breaks_tie_by_trajectory_position_then_key() -> None:
    specs = (
        StepSpec("python", 0, 1, "m1", "course", "alpha-course", "Alpha"),
        StepSpec("data", 1, 1, "m2", "course", "beta-course", "Beta"),
        StepSpec("python", 0, 2, "m3", "course", "gamma-course", "Gamma"),
    )
    states = {("course", spec.target_key): TargetState(True) for spec in specs}
    result = select_steps(specs, states)
    ordered = [item.spec.target_key for item in result.steps]
    assert ordered == ["alpha-course", "gamma-course", "beta-course"]


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_closed_project_is_reported_as_stale_but_kept_in_output() -> None:
    specs = (StepSpec("python", 0, 2, "practice", "task", "closed-task", "Закрытый проект"),)
    states = {("task", "closed-task"): TargetState(True, closed=True)}
    result = select_steps(specs, states)
    step = result.steps[0]
    assert step.available is False
    assert step.stale_reason == "project_closed"
    assert result.next_available() is None


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_filled_places_move_availability_to_locked() -> None:
    specs = (StepSpec("python", 0, 2, "practice", "task", "full-task", "Занятые места"),)
    states = {("task", "full-task"): TargetState(True, places_filled=True)}
    result = select_steps(specs, states)
    step = result.steps[0]
    assert step.available is False
    assert step.stale_reason == "places_filled"


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_unpublished_target_reports_roadmap_version_change() -> None:
    specs = (StepSpec("python", 0, 2, "practice", "course", "old-course", "Старый курс"),)
    states = {("course", "old-course"): TargetState(published=False)}
    result = select_steps(specs, states)
    step = result.steps[0]
    assert step.available is False
    assert step.stale_reason == "roadmap_version_changed"
    factors = step.factors
    assert "availability_locked" in factors


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_deadline_adjusts_score_without_changing_order_beyond_urgency() -> None:
    near = datetime.now(UTC) + timedelta(hours=24)
    specs = (
        StepSpec("python", 0, 1, "m1", "task", "urgent-task", "Срочная"),
        StepSpec("python", 0, 2, "m2", "task", "open-task", "Обычная"),
    )
    states = {
        ("task", "urgent-task"): TargetState(True, deadline_at=near),
        ("task", "open-task"): TargetState(True),
    }
    result = select_steps(specs, states)
    urgent = next(item for item in result.steps if item.spec.target_key == "urgent-task")
    other = next(item for item in result.steps if item.spec.target_key == "open-task")
    assert urgent.score > other.score
    assert "deadline_due_today" in urgent.factors


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_workload_penalty_reduces_score_for_heavy_steps() -> None:
    specs = (
        StepSpec("python", 0, 1, "m1", "task", "heavy-task", "Тяжёлая"),
        StepSpec("python", 0, 2, "m2", "task", "light-task", "Лёгкая"),
    )
    states = {
        ("task", "heavy-task"): TargetState(True, effort_hours=40),
        ("task", "light-task"): TargetState(True, effort_hours=4),
    }
    result = select_steps(specs, states)
    heavy = next(item for item in result.steps if item.spec.target_key == "heavy-task")
    light = next(item for item in result.steps if item.spec.target_key == "light-task")
    assert heavy.score < light.score
    assert "workload_penalty" in heavy.factors


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_next_step_switches_with_active_trajectory_selection() -> None:
    client, store = _client()
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200
    csrf = login.json()["csrf_token"]
    _install_two_milestones(store)
    response = client.post(
        "/api/v1/me/tracks",
        json={"track_key": "data", "freeze_track_key": "python"},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200
    payload = client.get("/api/v1/me/growth/next-step").json()
    assert payload["steps"], "switched trajectory must produce steps"
    trajectory_keys = {item["trajectory_key"] for item in payload["steps"]}
    assert trajectory_keys == {"data"}


@pytest.mark.spec("participant-experience/deterministic-next-step")
def test_workload_penalty_is_deterministic_for_equal_inputs() -> None:
    specs = (StepSpec("python", 0, 1, "m1", "task", "fixed-task", "Фиксированная"),)
    states = {("task", "fixed-task"): TargetState(True, effort_hours=10)}
    first = select_steps(specs, states).steps[0].score
    second = select_steps(specs, states).steps[0].score
    assert first == second
