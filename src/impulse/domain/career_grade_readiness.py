"""Version-exact grade readiness derived only from a published curriculum.

This is a pure projection, not an automatic grade award. Publication authority,
identity checks, audit log and grade-transition commands belong to the
dedicated career-grade service. A missing or unreviewed policy is never 0%.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from impulse.bootcamp.curriculum import (
    PublishedCurriculum,
    RequirementEvidence,
    build_curriculum_remainder,
)
from impulse.bootcamp.overview import DataOrigin, KnowledgeState, RequirementState


@dataclass(frozen=True, slots=True)
class GradeReadiness:
    state: KnowledgeState
    policy_version: str | None
    curriculum_version: str | None
    current_grade_key: str | None
    target_grade_key: str | None
    verified_requirements: int | None
    total_requirements: int | None
    readiness_percent: Decimal | None
    ready_for_transition: bool
    reason: str | None


def calculate_grade_readiness(
    curriculum: PublishedCurriculum | None,
    *,
    evidence: tuple[RequirementEvidence, ...] = (),
) -> GradeReadiness:
    """Compute a version-exact percentage, without performing grade promotion.

    An empty policy is not an automatic 100% pass. Evidence at the wrong
    source version, revoked, reported, stale or rejected cannot count.
    """
    if curriculum is None or curriculum.provenance.data_origin is not DataOrigin.PRODUCTION:
        return GradeReadiness(
            state=KnowledgeState.NOT_EVALUABLE,
            policy_version=None,
            curriculum_version=None,
            current_grade_key=None,
            target_grade_key=None,
            verified_requirements=None,
            total_requirements=None,
            readiness_percent=None,
            ready_for_transition=False,
            reason="Требуется опубликованная и утверждённая версия правил грейдов.",
        )
    if not curriculum.requirements:
        return GradeReadiness(
            state=KnowledgeState.NOT_EVALUABLE,
            policy_version=curriculum.policy_version,
            curriculum_version=curriculum.curriculum_version,
            current_grade_key=curriculum.current_grade_key,
            target_grade_key=curriculum.target_grade_key,
            verified_requirements=None,
            total_requirements=None,
            readiness_percent=None,
            ready_for_transition=False,
            reason="В опубликованной версии нет критериев перехода.",
        )
    remainder = build_curriculum_remainder(curriculum, evidence=evidence)
    count = len(remainder.requirements)
    verified = sum(
        item.state is RequirementState.VERIFIED for item in remainder.requirements
    )
    percent = Decimal(verified) * Decimal(100) / Decimal(count)
    return GradeReadiness(
        state=KnowledgeState.KNOWN,
        policy_version=curriculum.policy_version,
        curriculum_version=curriculum.curriculum_version,
        current_grade_key=curriculum.current_grade_key,
        target_grade_key=curriculum.target_grade_key,
        verified_requirements=verified,
        total_requirements=count,
        readiness_percent=percent,
        ready_for_transition=verified == count,
        reason=None,
    )


__all__ = ["GradeReadiness", "calculate_grade_readiness"]
