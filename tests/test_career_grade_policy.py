"""No invented grades, only versioned published policy and qualified evidence."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest

from impulse.domain.career_grade_policy import (
    EvidenceState,
    GradeEvidence,
    GradeRequirement,
    PublishedGradePolicy,
    calculate_grade_readiness,
)

PERSON = UUID("00000000-0000-0000-0000-000000000001")
OTHER = UUID("00000000-0000-0000-0000-000000000002")
NOW = datetime(2026, 10, 24, 10, 0, tzinfo=UTC)


def policy() -> PublishedGradePolicy:
    return PublishedGradePolicy(
        track_key="agent-developer",
        catalog_version="approved-v1",
        calculation_version="weight-v1",
        current_grade_key="grade-level-3",
        target_grade_key="grade-level-4",
        approval_ref="approved-policy:policy-01",
        effective_from=NOW - timedelta(days=1),
        effective_until=None,
        requirements=(
            GradeRequirement("course", "Практическое обучение", "course-x", "published-1", 2),
            GradeRequirement("project", "Завершённый проект", "project-y", "accepted-2", 1),
        ),
    )


def evidence(
    key: str,
    *,
    person_id: UUID = PERSON,
    track_key: str = "agent-developer",
    state: EvidenceState = EvidenceState.VERIFIED,
    trusted: bool = True,
    source_ref: str = "accepted:001",
    source_version: str | None = None,
    observed_at: datetime = NOW,
) -> GradeEvidence:
    source_key = "course-x" if key == "course" else "project-y"
    version = source_version or ("published-1" if key == "course" else "accepted-2")
    return GradeEvidence(
        person_id=person_id,
        track_key=track_key,
        requirement_key=key,
        source_key=source_key,
        source_version=version,
        source_ref=source_ref,
        state=state,
        trusted=trusted,
        observed_at=observed_at,
    )


def test_no_approved_policy_never_calculates_or_grants_grade() -> None:
    result = calculate_grade_readiness(PERSON, "agent-developer", None, as_of=NOW)
    assert result.state == "not_evaluable"
    assert result.completed_percent is None
    assert result.target_grade_key is None
    assert not result.ready_for_atomic_transition
    assert result.calculation_fingerprint is None


def test_weighted_readiness_is_complementary_and_only_verified_counts() -> None:
    item = evidence("course")
    result = calculate_grade_readiness(PERSON, "agent-developer", policy(), (item,), as_of=NOW)
    assert result.state == "known"
    assert result.completed_percent == Decimal(200) / Decimal(3)
    assert result.completed_percent + result.remaining_percent == Decimal(100)
    assert not result.ready_for_atomic_transition
    assert result.requirements[1].state == "not_verified"
    assert result.current_grade_key == "grade-level-3"


def test_last_verified_evidence_proposes_transition_but_does_not_grant() -> None:
    rows = (evidence("course"), evidence("project", source_ref="accepted:002"))
    result = calculate_grade_readiness(PERSON, "agent-developer", policy(), rows, as_of=NOW)
    assert result.completed_percent == Decimal(100)
    assert result.remaining_percent == Decimal(0)
    assert result.ready_for_atomic_transition
    assert result.calculation_fingerprint is not None
    # Duplicate/reordered rows preserve fingerprint (idempotency input).
    replay = calculate_grade_readiness(
        PERSON, "agent-developer", policy(), (rows[1], rows[0], rows[0]), as_of=NOW
    )
    assert replay.calculation_fingerprint == result.calculation_fingerprint


def test_cross_person_role_version_and_untrusted_evidence_never_count() -> None:
    rows = (
        evidence("course", person_id=OTHER),
        evidence("course", track_key="other-track"),
        evidence("course", source_version="old-course-version"),
        evidence("course", trusted=False),
        evidence("project", state=EvidenceState.REPORTED),
    )
    result = calculate_grade_readiness(PERSON, "agent-developer", policy(), rows, as_of=NOW)
    assert result.completed_percent == Decimal(0)
    assert not result.ready_for_atomic_transition


def test_revocation_blocks_prior_verified_evidence() -> None:
    rows = (evidence("course"), evidence("course", state=EvidenceState.REVOKED))
    result = calculate_grade_readiness(PERSON, "agent-developer", policy(), rows, as_of=NOW)
    assert result.completed_percent == Decimal(0)
    assert result.requirements[0].verified_sources == ()


def test_pending_rejected_and_revoked_are_visible_but_not_verified() -> None:
    rows = (
        evidence("course", state=EvidenceState.REPORTED),
        evidence("project", state=EvidenceState.REJECTED, source_ref="rejected:01"),
    )
    state = calculate_grade_readiness(PERSON, "agent-developer", policy(), rows, as_of=NOW)
    assert [position.state for position in state.requirements] == ["reported", "rejected"]
    assert state.completed_percent == Decimal(0)
    assert not state.ready_for_atomic_transition


def test_scheduled_revocation_applies_only_after_effective_time() -> None:
    row = GradeEvidence(
        person_id=PERSON,
        track_key="agent-developer",
        requirement_key="course",
        source_key="course-x",
        source_version="published-1",
        source_ref="verified:before-revocation",
        state=EvidenceState.VERIFIED,
        trusted=True,
        observed_at=NOW - timedelta(hours=1),
        revoked_at=NOW + timedelta(hours=1),
    )
    before = calculate_grade_readiness(PERSON, "agent-developer", policy(), (row,), as_of=NOW)
    after = calculate_grade_readiness(
        PERSON, "agent-developer", policy(), (row,), as_of=NOW + timedelta(hours=2)
    )
    assert before.requirements[0].state == "verified"
    assert after.requirements[0].state == "revoked"
    assert before.completed_percent > after.completed_percent


def test_policy_not_effective_or_wrong_track_does_not_return_readiness() -> None:
    result = calculate_grade_readiness(
        PERSON,
        "agent-developer",
        policy(),
        (evidence("course"),),
        as_of=NOW - timedelta(days=2),
    )
    assert result.state == "not_evaluable"
    assert result.reason == "grade_catalog_policy_not_effective"
    with pytest.raises(ValueError, match="another trajectory"):
        calculate_grade_readiness(PERSON, "qa", policy(), as_of=NOW)


def test_invalid_published_policy_never_treated_as_valid_catalog() -> None:
    with pytest.raises(ValueError, match="source and target"):
        PublishedGradePolicy(
            track_key="agent-developer",
            catalog_version="v1",
            calculation_version="v1",
            current_grade_key="same",
            target_grade_key="same",
            approval_ref="approval-ref",
            effective_from=NOW,
            effective_until=None,
            requirements=(GradeRequirement("x", "Test", "x", "v1", 1),),
        )
    with pytest.raises(ValueError, match="positive weight"):
        GradeRequirement("x", "Test", "x", "v1", 0)
