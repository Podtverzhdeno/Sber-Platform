"""Application policy tests for human-controlled 5+ reviews."""

from dataclasses import replace
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.reward import (
    MemoryRewardStore,
    ReviewEvidence,
    RewardService,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import (
    CriterionAssessment,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    RubricCriterion,
)


class EvidenceStub:
    def __init__(self, mentor_id: UUID, evidence: ReviewEvidence) -> None:
        self.mentor_id = mentor_id
        self.evidence = evidence

    async def for_mentor(self, mentor_id: UUID, contribution_id: UUID) -> ReviewEvidence | None:
        if mentor_id != self.mentor_id or contribution_id != self.evidence.contribution_id:
            return None
        return self.evidence


def actor(person_id: UUID, role: Role = Role.MENTOR) -> ActorContext:
    return ActorContext(
        person_id=person_id,
        display_name="Елена Наставник",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


def rubric() -> ReviewRubric:
    return ReviewRubric(
        rubric_id=uuid4(),
        key="demo-5plus",
        version=1,
        criteria=(RubricCriterion("result", "Результат"),),
    )


@pytest.mark.asyncio
async def test_human_b_review_is_versioned_and_published_for_accepted_contribution() -> None:
    mentor_id = uuid4()
    contribution_id = uuid4()
    current_rubric = rubric()
    store = MemoryRewardStore((current_rubric,))
    service = RewardService(
        store,
        EvidenceStub(mentor_id, ReviewEvidence(contribution_id, 2, True, False)),
    )
    draft = await service.create_draft(
        actor(mentor_id),
        contribution_id=contribution_id,
        rubric_id=current_rubric.rubric_id,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "MVP принят заказчиком.", ("artifact:mvp",)),),
        explanation="Оценка B: результат принят, критерии выполнены.",
        draft_origin="ai_suggestion",
    )
    proposed = await service.propose(actor(mentor_id), draft.review_id, 1)
    confirmed = await service.confirm(actor(mentor_id), draft.review_id, 2)
    published = await service.publish(actor(mentor_id), draft.review_id, 3)

    assert proposed.status is ReviewStatus.PROPOSED
    assert confirmed.confirmed_by == mentor_id
    assert published.status is ReviewStatus.PUBLISHED
    assert published.grade is ReviewGrade.B
    assert published.explanation.startswith("Оценка B")
    assert (draft.review_version, proposed.review_version, confirmed.review_version) == (1, 2, 3)
    assert published.review_version == 4


@pytest.mark.asyncio
async def test_publish_rechecks_conflict_and_stale_evidence() -> None:
    mentor_id = uuid4()
    contribution_id = uuid4()
    current_rubric = rubric()
    evidence = EvidenceStub(mentor_id, ReviewEvidence(contribution_id, 1, True, False))
    service = RewardService(MemoryRewardStore((current_rubric,)), evidence)
    draft = await service.create_draft(
        actor(mentor_id),
        contribution_id=contribution_id,
        rubric_id=current_rubric.rubric_id,
        grade=ReviewGrade.A,
        assessments=(CriterionAssessment("result", "Сильный результат.", ("commit:7",)),),
        explanation="Превышены ожидания по результату.",
        draft_origin="human",
    )
    await service.propose(actor(mentor_id), draft.review_id, 1)
    await service.confirm(actor(mentor_id), draft.review_id, 2)

    evidence.evidence = replace(evidence.evidence, authorship_conflict_open=True)
    with pytest.raises(ApiError) as conflict:
        await service.publish(actor(mentor_id), draft.review_id, 3)
    assert conflict.value.code == "INVALID_REVIEW_TRANSITION"

    evidence.evidence = replace(
        evidence.evidence,
        contribution_version=2,
        authorship_conflict_open=False,
    )
    with pytest.raises(ApiError) as stale:
        await service.publish(actor(mentor_id), draft.review_id, 3)
    assert stale.value.code == "STALE_EVIDENCE"


@pytest.mark.asyncio
async def test_foreign_mentor_and_stale_review_are_non_disclosing_or_rejected() -> None:
    mentor_id = uuid4()
    contribution_id = uuid4()
    current_rubric = rubric()
    service = RewardService(
        MemoryRewardStore((current_rubric,)),
        EvidenceStub(mentor_id, ReviewEvidence(contribution_id, 1, True, False)),
    )
    with pytest.raises(ApiError) as hidden:
        await service.create_draft(
            actor(uuid4()),
            contribution_id=contribution_id,
            rubric_id=current_rubric.rubric_id,
            grade=ReviewGrade.B,
            assessments=(CriterionAssessment("result", "Факт.", ("artifact:1",)),),
            explanation="Проверяемое объяснение.",
            draft_origin="human",
        )
    assert hidden.value.code == "RESOURCE_NOT_FOUND"

    draft = await service.create_draft(
        actor(mentor_id),
        contribution_id=contribution_id,
        rubric_id=current_rubric.rubric_id,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "Факт.", ("artifact:1",)),),
        explanation="Проверяемое объяснение.",
        draft_origin="human",
    )
    await service.propose(actor(mentor_id), draft.review_id, 1)
    with pytest.raises(ApiError) as stale:
        await service.confirm(actor(mentor_id), draft.review_id, 1)
    assert stale.value.code == "STALE_REVIEW"
