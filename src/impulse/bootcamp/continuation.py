"""Deterministic selection of the participant's next Bootcamp action."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from impulse.bootcamp.overview import ContinueLearning, ProgressMetric, VersionedFact


@dataclass(frozen=True, slots=True)
class ContinuationCandidate:
    course_key: str
    checkpoint_key: str | None
    allowed_action: str | None
    active_checkpoint: bool
    deadline: datetime | None
    last_meaningful_activity_at: datetime | None
    progress: ProgressMetric | None
    provenance: VersionedFact

    def __post_init__(self) -> None:
        if not self.course_key.strip():
            raise ValueError("Continuation candidate requires a course key")
        if self.active_checkpoint and (
            self.checkpoint_key is None or not self.checkpoint_key.strip()
        ):
            raise ValueError("Active checkpoint candidate requires a checkpoint key")
        for value in (self.deadline, self.last_meaningful_activity_at):
            if value is not None and (value.tzinfo is None or value.utcoffset() is None):
                raise ValueError("Candidate timestamps must be timezone-aware")


def _deadline_rank(value: datetime | None) -> tuple[int, datetime]:
    return (1, datetime.max.replace(tzinfo=UTC)) if value is None else (0, value)


def _activity_rank(value: datetime | None) -> tuple[int, float]:
    return (1, 0.0) if value is None else (0, -value.timestamp())


def select_continue_learning(
    candidates: tuple[ContinuationCandidate, ...],
) -> ContinueLearning | None:
    """Return one safe next action without inventing progress or enrollment.

    Only server-allowed actions participate. Active checkpoints outrank other
    candidates; ties use nearest deadline, most recent meaningful activity and
    finally the stable course key.
    """

    actionable = tuple(
        item
        for item in candidates
        if item.allowed_action is not None and item.allowed_action.strip()
    )
    if not actionable:
        return None
    selected = min(
        actionable,
        key=lambda item: (
            0 if item.active_checkpoint else 1,
            _deadline_rank(item.deadline),
            _activity_rank(item.last_meaningful_activity_at),
            item.course_key,
            item.checkpoint_key or "",
        ),
    )
    return ContinueLearning(
        course_key=selected.course_key,
        checkpoint_key=selected.checkpoint_key,
        action=selected.allowed_action or "",
        reason_code=("active_checkpoint" if selected.active_checkpoint else "next_action"),
        progress=selected.progress,
        deadline=selected.deadline,
        last_meaningful_activity_at=selected.last_meaningful_activity_at,
        selection_provenance=selected.provenance,
    )


__all__ = ["ContinuationCandidate", "select_continue_learning"]
