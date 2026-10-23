"""Synthetic demo tasks must remain discoverable after their historical fixtures age."""

from datetime import UTC, datetime, timedelta, timezone

import pytest

from impulse.bootstrap import demo_seed


class _FixedClock:
    @staticmethod
    def now(tz: timezone) -> datetime:
        assert tz is UTC
        return datetime(2030, 1, 10, 12, 0, tzinfo=UTC)


def test_catalog_terms_use_seed_time_instead_of_expired_historical_now(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(demo_seed, "datetime", _FixedClock)

    batches = demo_seed.build_work_and_rating_batches()
    terms = next(batch for batch in batches if batch.table.name == "task_terms_versions")

    assert len(terms.rows) == 12
    assert [row["deadline_at"] for row in terms.rows] == [
        datetime(2030, 1, 10, 12, 0, tzinfo=UTC) + timedelta(days=14 + index)
        for index in range(1, 13)
    ]
