"""Application policy tests for human-controlled 5+ reviews."""
# ruff: noqa: RUF001

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import cast
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.reward import (
    MemoryRewardStore,
    ReviewEvidence,
    RewardService,
)
from impulse.application.work import (
    ApplicationRecord,
    AssignmentRecord,
    ContributionRecord,
    TaskRecord,
    TermsRecord,
    WorkStore,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import (
    AppealStatus,
    CompensationTerms,
    CriterionAssessment,
    PayoutStatus,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    RoundingMode,
    RubricCriterion,
)
from impulse.domain.work import (
    ApplicationStatus,
    AssignmentStatus,
    ContributionStatus,
    TaskAggregate,
    TaskBrief,
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


class PayoutWorkStub:
    def __init__(self) -> None:
        self.task_id = uuid4()
        self.application_record = ApplicationRecord(
            uuid4(), self.task_id, uuid4(), 3, ApplicationStatus.ACCEPTED
        )
        self.assignment_record = AssignmentRecord(
            uuid4(),
            self.task_id,
            self.application_record.person_id,
            self.application_record.id,
            AssignmentStatus.ACCEPTED,
        )
        self.contribution_record = ContributionRecord(
            uuid4(),
            self.assignment_record.id,
            2,
            "Личный вклад подтверждён.",
            ("artifact:mvp",),
            ContributionStatus.ACCEPTED,
        )
        self.terms_record = TermsRecord(
            self.task_id,
            3,
            datetime(2026, 10, 1, tzinfo=UTC),
            "MVP",
            ("Принят заказчиком",),
            None,
            CompensationTerms(
                paid=True,
                base_amount_per_assignee=Decimal("10000.00"),
                currency="RUB",
                a_multiplier=Decimal("2.5"),
                quantum=Decimal("0.01"),
                rounding_mode=RoundingMode.HALF_UP,
                policy_version=1,
                payout_condition="После принятия личного вклада и оценки 5+.",
            ),
        )
        self.task_record = TaskRecord(
            "impulse-demo",
            "mentor-queue",
            "MVP для mentor queue",
            TaskAggregate(
                self.task_id,
                uuid4(),
                TaskBrief(
                    problem="Проверить гипотезу.",
                    deliverable="MVP",
                    acceptance_criteria=("Результат принят",),
                    deadline_at=self.terms_record.deadline_at,
                    data_constraints="Демо-данные",
                    ip_terms="Условия зафиксированы",
                ),
            ),
        )

    async def contribution(self, contribution_id: UUID) -> ContributionRecord | None:
        return self.contribution_record if contribution_id == self.contribution_record.id else None

    async def assignment(self, assignment_id: UUID) -> AssignmentRecord | None:
        return self.assignment_record if assignment_id == self.assignment_record.id else None

    async def application(self, application_id: UUID) -> ApplicationRecord | None:
        return self.application_record if application_id == self.application_record.id else None

    async def terms_version(self, task_id: UUID, version: int) -> TermsRecord | None:
        if (task_id, version) == (self.task_id, self.terms_record.version):
            return self.terms_record
        return None

    async def get(self, task_id: UUID) -> TaskRecord | None:
        return self.task_record if task_id == self.task_id else None

    async def latest_terms(self, task_id: UUID) -> TermsRecord | None:
        return self.terms_record if task_id == self.task_id else None

    async def assignments_for_person(self, person_id: UUID) -> tuple[AssignmentRecord, ...]:
        return (self.assignment_record,) if person_id == self.assignment_record.person_id else ()

    async def contributions_for_assignment(
        self, assignment_id: UUID
    ) -> tuple[ContributionRecord, ...]:
        return (self.contribution_record,) if assignment_id == self.assignment_record.id else ()


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


@pytest.mark.asyncio
async def test_payout_retry_idempotency_and_reversal_never_double_pay() -> None:
    work = PayoutWorkStub()
    store = MemoryRewardStore()
    review = Review5Plus(
        review_id=uuid4(),
        contribution_id=work.contribution_record.id,
        contribution_version=work.contribution_record.version,
        rubric_id=uuid4(),
        rubric_version=1,
        review_version=1,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "Принято.", ("artifact:mvp",)),),
        explanation="Принятый результат соответствует оценке B.",
        status=ReviewStatus.PUBLISHED,
        confirmed_by=uuid4(),
        published_by=uuid4(),
    )
    await store.add_review_version(review)
    service = RewardService(
        store,
        EvidenceStub(uuid4(), ReviewEvidence(review.contribution_id, 2, True, False)),
        cast(WorkStore, work),
    )
    operator = actor(uuid4(), Role.OPERATOR)

    calculated = await service.calculate_payout(operator, review.review_id)
    duplicate_calculation = await service.calculate_payout(operator, review.review_id)
    assert duplicate_calculation.claim_id == calculated.claim_id
    assert calculated.amount == Decimal("15000.00")
    approved = await service.approve_payout(operator, calculated.claim_id, 1)

    failed, first = await service.settle_demo(
        operator, approved.claim_id, approved.version, request_key="payment-1", success=False
    )
    duplicate, same_first = await service.settle_demo(
        operator, approved.claim_id, approved.version, request_key="payment-1", success=False
    )
    assert failed.status is PayoutStatus.FAILED
    assert duplicate.status is PayoutStatus.FAILED
    assert same_first.attempt_id == first.attempt_id

    paid, second = await service.settle_demo(
        operator, failed.claim_id, failed.version, request_key="payment-2", success=True
    )
    reversed_claim, reversal = await service.reverse_demo(
        operator, paid.claim_id, paid.version, request_key="reversal-1"
    )
    assert (first.attempt_number, second.attempt_number, reversal.attempt_number) == (1, 2, 3)
    assert paid.status is PayoutStatus.PAID
    assert reversed_claim.status is PayoutStatus.REVERSED


@pytest.mark.asyncio
async def test_appeal_blocks_old_payout_and_correction_creates_new_claim() -> None:
    work = PayoutWorkStub()
    store = MemoryRewardStore()
    original = Review5Plus(
        review_id=uuid4(),
        contribution_id=work.contribution_record.id,
        contribution_version=work.contribution_record.version,
        rubric_id=uuid4(),
        rubric_version=1,
        review_version=1,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "Принято.", ("artifact:mvp",)),),
        explanation="Исходная оценка B.",
        status=ReviewStatus.PUBLISHED,
        confirmed_by=uuid4(),
        published_by=uuid4(),
    )
    await store.add_review_version(original)
    service = RewardService(
        store,
        EvidenceStub(uuid4(), ReviewEvidence(original.contribution_id, 2, True, False)),
        cast(WorkStore, work),
    )
    operator = actor(uuid4(), Role.OPERATOR)
    participant = actor(work.application_record.person_id, Role.PARTICIPANT)
    old_claim = await service.calculate_payout(operator, original.review_id)

    appeal, disputed = await service.open_review_appeal(
        participant,
        original.review_id,
        original.review_version,
        reason="Не учтён дополнительный подтверждённый результат.",
    )
    assert disputed.status is ReviewStatus.DISPUTED
    with pytest.raises(ApiError) as blocked:
        await service.approve_payout(operator, old_claim.claim_id, old_claim.version)
    assert blocked.value.code == "PAYOUT_BLOCKED_BY_APPEAL"

    resolved_appeal, corrected = await service.resolve_review_appeal(
        operator,
        appeal.appeal_id,
        expected_appeal_version=appeal.version,
        expected_review_version=disputed.review_version,
        outcome=AppealStatus.CORRECTED,
        reason="Дополнительный результат подтверждён артефактом.",
        grade=ReviewGrade.A,
        assessments=(CriterionAssessment("result", "Превышены ожидания.", ("artifact:mvp-v2",)),),
        explanation="Исправленная оценка A основана на дополнительном результате.",
    )
    assert resolved_appeal.status is AppealStatus.CORRECTED
    assert corrected.review_version == 3
    assert corrected.grade is ReviewGrade.A
    assert original.grade is ReviewGrade.B

    with pytest.raises(ApiError) as stale_claim:
        await service.approve_payout(operator, old_claim.claim_id, old_claim.version)
    assert stale_claim.value.code == "PAYOUT_RECALCULATION_REQUIRED"
    new_claim = await service.calculate_payout(operator, original.review_id)
    assert new_claim.claim_id != old_claim.claim_id
    assert new_claim.review_version == corrected.review_version
    assert new_claim.amount == Decimal("25000.00")


@pytest.mark.asyncio
async def test_appeal_policy_rejects_foreign_participant_and_closed_window() -> None:
    work = PayoutWorkStub()
    store = MemoryRewardStore()
    review = Review5Plus(
        review_id=uuid4(),
        contribution_id=work.contribution_record.id,
        contribution_version=work.contribution_record.version,
        rubric_id=uuid4(),
        rubric_version=1,
        review_version=1,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "Принято.", ("artifact:mvp",)),),
        explanation="Опубликованная оценка.",
        status=ReviewStatus.PUBLISHED,
        published_by=uuid4(),
    )
    await store.add_review_version(review)
    published_at = await store.review_created_at(review.review_id, review.review_version)
    assert published_at is not None
    service = RewardService(
        store,
        EvidenceStub(uuid4(), ReviewEvidence(review.contribution_id, 2, True, False)),
        cast(WorkStore, work),
        clock=lambda: published_at + timedelta(days=15),
    )

    with pytest.raises(ApiError) as hidden:
        await service.open_review_appeal(
            actor(uuid4(), Role.PARTICIPANT),
            review.review_id,
            review.review_version,
            reason="Чужая оценка.",
        )
    assert hidden.value.code == "RESOURCE_NOT_FOUND"

    with pytest.raises(ApiError) as expired:
        await service.open_review_appeal(
            actor(work.application_record.person_id, Role.PARTICIPANT),
            review.review_id,
            review.review_version,
            reason="Срок уже завершился.",
        )
    assert expired.value.code == "APPEAL_WINDOW_CLOSED"


@pytest.mark.asyncio
async def test_reward_workspaces_expose_only_owned_or_assigned_review() -> None:
    work = PayoutWorkStub()
    mentor_id = uuid4()
    store = MemoryRewardStore()
    review = Review5Plus(
        review_id=uuid4(),
        contribution_id=work.contribution_record.id,
        contribution_version=work.contribution_record.version,
        rubric_id=uuid4(),
        rubric_version=1,
        review_version=1,
        grade=ReviewGrade.B,
        assessments=(CriterionAssessment("result", "Принято.", ("artifact:mvp",)),),
        explanation="Финальная оценка человека.",
        status=ReviewStatus.PUBLISHED,
        draft_origin="ai_suggestion",
        confirmed_by=mentor_id,
        published_by=mentor_id,
    )
    await store.add_review_version(review)
    evidence = EvidenceStub(mentor_id, ReviewEvidence(review.contribution_id, 2, True, False))
    service = RewardService(store, evidence, cast(WorkStore, work))

    participant_items = await service.participant_reward_evidence(
        actor(work.application_record.person_id, Role.PARTICIPANT)
    )
    mentor_items = await service.mentor_review_workspace(actor(mentor_id, Role.MENTOR))
    foreign_mentor_items = await service.mentor_review_workspace(actor(uuid4(), Role.MENTOR))
    queue = await service.mentor_review_queue(actor(mentor_id, Role.MENTOR))
    foreign_queue = await service.mentor_review_queue(actor(uuid4(), Role.MENTOR))

    assert participant_items[0].review == review
    assert mentor_items[0].review.draft_origin == "ai_suggestion"
    assert foreign_mentor_items == ()
    assert queue[0].task_title == "MVP для mentor queue"
    assert queue[0].deadline_at == work.terms_record.deadline_at
    assert foreign_queue == ()
