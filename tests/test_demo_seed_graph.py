from __future__ import annotations

from typing import Any

from impulse.bootstrap.demo_seed import build_seed_batches, demo_id
from impulse.domain.work import TaskStatus


def _rows() -> dict[str, list[dict[str, Any]]]:
    return {batch.table.name: batch.rows for batch in build_seed_batches()}


def test_demo_seed_contains_connected_role_workflows() -> None:
    rows = _rows()

    assert len(rows["persons"]) >= 15
    assert len(rows["tasks"]) >= 12
    assert len(rows["applications"]) >= 15
    assert len(rows["assignments"]) >= 10
    assert len(rows["contributions"]) >= 8
    assert len(rows["review_5plus_versions"]) >= 8
    assert len(rows["operations_cases"]) >= 5
    assert len(rows["talent_pipeline_events"]) >= 7


def test_demo_seed_pilot_has_directions_units_and_optional_startup() -> None:
    rows = _rows()

    season = next(row for row in rows["seasons"] if row["season_key"] == "demo-autumn-2026")
    pilot = season["payload"]["pilot"]
    assert pilot["weeks"] == 12
    assert len(pilot["directions"]) == 2
    assert len(pilot["business_units"]) == 3
    assert pilot["startup_track_optional"] is True
    assert pilot["symbolic_bonus"]["guaranteed"] is False
    track_slugs = {row["slug"] for row in rows["tracks"]}
    assert "startup" not in track_slugs


def test_demo_seed_talent_pipeline_keeps_human_stage_order() -> None:
    rows = _rows()

    stages: dict[str, set[str]] = {}
    for event in rows["talent_pipeline_events"]:
        assert event["data_origin"] == "human"
        stages.setdefault(str(event["candidate_id"]), set()).add(event["stage"])
    by_person = {
        key: stages.get(str(demo_id(key)), set())
        for key in ("participant-alex", "participant-maria", "participant-igor")
    }
    assert by_person["participant-alex"] == {"invitation", "interview", "offer"}
    assert by_person["participant-maria"] == {"invitation", "interview"}
    assert by_person["participant-igor"] == {"invitation"}


def test_every_seed_assignment_connects_task_application_and_participant() -> None:
    rows = _rows()
    task_ids = {row["id"] for row in rows["tasks"]}
    application_ids = {row["id"] for row in rows["applications"]}
    participant_ids = {
        row["person_id"] for row in rows["actor_roles"] if row["role"] == "participant"
    }

    for assignment in rows["assignments"]:
        assert assignment["task_id"] in task_ids
        assert assignment["application_id"] in application_ids
        assert assignment["person_id"] in participant_ids


def test_every_review_is_visible_through_a_contribution() -> None:
    rows = _rows()
    contribution_ids = {row["id"] for row in rows["contributions"]}
    mentor_ids = {row["person_id"] for row in rows["actor_roles"] if row["role"] == "mentor"}

    assert mentor_ids
    for review in rows["review_5plus_versions"]:
        assert review["contribution_id"] in contribution_ids
        assert review["created_by"] in mentor_ids


def test_seed_tasks_and_compensation_follow_current_domain_values() -> None:
    rows = _rows()

    assert all(row["status"] in {status.value for status in TaskStatus} for row in rows["tasks"])
    for compensation in rows["compensation_terms"]:
        if compensation["paid"]:
            assert compensation["base_amount"] is not None
            assert compensation["currency"] == "RUB"
        else:
            assert compensation["base_amount"] is None
            assert compensation["currency"] is None
