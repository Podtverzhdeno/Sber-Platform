"""Versioned course and non-course curriculum remainder tests."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from impulse.bootcamp.curriculum import (
    PublishedCurriculum,
    PublishedRequirement,
    RequirementEvidence,
    build_curriculum_remainder,
)
from impulse.bootcamp.overview import (
    DataOrigin,
    KnowledgeState,
    RequirementKind,
    RequirementState,
    VersionedFact,
)

NOW = datetime(2026, 10, 23, 3, 0, tzinfo=UTC)


def _policy() -> PublishedCurriculum:
    return PublishedCurriculum(
        current_grade_key="grade-5",
        target_grade_key="grade-6",
        policy_version="policy-v4",
        curriculum_version="curriculum-v8",
        requirements=(
            PublishedRequirement(
                "course-openspec",
                "OpenSpec и SDD",
                RequirementKind.COURSE,
                "openspec-sdd",
                "course-v3",
            ),
            PublishedRequirement(
                "project-api",
                "Проектный checkpoint API",
                RequirementKind.PROJECT,
                "project-api",
                "project-v2",
            ),
        ),
        provenance=VersionedFact(
            "career_grade_policy",
            "policy-v4/curriculum-v8",
            NOW,
            DataOrigin.PRODUCTION,
        ),
    )


def _evidence(key: str, source: str, version: str, state: RequirementState) -> RequirementEvidence:
    return RequirementEvidence(key, source, version, state)


def test_remaining_requirements_progress_from_two_to_one_to_zero() -> None:
    policy = _policy()
    none_done = build_curriculum_remainder(policy, evidence=())
    one_done = build_curriculum_remainder(
        policy,
        evidence=(
            _evidence("course-openspec", "openspec-sdd", "course-v3", RequirementState.VERIFIED),
        ),
    )
    all_done = build_curriculum_remainder(
        policy,
        evidence=(
            _evidence("course-openspec", "openspec-sdd", "course-v3", RequirementState.VERIFIED),
            _evidence("project-api", "project-api", "project-v2", RequirementState.VERIFIED),
        ),
    )

    assert len(none_done.remaining) == 2
    assert len(one_done.remaining) == 1
    assert one_done.remaining[0].kind is RequirementKind.PROJECT
    assert all_done.remaining == ()


def test_revocation_returns_requirement_without_erasing_other_history() -> None:
    remainder = build_curriculum_remainder(
        _policy(),
        evidence=(
            _evidence("course-openspec", "openspec-sdd", "course-v3", RequirementState.REVOKED),
            _evidence("project-api", "project-api", "project-v2", RequirementState.VERIFIED),
        ),
        allowed_actions={RequirementState.REVOKED: "open_recovery"},
    )

    assert tuple(item.key for item in remainder.remaining) == ("course-openspec",)
    assert remainder.remaining[0].state is RequirementState.REVOKED
    assert remainder.remaining[0].allowed_action == "open_recovery"
    assert remainder.requirements[1].state is RequirementState.VERIFIED


def test_reported_and_rejected_are_visible_but_not_verified() -> None:
    remainder = build_curriculum_remainder(
        _policy(),
        evidence=(
            _evidence("course-openspec", "openspec-sdd", "course-v3", RequirementState.REPORTED),
            _evidence("project-api", "project-api", "project-v2", RequirementState.REJECTED),
        ),
    )

    assert tuple(item.state for item in remainder.remaining) == (
        RequirementState.REPORTED,
        RequirementState.REJECTED,
    )


def test_evidence_for_another_source_version_is_unknown_not_credited() -> None:
    remainder = build_curriculum_remainder(
        _policy(),
        evidence=(
            _evidence("course-openspec", "openspec-sdd", "course-v2", RequirementState.VERIFIED),
        ),
    )

    course = remainder.requirements[0]
    assert course.state is RequirementState.UNKNOWN
    assert course in remainder.remaining


def test_absent_policy_is_explicitly_not_evaluable() -> None:
    remainder = build_curriculum_remainder(None, evidence=())

    assert remainder.state is KnowledgeState.NOT_EVALUABLE
    assert remainder.unavailable_reason is not None
    assert remainder.policy_version is None
    assert remainder.remaining == ()


def test_duplicate_current_evidence_is_rejected() -> None:
    duplicate = _evidence("course-openspec", "openspec-sdd", "course-v3", RequirementState.VERIFIED)
    with pytest.raises(ValueError, match="at most one"):
        build_curriculum_remainder(_policy(), evidence=(duplicate, duplicate))


def test_published_policy_requires_unique_requirements() -> None:
    requirement = _policy().requirements[0]
    with pytest.raises(ValueError, match="unique"):
        PublishedCurriculum(
            "grade-5",
            "grade-6",
            "policy-v4",
            "curriculum-v8",
            (requirement, requirement),
            _policy().provenance,
        )
