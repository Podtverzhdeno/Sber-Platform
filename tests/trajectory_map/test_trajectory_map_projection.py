"""Interactive trajectory map projection scenarios (openspec 24.1)."""

from __future__ import annotations

import asyncio
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
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    RoadmapProjection,
    TrackAttempt,
    TrackStatus,
)
from impulse.domain.passport import PassportSkillFacts, SkillGapProjection, skill_passport_gap
from impulse.trajectory_map.api import router as trajectory_map_router
from impulse.trajectory_map.projection import (
    BRANCH_RULE,
    CHECKPOINT_POINTS,
    MapCheckpointState,
    build_checkpoint_detail,
    build_skill_impact,
    build_trajectory_map,
    checkpoint_ref,
)


def _milestone(
    key: str,
    position: int,
    title: str,
    *,
    skill: str = "Python",
    target_kind: str = "course",
    target_key: str = "openspec-sdd",
    purpose: str = "Сделать шаг траектории.",
    mandatory: bool = True,
) -> RoadmapMilestone:
    return RoadmapMilestone(
        key,
        position,
        title,
        purpose,
        skill,
        target_kind,
        target_key,
        mandatory,
    )


def _projection(
    milestones: tuple[RoadmapMilestone, ...],
    *,
    completed: tuple[str, ...] = (),
    policy_version: int = 1,
) -> RoadmapProjection:
    return RoadmapProjection(
        track_key="python",
        policy_version=policy_version,
        milestones=milestones,
        completed_keys=frozenset(completed),
    )


def test_first_incomplete_mandatory_step_is_auto_positioned_current() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
        _milestone("deploy", 3, "Deploy"),
    )
    view = build_trajectory_map(_projection(milestones), enrollments={})
    states = {node.key: node.state for node in view.checkpoints}
    assert states == {
        "foundation": MapCheckpointState.CURRENT,
        "api": MapCheckpointState.LOCKED,
        "deploy": MapCheckpointState.LOCKED,
    }
    assert view.current_key == "foundation"
    assert view.progress.completed_mandatory == 0
    assert view.progress.total_mandatory == 3
    assert view.replacement_reason is None


def test_submitted_step_keeps_the_chain_open_and_points_the_next_focus() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа", target_key="openspec-sdd"),
        _milestone("api", 2, "API", target_key="agent-development"),
        _milestone("ops", 3, "Ops", target_key="python-base"),
    )
    view = build_trajectory_map(
        _projection(milestones), {"openspec-sdd": CompletionStatus.REPORTED}
    )
    states = {node.key: node.state for node in view.checkpoints}
    assert states == {
        "foundation": MapCheckpointState.SUBMITTED,
        "api": MapCheckpointState.CURRENT,
        "ops": MapCheckpointState.AVAILABLE,
    }
    # a submitted checkpoint earns nothing until verification
    assert view.checkpoints[0].points_earned == 0
    # auto-position falls to the first non-submitted focus of the open chain
    assert view.current_key == "api"


@pytest.mark.spec("career-roadmap/version-preserves-completion")
def test_completed_steps_stay_completed_for_verified_replay() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
    )
    view = build_trajectory_map(_projection(milestones, completed=("foundation",)), enrollments={})
    completed = view.checkpoints[0]
    assert completed.state is MapCheckpointState.COMPLETED
    assert completed.state_label == "Завершён"
    assert completed.points_earned == CHECKPOINT_POINTS
    assert completed.points_available == CHECKPOINT_POINTS
    assert completed.actionable is False
    assert view.current_key == "api"
    assert view.progress.percent == 50.0


def test_locked_node_explains_each_unmet_mandatory_prerequisite() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
        _milestone("deploy", 3, "Deploy", mandatory=False),
    )
    view = build_trajectory_map(_projection(milestones), enrollments={})
    locked = view.checkpoints[1]
    assert locked.state is MapCheckpointState.LOCKED
    assert locked.state_label == "Заблокирован"
    assert locked.actionable is False
    assert [reason.milestone_key for reason in locked.locked_reasons] == ["foundation"]
    assert locked.locked_reasons[0].ref == checkpoint_ref(milestones[0])
    # the trailing optional node is locked by the same chain gate
    assert view.checkpoints[2].state is MapCheckpointState.LOCKED


def test_consecutive_optional_steps_with_one_skill_form_a_branch() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("sql-a", 2, "SQL вариант A", skill="SQL", mandatory=False),
        _milestone("sql-b", 3, "SQL вариант B", skill="SQL", mandatory=False),
        _milestone("api", 4, "API"),
    )
    view = build_trajectory_map(_projection(milestones, completed=("foundation",)), enrollments={})
    branch_a = view.checkpoints[1]
    branch_b = view.checkpoints[2]
    assert branch_a.state is MapCheckpointState.BRANCH
    assert branch_b.state is MapCheckpointState.BRANCH
    assert branch_a.branch is not None
    assert branch_a.branch.group_key == "branch:sql-a"
    assert branch_a.branch.member_keys == ("sql-a", "sql-b")
    assert branch_a.branch.rule == BRANCH_RULE
    assert "2 вариантов" in branch_a.state_label
    assert branch_a.actionable is True


def test_confirmed_variant_of_branch_closes_the_other_by_rule() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("sql-a", 2, "SQL A", skill="SQL", mandatory=False),
        _milestone("sql-b", 3, "SQL B", skill="SQL", mandatory=False),
    )
    view = build_trajectory_map(_projection(milestones, completed=("foundation", "sql-a")), {})
    by_key = {node.key: node for node in view.checkpoints}
    assert by_key["sql-a"].state is MapCheckpointState.COMPLETED
    assert by_key["sql-b"].state is MapCheckpointState.SKIPPED_BY_RULE
    assert by_key["sql-b"].actionable is False


def test_single_optional_step_is_optional() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("english", 2, "Английский", skill="English", mandatory=False),
    )
    view = build_trajectory_map(_projection(milestones, completed=("foundation",)), enrollments={})
    assert view.checkpoints[1].state is MapCheckpointState.OPTIONAL
    assert view.checkpoints[1].state_label == "Необязательный"
    assert view.checkpoints[1].actionable is True


def test_reported_course_completion_shows_submitted_without_points() -> None:
    milestones = (_milestone("foundation", 1, "Основа", target_key="openspec-sdd"),)
    view = build_trajectory_map(
        _projection(milestones), {"openspec-sdd": CompletionStatus.REPORTED}
    )
    node = view.checkpoints[0]
    assert node.state is MapCheckpointState.SUBMITTED
    assert node.state_label == "На проверке"
    assert node.points_earned == 0


def test_verified_completion_never_submits_again() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа", target_key="openspec-sdd"),
        _milestone("api", 2, "API", target_key="agent-development"),
    )
    view = build_trajectory_map(
        _projection(milestones, completed=("foundation",)),
        {"openspec-sdd": CompletionStatus.VERIFIED},
    )
    assert view.checkpoints[0].state is MapCheckpointState.COMPLETED
    assert view.checkpoints[1].state is MapCheckpointState.CURRENT


def _gap(
    *,
    skill: str = "Python",
    level: str = "базовый",
    candidate_step: tuple[str, str, str] | None = None,
) -> SkillGapProjection:
    facts = (
        PassportSkillFacts(
            key="python",
            title=skill,
            evidence_sources=(("course", "openspec-sdd"),),
            counted=(("course", "openspec-sdd"),),
            excluded=(),
            level=level,
        ),
    )
    return skill_passport_gap(
        requested_skill=skill,
        target_level="уверенный",
        target_rank=1,
        candidates=facts,
        candidate_step=candidate_step,
    )


def test_skill_impact_forecast_only_until_evidence_is_verified() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
    )
    view = build_trajectory_map(_projection(milestones, completed=("foundation",)), {})
    node = view.checkpoints[1]  # current, gap closes the source
    impact = build_skill_impact(node, _gap(candidate_step=("course", "x-course", "X")))
    assert impact.current_level == "базовый"
    assert impact.projected_level == "уверенный"
    assert impact.forecast_only is True
    assert "после проверки evidence" in impact.explanation


def test_locked_checkpoint_never_projects_a_level() -> None:
    milestones = (
        _milestone("a", 1, "A"),
        _milestone("b", 2, "B"),
    )
    view = build_trajectory_map(_projection(milestones), enrollments={})
    node = view.checkpoints[1]  # locked, chain not confirmed
    impact = build_skill_impact(node, _gap(candidate_step=("course", "x", "X")))
    assert impact.forecast_only is False
    assert impact.projected_level is None
    assert "заблокирован" in impact.fallback  # type: ignore[operator]


def test_completed_checkpoint_replay_does_not_double_credit() -> None:
    milestones = (_milestone("foundation", 1, "Основа"),)
    view = build_trajectory_map(_projection(milestones, completed=("foundation",)), enrollments={})
    impact = build_skill_impact(view.checkpoints[0], _gap(level="уверенный"))
    assert impact.projected_level is None
    assert "повторное выполнение не начисляет баллы" in impact.explanation


def test_skill_without_framework_gets_honest_fallback() -> None:
    milestones = (_milestone("foundation", 1, "Основа", skill="Flying"),)
    view = build_trajectory_map(_projection(milestones), enrollments={})
    gap = skill_passport_gap(
        requested_skill="Flying",
        target_level="уверенный",
        target_rank=1,
        candidates=(),
        candidate_step=None,
    )
    impact = build_skill_impact(view.checkpoints[0], gap)
    assert impact.projected_level is None
    assert impact.fallback is not None


def test_checkpoint_detail_lists_goal_prerequisites_and_replay() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа", target_key="openspec-sdd"),
        _milestone("api", 2, "API", target_key="agent-development"),
    )
    view = build_trajectory_map(_projection(milestones), enrollments={})
    locked = view.checkpoints[1]
    detail = build_checkpoint_detail(view, locked, gap=None)
    assert detail.goal == locked.purpose
    assert [(fact.milestone_key, fact.met) for fact in detail.prerequisites] == [
        ("foundation", False)
    ]
    assert "портфолио" in detail.outcome
    assert detail.replay is False
    assert detail.skill_impact.explanation != ""

    replay_view = build_trajectory_map(
        _projection(milestones, completed=("foundation",)), enrollments={}
    )
    replay = build_checkpoint_detail(replay_view, replay_view.checkpoints[0], gap=None)
    assert replay.replay is True
    assert [fact.met for fact in replay.prerequisites] == []
    assert replay.node.points_earned == CHECKPOINT_POINTS


def test_building_the_map_is_pure_and_keeps_progress_unchanged() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
    )
    projection = _projection(milestones)
    first = build_trajectory_map(projection, enrollments={})
    second = build_trajectory_map(projection, enrollments={})
    assert first.checkpoints == second.checkpoints
    assert first.progress == second.progress
    detail = build_checkpoint_detail(first, first.checkpoints[1], gap=None)
    assert detail.node.state is MapCheckpointState.LOCKED
    assert first.checkpoints[1].locked_reasons == detail.node.locked_reasons
    assert build_trajectory_map(projection, enrollments={}).progress == first.progress


@pytest.mark.spec("career-roadmap/version-preserves-completion")
def test_current_state_survives_roadmap_version_bump() -> None:
    milestones = (
        _milestone("foundation", 1, "Основа"),
        _milestone("api", 2, "API"),
        _milestone("ops", 3, "Ops"),
    )
    revised = RoadmapProjection(
        track_key="python",
        policy_version=2,
        milestones=milestones,
        completed_keys=frozenset({"foundation"}),
        replacement_reason="Маршрут обновлён.",
    )
    view_old = build_trajectory_map(
        _projection(milestones[:2], completed=("foundation",)), enrollments={}
    )
    view_new = build_trajectory_map(revised, enrollments={})
    assert view_old.current_key == "api"
    assert view_new.current_key == "api"
    assert view_new.checkpoints[0].state is MapCheckpointState.COMPLETED
    assert view_new.replacement_reason is not None


# --- API composition over the real service layer ---------------------------


def _test_settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("trajectory-map-test-secret-with-length"),
        session_ttl_seconds=600,
    )


def _client() -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = _test_settings()
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=auth)
    # production wiring is `router.include_router(trajectory_map_router)` inside
    # the /api/v1 router; the test reproduces the same final prefix
    app.include_router(trajectory_map_router, prefix="/api/v1")
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    return TestClient(app), store


def _login(client: TestClient) -> str:
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200
    token = login.json()["csrf_token"]
    assert isinstance(token, str)
    return token


def test_map_requires_authentication() -> None:
    client, _store = _client()
    assert client.get("/api/v1/me/trajectory-map").status_code == 401


def test_map_api_for_non_participant_is_forbidden() -> None:
    client, _store = _client()
    with client:
        client.post("/api/v1/auth/demo-login", json={"persona_key": "mentor-elena"})
        assert client.get("/api/v1/me/trajectory-map").status_code == 403


def test_map_without_active_track_is_empty_list() -> None:
    client, store = _client()
    alex_id = demo_personas()[0].person_id
    # the memory store answers an implicit demo attempt unless it is cleared;
    # the fixture states the contract scenario explicitly: no active track
    asyncio.run(store.replace_attempts(alex_id, ()))
    with client:
        _login(client)
        empty = client.get("/api/v1/me/trajectory-map")
        assert empty.status_code == 200
        assert empty.json() == []


def test_map_states_through_the_real_service_layer() -> None:
    client, store = _client()
    alex_id = demo_personas()[0].person_id
    milestones = (
        _milestone("foundation", 1, "Основа", target_key="openspec-sdd"),
        _milestone("sql-a", 2, "SQL A", skill="SQL", mandatory=False),
        _milestone("sql-b", 3, "SQL B", skill="SQL", mandatory=False),
        _milestone("api", 4, "API", target_key="agent-development"),
    )
    store.install_roadmap(RoadmapRecord("python", 3, milestones))
    asyncio.run(
        store.replace_attempts(
            alex_id,
            (TrackAttempt("python", 1, TrackStatus.ACTIVE, frozenset()),),
        )
    )
    store.enroll_as(alex_id)
    store.install_enrollments((EnrollmentRecord("openspec-sdd", CompletionStatus.REPORTED),))
    with client:
        _login(client)
        mapped = client.get("/api/v1/me/trajectory-map")
        assert mapped.status_code == 200
        track = mapped.json()[0]
        assert track["track_key"] == "python"
        assert track["policy_version"] == 3
        assert {node["key"]: node["state"] for node in track["checkpoints"]} == {
            "foundation": "submitted",
            "sql-a": "branch",
            "sql-b": "branch",
            "api": "available",
        }
        assert all(node["points_earned"] == 0 for node in track["checkpoints"])
        branch = track["checkpoints"][1]["branch"]
        assert branch["group_key"] == "branch:sql-a"
        assert branch["member_keys"] == ["sql-a", "sql-b"]
        assert track["progress"]["percent"] == 0.0
        assert len(track["checkpoints"][2]["locked_reasons"]) == 1

        detail = client.get("/api/v1/me/trajectory-map/checkpoints/api")
        assert detail.status_code == 200
        body = detail.json()
        assert body["goal"] == "Сделать шаг траектории."
        assert body["checkpoint"]["state"] == "available"
        assert body["checkpoint"]["locked_reasons"] == []
        assert body["prerequisites"] == [
            {"milestone_key": "foundation", "title": "Основа", "met": False},
        ]
        assert body["skill_impact"]["skill"] == "Python"
        assert body["skill_impact"]["fallback"] is not None, (
            "Python has no demo competency framework: honest no-forecast fallback"
        )

        unknown = client.get("/api/v1/me/trajectory-map/checkpoints/not-a-step")
        assert unknown.status_code == 404
        assert unknown.json()["code"] == "RESOURCE_NOT_FOUND"


def test_locked_checkpoints_keep_optional_chain_locked() -> None:
    client, store = _client()
    store.install_roadmap(
        RoadmapRecord(
            "python",
            2,
            (
                _milestone("foundation", 1, "Основа", target_key="python-base"),
                _milestone("sql-a", 2, "SQL A", skill="SQL", mandatory=False),
                _milestone("api", 3, "API"),
            ),
        )
    )
    with client:
        _login(client)
        track = client.get("/api/v1/me/trajectory-map").json()[0]
        assert track["policy_version"] == 2
        assert track["current_key"] == "foundation"
        states = {node["key"]: node["state"] for node in track["checkpoints"]}
        assert states == {
            "foundation": "current",
            "sql-a": "locked",
            "api": "locked",
        }
        locked = client.get("/api/v1/me/trajectory-map/checkpoints/sql-a")
        assert locked.status_code == 200
        assert locked.json()["checkpoint"]["state"] == "locked"
        assert locked.json()["checkpoint"]["locked_reasons"][0]["ref"] == "checkpoint:foundation"


def test_reported_completion_becomes_submitted_via_real_write() -> None:
    client, store = _client()
    store.install_roadmap(
        RoadmapRecord(
            "python",
            1,
            (
                _milestone("foundation", 1, "Основа", target_key="openspec-sdd"),
                _milestone("api", 2, "API", target_key="agent-development"),
            ),
        )
    )
    with client:
        csrf = _login(client)
        reported = client.post(
            "/api/v1/me/courses/openspec-sdd/completion",
            headers={"X-CSRF-Token": csrf},
        )
        assert reported.status_code == 200
        track = client.get("/api/v1/me/trajectory-map").json()[0]
        assert track["checkpoints"][0]["state"] == "submitted"
        assert track["checkpoints"][0]["points_earned"] == 0
        assert track["checkpoints"][1]["state"] == "current"

        assert (
            client.post(
                "/api/v1/me/courses/unknown-course/completion",
                headers={"X-CSRF-Token": csrf},
            ).status_code
            == 404
        )

        # reading the map twice over a real service must not move progress
        assert (
            client.get("/api/v1/me/trajectory-map").content
            == client.get("/api/v1/me/trajectory-map").content
        )
