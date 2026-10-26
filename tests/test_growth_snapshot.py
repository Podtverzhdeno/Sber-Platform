"""Tests for GET /me/growth/snapshot — versioned growth projection (openspec 22.11)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import (
    DevelopmentService,
    EnrollmentRecord,
    MemoryDevelopmentStore,
    RoadmapRecord,
)
from impulse.application.growth import GrowthService
from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.application.work import WorkItem
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import CompletionStatus, RoadmapMilestone
from impulse.domain.growth import merge_intervals, merged_minutes
from impulse.domain.work import ContributionStatus


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


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_growth_snapshot_requires_authentication() -> None:
    client, _store = _client()
    response = client.get("/api/v1/me/growth/snapshot")
    assert response.status_code == 401


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_growth_snapshot_returns_versioned_definitions_and_boundaries() -> None:
    client, _store = _client()
    _login(client)
    response = client.get("/api/v1/me/growth/snapshot")
    assert response.status_code == 200
    payload = response.json()
    assert payload["snapshot_version"] == 2
    assert set(payload["definitions"]) == {
        "activity",
        "hours",
        "milestones",
        "readiness",
        "snapshot",
    }
    assert set(payload["period_boundaries"]) == {"day", "week", "month", "year"}
    freshness = payload["freshness"]
    assert set(freshness) == {"known", "latest_observed_at"}


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_growth_snapshot_reports_partial_mandatory_completion() -> None:
    client, dev_store = _client()
    _login(client)
    dev_store.install_roadmap(
        RoadmapRecord(
            track_key="python",
            policy_version=7,
            milestones=(
                RoadmapMilestone(
                    key="foundation",
                    position=1,
                    title="Освоить основу",
                    purpose="Создать базу для первой практической задачи.",
                    skill="Python-разработчик",
                    target_kind="course",
                    target_key="python-base",
                ),
                RoadmapMilestone(
                    key="practice",
                    position=2,
                    title="Применить на практике",
                    purpose="Собрать проверяемый артефакт для портфолио.",
                    skill="Проектная работа",
                    target_kind="task",
                    target_key="missing-task-x",
                ),
            ),
        )
    )
    dev_store.enroll_as(demo_id("participant-alex"))
    dev_store.install_enrollments(
        (EnrollmentRecord(course_key="python-base", status=CompletionStatus.REPORTED),)
    )
    response = client.get("/api/v1/me/growth/snapshot")
    assert response.status_code == 200
    trajectory = response.json()["trajectories"][0]
    assert trajectory["track_key"] == "python"
    assert trajectory["policy_version"] == 7
    refs = trajectory["object_refs"]
    assert "course:python-base" in refs
    assert trajectory["next_step_ref"] is None or trajectory["next_step_ref"] in refs
    completion = trajectory["completion"]
    assert completion["partial"] is True
    assert completion["percent"] is None
    assert completion["coverage"] < 1


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_growth_snapshot_aggregates_verified_course_completion() -> None:
    client, dev_store = _client()
    _login(client)
    dev_store.install_roadmap(
        RoadmapRecord(
            track_key="python",
            policy_version=9,
            milestones=(
                RoadmapMilestone(
                    key="foundation",
                    position=1,
                    title="Освоить основу",
                    purpose="Создать базу для первой практической задачи.",
                    skill="Python-разработчик",
                    target_kind="course",
                    target_key="python-base",
                ),
            ),
        )
    )
    dev_store.enroll_as(demo_id("participant-alex"))
    dev_store.install_enrollments(
        (EnrollmentRecord(course_key="python-base", status=CompletionStatus.VERIFIED),)
    )
    response = client.get("/api/v1/me/growth/snapshot")
    assert response.status_code == 200
    trajectory = response.json()["trajectories"][0]
    assert trajectory["completion"]["partial"] is False
    assert trajectory["completion"]["coverage"] == 1
    assert trajectory["completion"]["percent"] == 100.0
    assert trajectory["readiness"]["percent"] is not None
    assert trajectory["object_refs"] == ["course:python-base"]
    skills = trajectory["readiness_skills"]
    assert all(item["target_level"] == "уверенный" for item in skills)
    milestones = trajectory["milestones"]
    assert all(item["known"] for item in milestones)


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_growth_snapshot_activity_buckets_and_hours_shape() -> None:
    client, _store = _client()
    _login(client)
    payload = client.get("/api/v1/me/growth/snapshot").json()
    for bucket in payload["activity"].values():
        assert set(bucket) == {
            "total",
            "course_checkpoint",
            "project_submission",
            "revision_accepted",
            "event_participation",
        }
    assert "day" in payload["activity"]
    hours = payload["hours"]
    assert hours["self_reported_minutes"] is None
    assert hours["known"] is False
    assert hours["trusted_minutes"] is None
    assert hours["intervals"] == []


@pytest.mark.spec("participant-experience/hours-must-be-attested")
def test_assignment_to_acceptance_is_not_a_trusted_work_session() -> None:
    """Workflow lead time cannot be reported as hours spent working."""
    start = datetime(2026, 10, 1, 9, tzinfo=UTC)
    accepted_at = start + timedelta(days=5)
    item = cast(
        WorkItem,
        SimpleNamespace(
            assignment=SimpleNamespace(created_at=start, id="task-1"),
            decisions=(
                SimpleNamespace(decision=ContributionStatus.ACCEPTED, decided_at=accepted_at),
            ),
        ),
    )
    assert GrowthService.trusted_intervals((item,)) == ()


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_merge_intervals_deduplicates_overlaps_and_touching() -> None:
    start = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    base = timedelta(hours=1)
    merged = merge_intervals(
        (
            (start, start + base),
            (start + timedelta(minutes=30), start + base * 2),
            (start - base, start),
        )
    )
    assert merged == ((start - base, start + base * 2),)


@pytest.mark.spec("participant-experience/versioned-growth-snapshot")
def test_merged_minutes_counts_merged_union_once() -> None:
    start = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    intervals = (
        (start, start + timedelta(hours=2)),
        (start + timedelta(hours=1), start + timedelta(hours=4)),
        (start + timedelta(hours=5), start + timedelta(hours=6)),
    )
    assert merged_minutes(intervals) == 300
