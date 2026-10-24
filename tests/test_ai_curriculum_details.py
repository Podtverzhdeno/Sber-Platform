"""Checks for the seven practical AI learning programmes.

Curriculum content is a proposed learning plan and not verified user evidence.
"""

from __future__ import annotations

from impulse.bootstrap.ai_curriculum_details import AI_CURRICULUM_DETAILS, learning_details
from impulse.bootstrap.ai_role_catalog import AI_ROLE_PROFILES
from impulse.bootstrap.demo_seed import build_seed_batches


def test_all_49_stages_have_distinct_actionable_learning_materials() -> None:
    assert set(AI_CURRICULUM_DETAILS) == set(AI_ROLE_PROFILES)
    all_labs: set[str] = set()
    for role_key, details in AI_CURRICULUM_DETAILS.items():
        assert len(details) == len(AI_ROLE_PROFILES[role_key]["stages"]) == 7
        for position, module in enumerate(details, start=1):
            assert learning_details(role_key, position) == module
            assert len(module["theory"]) == 2
            assert len(set(module["theory"])) == 2
            assert all(len(item) >= 18 for item in module["theory"])
            assert len(module["lab"]) >= 65
            assert module["lab"] not in all_labs
            all_labs.add(module["lab"])
            assert len(module["acceptance"]) == 3
            assert len(set(module["acceptance"])) == 3
            assert all(len(item) >= 25 for item in module["acceptance"])
            assert isinstance(module["estimated_hours"], int)
            assert 4 <= module["estimated_hours"] <= 16
    assert len(all_labs) == 49


def test_learning_details_are_persisted_with_existing_milestone_ids() -> None:
    batches = build_seed_batches()
    milestones = next(batch.rows for batch in batches if batch.table.name == "milestones")
    assert len(milestones) == 49
    for row in milestones:
        payload = row["payload"]
        assert len(payload["theory"]) == 2
        assert len(payload["activities"]) == 3
        assert len(payload["acceptance"]) == 3
        assert payload["lab"]
        assert payload["deliverable"]
        assert payload["estimated_hours"] >= 4
        assert "completed" not in payload
        assert "verified" not in payload
