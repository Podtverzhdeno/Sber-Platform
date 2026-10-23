"""TC-009 visibility admission: typed gate facts before counts, safe typed not-found."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from impulse.application.task_catalog import CatalogContractError

VISIBLE_GATES = (
    "not_published",
    "foreign_tenant_or_program",
    "insufficient_invitation",
    "deadline_passed",
    "quota_exhausted",
)


class TaskVisibilityError(CatalogContractError):
    """Typed safe-not-found signal; the message never identifies the hidden task."""


class VisibilityFactError(CatalogContractError):
    """Raised when caller-supplied admission facts violate the snapshot contract."""


def deadline_open(deadline_at: datetime | None, now: datetime) -> bool:
    """A task without deadline stays open; a past deadline is closed."""
    if deadline_at is None:
        return True
    return deadline_at > now


def _clean_gate_reasons(reasons: Sequence[str]) -> tuple[str, ...]:
    unknown = tuple(reason for reason in reasons if reason not in VISIBLE_GATES)
    if unknown:
        raise VisibilityFactError(
            "Visibility snapshot carries an unknown gate reason: " + ", ".join(unknown) + "."
        )
    return tuple(dict.fromkeys(reasons))


class TaskVisibilitySnapshot:
    """Caller-computed admission facts for one task (matching lane TC-010 fills them)."""

    __slots__ = ("failed_gates",)

    def __init__(self, failed_gates: Sequence[str] = ()) -> None:
        self.failed_gates = _clean_gate_reasons(failed_gates)

    def is_visible(self) -> bool:
        return not self.failed_gates


def snapshot(
    *,
    published: bool = True,
    tenant_or_program: bool = True,
    invited: bool = True,
    deadline_open_value: bool = True,
    quota_open: bool = True,
) -> TaskVisibilitySnapshot:
    """Build admission facts from booleans; each closed side becomes a stable gate code."""
    reasons: list[str] = []
    if not published:
        reasons.append("not_published")
    if not tenant_or_program:
        reasons.append("foreign_tenant_or_program")
    if not invited:
        reasons.append("insufficient_invitation")
    if not deadline_open_value:
        reasons.append("deadline_passed")
    if not quota_open:
        reasons.append("quota_exhausted")
    return TaskVisibilitySnapshot(_clean_gate_reasons(tuple(reasons)))


def open_snapshot(projection_deadline: datetime | None, now: datetime) -> TaskVisibilitySnapshot:
    """Default admission from projection facts alone: only the deadline gate applies."""
    return snapshot(deadline_open_value=deadline_open(projection_deadline, now))


def deadline_cutoff(now: datetime) -> datetime:
    """Normalize any caller clock to an aware UTC instant for comparisons."""
    if now.tzinfo is None:
        raise VisibilityFactError("Visibility clock must be timezone-aware.")
    return now.astimezone(UTC)


def require_task_id(value: UUID | None) -> UUID:
    if value is None:
        raise VisibilityFactError("Visibility snapshot requires a task id.")
    return value


__all__ = [
    "VISIBLE_GATES",
    "TaskVisibilityError",
    "TaskVisibilitySnapshot",
    "VisibilityFactError",
    "deadline_cutoff",
    "deadline_open",
    "open_snapshot",
    "require_task_id",
    "snapshot",
]
