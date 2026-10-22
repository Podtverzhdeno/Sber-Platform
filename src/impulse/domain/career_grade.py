"""Versioned career-grade capability (openspec participant-home-trajectory-grades 2.1).

The career grade is an independent server-authoritative projection and is
never derived from competency_level, stage progress, rating XP or review
grades (A/B/C). While the owner has not approved the grade catalog policy
(gate 0.3), the projection reports the honest ``not_evaluable`` state instead
of a fabricated grade; readiness thresholds and automatic transitions arrive
with the published catalog, not before.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

CAREER_GRADE_POLICY_VERSION = 1
GRADE_CATALOG_POLICY_PENDING = "grade_catalog_policy_not_published"
GRADE_NOT_EVALUABLE_HINT = (
    "Карьерный грейд станет доступен здесь после публикации каталога грейдов;"
    " этапы, готовность и рейтинг считаются по собственным контрактам."
)


class CareerGradeState(StrEnum):
    """Legitimate projection states; reached/current/target require a published catalog."""

    NOT_EVALUABLE = "not_evaluable"
    REACHED = "reached"
    CURRENT = "current"
    TARGET = "target"
    FUTURE = "future"


@dataclass(frozen=True, slots=True)
class CareerGradeSummary:
    """Server snapshot; every value is either authoritative or explicitly absent."""

    policy_version: int
    state: str
    reason: str | None
    hint: str | None
    catalog_version: int | None
    current_grade: str | None
    target_grade: str | None
    readiness_percent: float | None
    auto_transition: bool


def grade_summary() -> CareerGradeSummary:
    """Not-evaluable placeholder while gate 0.3 keeps the catalog policy open."""
    return CareerGradeSummary(
        policy_version=CAREER_GRADE_POLICY_VERSION,
        state=CareerGradeState.NOT_EVALUABLE.value,
        reason=GRADE_CATALOG_POLICY_PENDING,
        hint=GRADE_NOT_EVALUABLE_HINT,
        catalog_version=None,
        current_grade=None,
        target_grade=None,
        readiness_percent=None,
        auto_transition=False,
    )


__all__ = [
    "CAREER_GRADE_POLICY_VERSION",
    "GRADE_CATALOG_POLICY_PENDING",
    "CareerGradeState",
    "CareerGradeSummary",
    "grade_summary",
]
