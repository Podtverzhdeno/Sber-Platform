from __future__ import annotations

from typing import Any

from impulse.bootstrap.demo_seed import build_seed_batches


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
    assert len(rows["talent_pipeline_events"]) >= 4


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
