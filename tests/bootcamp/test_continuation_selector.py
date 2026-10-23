"""Priority and boundary tests for Bootcamp continuation selection."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from impulse.bootcamp.continuation import ContinuationCandidate, select_continue_learning
from impulse.bootcamp.overview import DataOrigin, VersionedFact

NOW = datetime(2026, 10, 23, 2, 0, tzinfo=UTC)


def _candidate(
    key: str,
    *,
    checkpoint: str | None = None,
    active: bool = False,
    deadline_days: int | None = None,
    activity_days_ago: int | None = None,
    action: str | None = "start_course",
) -> ContinuationCandidate:
    return ContinuationCandidate(
        course_key=key,
        checkpoint_key=checkpoint,
        allowed_action=action,
        active_checkpoint=active,
        deadline=(NOW + timedelta(days=deadline_days) if deadline_days is not None else None),
        last_meaningful_activity_at=(
            NOW - timedelta(days=activity_days_ago) if activity_days_ago is not None else None
        ),
        progress=None,
        provenance=VersionedFact(
            source="continue_learning_selector",
            version="selector-v1",
            as_of=NOW,
            data_origin=DataOrigin.PRODUCTION,
        ),
    )


def test_active_checkpoint_outranks_nearer_non_checkpoint_deadline() -> None:
    selected = select_continue_learning(
        (
            _candidate("course-near", deadline_days=1),
            _candidate(
                "course-checkpoint",
                checkpoint="cp-2",
                active=True,
                deadline_days=10,
                action="continue_checkpoint",
            ),
        )
    )

    assert selected is not None
    assert selected.course_key == "course-checkpoint"
    assert selected.checkpoint_key == "cp-2"
    assert selected.reason_code == "active_checkpoint"


def test_nearest_deadline_wins_within_same_priority() -> None:
    selected = select_continue_learning(
        (
            _candidate("later", deadline_days=5),
            _candidate("nearest", deadline_days=2),
            _candidate("no-deadline"),
        )
    )

    assert selected is not None
    assert selected.course_key == "nearest"


def test_most_recent_meaningful_activity_breaks_equal_deadline() -> None:
    selected = select_continue_learning(
        (
            _candidate("older", deadline_days=3, activity_days_ago=7),
            _candidate("newer", deadline_days=3, activity_days_ago=1),
            _candidate("unknown", deadline_days=3),
        )
    )

    assert selected is not None
    assert selected.course_key == "newer"


def test_stable_course_key_breaks_full_tie() -> None:
    selected = select_continue_learning((_candidate("z-course"), _candidate("a-course")))

    assert selected is not None
    assert selected.course_key == "a-course"


def test_empty_or_non_actionable_candidates_return_none() -> None:
    assert select_continue_learning(()) is None
    assert select_continue_learning((_candidate("locked", action=None),)) is None
    assert select_continue_learning((_candidate("blank", action="  "),)) is None


def test_selection_preserves_provenance_and_does_not_invent_progress() -> None:
    selected = select_continue_learning((_candidate("course"),))

    assert selected is not None
    assert selected.progress is None
    assert selected.selection_provenance.version == "selector-v1"
    assert selected.action == "start_course"


def test_active_checkpoint_requires_key_and_timestamps_require_timezone() -> None:
    with pytest.raises(ValueError, match="checkpoint key"):
        _candidate("broken", active=True)
    with pytest.raises(ValueError, match="checkpoint key"):
        _candidate("blank-checkpoint", checkpoint="   ", active=True)

    candidate = _candidate("valid")
    with pytest.raises(ValueError, match="timezone-aware"):
        ContinuationCandidate(
            course_key=candidate.course_key,
            checkpoint_key=None,
            allowed_action="start_course",
            active_checkpoint=False,
            deadline=datetime(2026, 10, 24),
            last_meaningful_activity_at=None,
            progress=None,
            provenance=candidate.provenance,
        )
