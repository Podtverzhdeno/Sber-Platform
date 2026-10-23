"""SQL select contract for fields consumed by the canonical task projection."""

import inspect

from impulse.infrastructure.work_store import SqlWorkStore


def test_task_select_includes_created_at_used_by_record_mapping_and_sorting() -> None:
    selected = SqlWorkStore._select().selected_columns  # pyright: ignore[reportPrivateUsage]

    assert "created_at" in selected.keys()


def test_apply_locks_the_application_row_before_idempotent_transition() -> None:
    source = inspect.getsource(SqlWorkStore.apply)

    assert ".with_for_update()" in source
