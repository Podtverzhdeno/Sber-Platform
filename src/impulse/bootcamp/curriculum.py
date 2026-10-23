"""Version-exact projection of outstanding Bootcamp curriculum requirements."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from impulse.bootcamp.overview import (
    CurriculumRemainder,
    CurriculumRequirement,
    KnowledgeState,
    RequirementKind,
    RequirementState,
    VersionedFact,
)


@dataclass(frozen=True, slots=True)
class PublishedRequirement:
    key: str
    title: str
    kind: RequirementKind
    source_key: str
    source_version: str

    def __post_init__(self) -> None:
        if any(
            not value.strip()
            for value in (self.key, self.title, self.source_key, self.source_version)
        ):
            raise ValueError("Published requirement fields must be non-empty")


@dataclass(frozen=True, slots=True)
class PublishedCurriculum:
    current_grade_key: str
    target_grade_key: str
    policy_version: str
    curriculum_version: str
    requirements: tuple[PublishedRequirement, ...]
    provenance: VersionedFact

    def __post_init__(self) -> None:
        values = (
            self.current_grade_key,
            self.target_grade_key,
            self.policy_version,
            self.curriculum_version,
        )
        if any(not value.strip() for value in values):
            raise ValueError("Published curriculum requires grade and version identity")
        keys = [item.key for item in self.requirements]
        if len(keys) != len(set(keys)):
            raise ValueError("Published requirement keys must be unique")


@dataclass(frozen=True, slots=True)
class RequirementEvidence:
    requirement_key: str
    source_key: str
    source_version: str
    state: RequirementState

    def __post_init__(self) -> None:
        if any(
            not value.strip()
            for value in (self.requirement_key, self.source_key, self.source_version)
        ):
            raise ValueError("Requirement evidence identity and version are required")


def build_curriculum_remainder(
    curriculum: PublishedCurriculum | None,
    *,
    evidence: tuple[RequirementEvidence, ...],
    allowed_actions: Mapping[str, str] | None = None,
    unavailable_reason: str = "Для роли нет активной опубликованной grade policy.",
) -> CurriculumRemainder:
    """Join evidence to the exact requirement source version.

    Evidence from another course/policy version is deliberately UNKNOWN rather
    than credited. Revoked and rejected states stay visible and outstanding.
    """

    if curriculum is None:
        return CurriculumRemainder(
            state=KnowledgeState.NOT_EVALUABLE,
            current_grade_key=None,
            target_grade_key=None,
            policy_version=None,
            curriculum_version=None,
            requirements=(),
            provenance=None,
            unavailable_reason=unavailable_reason,
        )
    actions = dict(allowed_actions or {})
    by_requirement: dict[str, RequirementEvidence] = {}
    for item in evidence:
        if item.requirement_key in by_requirement:
            raise ValueError("Evidence must contain at most one current state per requirement")
        by_requirement[item.requirement_key] = item
    projected: list[CurriculumRequirement] = []
    for requirement in curriculum.requirements:
        observed = by_requirement.get(requirement.key)
        if observed is None:
            state = RequirementState.OPEN
        elif (
            observed.source_key != requirement.source_key
            or observed.source_version != requirement.source_version
        ):
            state = RequirementState.UNKNOWN
        else:
            state = observed.state
        projected.append(
            CurriculumRequirement(
                key=requirement.key,
                title=requirement.title,
                kind=requirement.kind,
                state=state,
                source_key=requirement.source_key,
                source_version=requirement.source_version,
                allowed_action=(None if state is RequirementState.VERIFIED else actions.get(state)),
            )
        )
    return CurriculumRemainder(
        state=KnowledgeState.KNOWN,
        current_grade_key=curriculum.current_grade_key,
        target_grade_key=curriculum.target_grade_key,
        policy_version=curriculum.policy_version,
        curriculum_version=curriculum.curriculum_version,
        requirements=tuple(projected),
        provenance=curriculum.provenance,
        unavailable_reason=None,
    )


__all__ = [
    "PublishedCurriculum",
    "PublishedRequirement",
    "RequirementEvidence",
    "build_curriculum_remainder",
]
