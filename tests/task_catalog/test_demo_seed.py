"""Synthetic demo tasks must remain discoverable after their historical fixtures age."""

from datetime import UTC, datetime, timedelta

import pytest

from impulse.bootstrap import demo_seed


def test_catalog_terms_use_seed_time_instead_of_expired_historical_now(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed = datetime(2030, 1, 10, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(demo_seed, "_catalog_seed_time", lambda: fixed)

    batches = demo_seed.build_work_and_rating_batches()
    terms = next(batch for batch in batches if batch.table.name == "task_terms_versions")

    assert len(terms.rows) == 12
    assert [row["deadline_at"] for row in terms.rows] == [
        fixed + timedelta(days=14 + index) for index in range(1, 13)
    ]
