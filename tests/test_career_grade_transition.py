"""Grade transitions require a published policy, all trusted evidence and atomic CAS."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

from impulse.application.career_grade_transition import CareerGradeTransitionService
from impulse.domain.career_grade_policy import (
    EvidenceState,
    GradeEvidence,
    GradeRequirement,
    PublishedGradePolicy,
)

PERSON = UUID("00000000-0000-0000-0000-000000000001")
NOW = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
ROLE = "product"


class Registry:
    def __init__(self, published: bool = True) -> None:
        self.published = published
        self.policy = PublishedGradePolicy(
            track_key=ROLE,
            catalog_version="approved-2026-v1",
            calculation_version="weighted-v1",
            current_grade_key="grade-1",
            target_grade_key="grade-2",
            approval_ref="approved:catalog-2026",
            effective_from=NOW - timedelta(days=2),
            effective_until=None,
            requirements=(
                GradeRequirement("course", "Обучение", "course-1", "v1", 1),
                GradeRequirement("practice", "Проверенная практика", "project-1", "v3", 2),
            ),
        )

    async def next_policy(self, track_key: str, current_grade_key: str, as_of: datetime):
        if self.published and track_key == ROLE and current_grade_key == "grade-1":
            return self.policy
        return None


class Evidence:
    def __init__(self, practice_approved: bool = False, untrusted: bool = False) -> None:
        self.practice_approved = practice_approved
        self.untrusted = untrusted

    async def evidence_for(self, person_id: UUID, track_key: str, policy: PublishedGradePolicy):
        rows = [
            GradeEvidence(
                person_id=person_id,
                track_key=track_key,
                requirement_key="course",
                source_key="course-1",
                source_version="v1",
                source_ref="verified:course-1",
                state=EvidenceState.VERIFIED,
                trusted=not self.untrusted,
                observed_at=NOW,
            )
        ]
        if self.practice_approved:
            rows.append(
                GradeEvidence(
                    person_id=person_id,
                    track_key=track_key,
                    requirement_key="practice",
                    source_key="project-1",
                    source_version="v3",
                    source_ref="accepted:project-1",
                    state=EvidenceState.VERIFIED,
                    trusted=True,
                    observed_at=NOW,
                )
            )
        return tuple(rows)


class AtomicAwards:
    def __init__(self) -> None:
        self.current = "grade-1"
        self.awards: list[str] = []
        self.lock = asyncio.Lock()

    async def current_grade(self, person_id: UUID, track_key: str) -> str:
        return self.current

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
        async with self.lock:
            if self.current != from_grade:
                return False
            assert calculation_fingerprint
            self.current = to_grade
            self.awards.append(to_grade)
            return True


def test_only_fully_verified_policy_advances_once_across_parallel_calls() -> None:
    registry, evidence, awards = Registry(), Evidence(), AtomicAwards()
    engine = CareerGradeTransitionService(registry, evidence, awards)

    async def scenario():
        pending = await engine.evaluate_and_advance(PERSON, ROLE, as_of=NOW)
        assert pending.state == "requirements_open"
        assert pending.readiness and str(pending.readiness.completed_percent) != "100"
        assert awards.current == "grade-1"
        evidence.practice_approved = True
        results = await asyncio.gather(
            *[engine.evaluate_and_advance(PERSON, ROLE, as_of=NOW) for _ in range(7)]
        )
        assert sum(result.issued for result in results) == 1
        assert awards.current == "grade-2"
        assert awards.awards == ["grade-2"]
        replay = await engine.evaluate_and_advance(PERSON, ROLE, as_of=NOW)
        assert not replay.issued and awards.current == "grade-2"

    asyncio.run(scenario())


def test_unpublished_policy_and_untrusted_course_never_grant() -> None:
    async def scenario():
        awards = AtomicAwards()
        missing = await CareerGradeTransitionService(
            Registry(False), Evidence(practice_approved=True), awards
        ).evaluate_and_advance(PERSON, ROLE, as_of=NOW)
        assert missing.state == "not_evaluable"
        assert not missing.issued
        wrong = await CareerGradeTransitionService(
            Registry(), Evidence(practice_approved=True, untrusted=True), awards
        ).evaluate_and_advance(PERSON, ROLE, as_of=NOW)
        assert wrong.state == "requirements_open"
        assert not wrong.issued
        assert awards.current == "grade-1"

    asyncio.run(scenario())
