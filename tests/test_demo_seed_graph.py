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


def test_demo_alex_has_seven_real_role_catalogs_and_distinct_progress() -> None:
    """Seven stage plans must be stored in PostgreSQL, never JSX stand-ins."""
    rows = _rows()
    tracks = {row["slug"]: row for row in rows["tracks"]}
    assert len(tracks) == 7
    assert {item["title"] for item in tracks.values()} == {
        "AI Architect",
        "AI Engineer",
        "AI Security Engineer",
        "AI Data Engineer",
        "MLOps Engineer",
        "AI Agent Engineer",
        "AI Product Engineer",
    }
    roadmap_by_slug = {
        slug: next(row for row in rows["roadmap_versions"] if row["track_id"] == track["id"])
        for slug, track in tracks.items()
    }
    for slug, roadmap in roadmap_by_slug.items():
        stages = [row for row in rows["milestones"] if row["roadmap_version_id"] == roadmap["id"]]
        assert [row["position"] for row in stages] == list(range(1, 8)), slug
        assert stages[0]["id"] == demo_id(f"milestone:{slug}:start")
        assert all(item["payload"]["target_key"] for item in stages)
        assert all(len(item["payload"]["activities"]) == 3 for item in stages)
        assert all(item["payload"]["deliverable"] for item in stages)
        assert all(item["payload"]["title"] for item in stages)

    alex = [
        row for row in rows["track_attempts"] if row["person_id"] == demo_id("participant-alex")
    ]
    assert {row["status"] for row in alex} == {"active", "frozen"}
    assert len([row for row in alex if row["status"] == "active"]) == 2
    completed_by_track = {
        next(slug for slug, track in tracks.items() if track["id"] == row["track_id"]): len(
            row["payload"]["completed_milestones"]
        )
        for row in alex
    }
    assert completed_by_track == {"product": 2, "ml": 3, "python": 2}


def test_demo_alex_learning_and_competencies_use_stable_evidence() -> None:
    rows = _rows()
    person_id = demo_id("participant-alex")
    enrollments = [
        row
        for row in rows["enrollments"]
        if row["person_id"] == person_id and row["status"] == "verified"
    ]
    assert len(enrollments) >= 6
    assert len(rows["learning_days"]) >= 10
    assert all(row["data_origin"] == "demo_seed" for row in rows["learning_days"])

    definitions = {row["competency_key"]: row for row in rows["competency_definitions"]}
    evidence = rows["competency_evidence"]
    assert len(evidence) == 5
    for item in evidence:
        assert item["person_id"] == person_id
        assert item["source_kind"] == "course"
        assert item["provenance"]["synthetic"] is True
        sources = definitions[item["competency_key"]]["payload"]["evidence_sources"]
        assert ["course", item["source_ref"]] in sources


def test_demo_rating_public_opt_in_is_explicit_and_only_for_fictional_participants() -> None:
    rows = _rows()
    participants = {row["person_id"] for row in rows["actor_roles"] if row["role"] == "participant"}
    published = [row for row in rows["visibility_settings"] if row["scope"] == "public_rating"]
    consented = [row for row in rows["consents"] if row["scope"] == "public_rating"]

    assert len(participants) == len(published) == len(consented) == 10
    assert {row["person_id"] for row in published} == participants
    assert {row["person_id"] for row in consented} == participants
    assert all(row["visible"] is True for row in published)
    assert all(row["granted"] is True for row in consented)
    assert all(row["data_origin"] == "demo_seed" for row in published + consented)
    assert all(row["provenance"]["synthetic"] is True for row in published + consented)
    assert not any(row["scope"] == "public_profile" for row in rows["visibility_settings"])
