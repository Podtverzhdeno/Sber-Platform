"""SQL select contract for fields consumed by the canonical task projection."""

from impulse.infrastructure.work_store import SqlWorkStore


def test_task_select_includes_created_at_used_by_record_mapping_and_sorting() -> None:
    selected = SqlWorkStore._select().selected_columns  # pyright: ignore[reportPrivateUsage]

    assert "created_at" in selected.keys()
