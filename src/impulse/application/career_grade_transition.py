"""Atomic, idempotent career-grade advancement after ALL policy evidence is verified.

The issuer never creates policies or invents grades. Production must supply an
approved, effective policy registry, a trusted evidence feed and a durable
compare-and-swap award store before any automatic transition is possible.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from impulse.domain.career_grade_policy import (
    GradeEvidence,
    GradeReadiness,
    PublishedGradePolicy,
    calculate_grade_readiness,
)


class PublishedGradePolicyProvider(Protocol):
    async def next_policy(
        self, track_key: str, current_grade_key: str, as_of: datetime
    ) -> PublishedGradePolicy | None: ...


class TrustedGradeEvidenceProvider(Protocol):
    async def evidence_for(
        self, person_id: UUID, track_key: str, policy: PublishedGradePolicy
    ) -> tuple[GradeEvidence, ...]: ...


class CareerGradeAwardStore(Protocol):
    async def current_grade(self, person_id: UUID, track_key: str) -> str | None: ...

    async def award_if_current(
        self,
        *,
        person_id: UUID,
        track_key: str,
        from_grade: str,
        to_grade: str,
        catalog_version: str,
        calculation_fingerprint: str,
        awarded_at: datetime,
    ) -> bool:
        """Durable atomic CAS, with unique award key. Return False if already advanced."""


@dataclass(frozen=True, slots=True)
class CareerGradeTransitionResult:
    state: str
    reason: str | None
    before_grade: str | None
    current_grade: str | None
    target_grade: str | None
    issued: bool
    readiness: GradeReadiness | None


class CareerGradeTransitionService:
    def __init__(
        self,
        policy_provider: PublishedGradePolicyProvider,
        evidence_provider: TrustedGradeEvidenceProvider,
        awards: CareerGradeAwardStore,
    ) -> None:
        self._policies = policy_provider
        self._evidence = evidence_provider
        self._awards = awards

    async def evaluate_and_advance(
        self,
        person_id: UUID,
        track_key: str,
        *,
        as_of: datetime,
    ) -> CareerGradeTransitionResult:
        """Run on trusted verification changes, never on a raw browser claim.

        Competing verification callbacks both evaluate, but the award store's
        database transaction is the authoritative single-winner CAS.
        """
        current = await self._awards.current_grade(person_id, track_key)
        if current is None:
            return CareerGradeTransitionResult(
                "not_evaluable", "initial_grade_not_assigned", None, None, None,
                False, None,
            )
        policy = await self._policies.next_policy(track_key, current, as_of)
        if policy is None:
            return CareerGradeTransitionResult(
                "not_evaluable", "grade_catalog_policy_not_published",
                current, current, None, False, None,
            )
        if policy.track_key != track_key or policy.current_grade_key != current:
            raise ValueError("Grade policy must match current role and actual awarded grade")
        evidence = await self._evidence.evidence_for(person_id, track_key, policy)
        readiness = calculate_grade_readiness(
            person_id, track_key, policy, evidence, as_of=as_of,
        )
        if readiness.state != "known":
            return CareerGradeTransitionResult(
                "not_evaluable", readiness.reason, current, current,
                policy.target_grade_key, False, readiness,
            )
        if not readiness.ready_for_atomic_transition:
            return CareerGradeTransitionResult(
                "requirements_open", None, current, current,
                policy.target_grade_key, False, readiness,
            )
        if readiness.calculation_fingerprint is None:
            raise ValueError("Verified grade transition needs an auditable fingerprint")
        issued = await self._awards.award_if_current(
            person_id=person_id, track_key=track_key,
            from_grade=current, to_grade=policy.target_grade_key,
            catalog_version=policy.catalog_version,
            calculation_fingerprint=readiness.calculation_fingerprint,
            awarded_at=as_of,
        )
        after = await self._awards.current_grade(person_id, track_key)
        # Another legitimate callback may have won the race. Do not falsely
        # claim that this request awarded a grade or revert its persisted state.
        return CareerGradeTransitionResult(
            "awarded" if issued else "already_processed",
            None,
            current, after, policy.target_grade_key, issued, readiness,
        )


__all__ = [
    "CareerGradeAwardStore",
    "CareerGradeTransitionResult",
    "CareerGradeTransitionService",
    "PublishedGradePolicyProvider",
    "TrustedGradeEvidenceProvider",
]
