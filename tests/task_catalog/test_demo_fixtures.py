"""Synthetic catalog fixture coverage; no real participant data or official grades."""

from __future__ import annotations

from typing import Any

from impulse.bootstrap.demo_seed import build_seed_batches


def task_rows() -> list[dict[str, Any]]:
    return next(batch.rows for batch in build_seed_batches() if batch.table.name == "tasks")


def test_demo_catalog_has_3_5_7_stage_plans_without_operational_final_progress() -> None:
    plans = [row["payload"]["catalog"]["stage_plan"] for row in task_rows()]
    assert {len(plan) for plan in plans} == {3, 5, 7}
    for plan in plans:
        assert len({stage["key"] for stage in plan}) == len(plan)
        assert all(stage["title"] != "Итог" for stage in plan)
        assert all("completed" not in stage for stage in plan)


def test_demo_catalog_benefits_are_explicit_conditions_not_granted_rewards() -> None:
    descriptions = [
        description
        for row in task_rows()
        for description in row["payload"]["catalog"]["benefit_descriptions"]
    ]
    assert any("компетенц" in item for item in descriptions)
    assert any("портфолио" in item for item in descriptions)
    assert any("Командный опыт" in item for item in descriptions)
    assert any("Обратная связь" in item for item in descriptions)
    assert all("только" in item or "после" in item for item in descriptions)
