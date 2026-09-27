"""Human-controlled 5+ review use cases."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol, TypeVar
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.work import WorkStore
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import (
    AppealStatus,
    CompensationPolicyError,
    CriterionAssessment,
    PayoutClaim,
    PayoutStatus,
    Review5Plus,
    ReviewAppeal,
    ReviewGrade,
    ReviewRubric,
    RubricCriterion,
    SettlementAttempt,
    SettlementKind,
)
from impulse.domain.work import ContributionStatus

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class ReviewEvidence:
    contribution_id: UUID
    contribution_version: int
    accepted: bool
    authorship_conflict_open: bool


DEFAULT_REVIEW_RUBRIC = ReviewRubric(
    rubric_id=UUID("d993683b-a578-54c8-9b87-45190ac59056"),
    key="impulse-5plus-demo",
    version=1,
    criteria=(
        RubricCriterion("result", "Качество и полнота результата"),
        RubricCriterion("evidence", "Проверяемость личного вклада"),
        RubricCriterion("ownership", "Самостоятельность и ответственность"),
    ),
)


class ReviewStore(Protocol):
    async def rubric(self, rubric_id: UUID) -> ReviewRubric | None: ...
    async def add_rubric(self, rubric: ReviewRubric) -> ReviewRubric: ...
    async def review(self, review_id: UUID) -> Review5Plus | None: ...
    async def add_review_version(self, review: Review5Plus) -> Review5Plus: ...
    async def review_created_at(self, review_id: UUID, review_version: int) -> datetime | None: ...
    async def appeal(self, appeal_id: UUID) -> ReviewAppeal | None: ...
    async def open_appeal_for_review(self, review_id: UUID) -> ReviewAppeal | None: ...
    async def add_review_appeal(
        self, appeal: ReviewAppeal, disputed_review: Review5Plus
    ) -> ReviewAppeal: ...
    async def resolve_review_appeal(
        self,
        appeal: ReviewAppeal,
        review: Review5Plus,
        *,
        expected_appeal_version: int,
        expected_review_version: int,
    ) -> tuple[ReviewAppeal, Review5Plus]: ...
    async def payout_claim(
        self,
        assignment_id: UUID,
        contribution_version: int,
        terms_version: int,
        review_version: int,
    ) -> PayoutClaim | None: ...
    async def payout_claim_by_id(self, claim_id: UUID) -> PayoutClaim | None: ...
    async def add_payout_claim(self, claim: PayoutClaim) -> PayoutClaim: ...
    async def save_payout_claim(self, claim: PayoutClaim, expected_version: int) -> PayoutClaim: ...
    async def settlement_attempt(
        self, claim_id: UUID, request_key: str
    ) -> SettlementAttempt | None: ...
    async def next_settlement_attempt_number(self, claim_id: UUID) -> int: ...
    async def add_settlement_attempt(self, attempt: SettlementAttempt) -> SettlementAttempt: ...


class ReviewEvidenceProvider(Protocol):
    async def for_mentor(self, mentor_id: UUID, contribution_id: UUID) -> ReviewEvidence | None: ...


class MemoryRewardStore:
    def __init__(self, rubrics: tuple[ReviewRubric, ...] | None = None) -> None:
        configured = rubrics if rubrics is not None else (DEFAULT_REVIEW_RUBRIC,)
        self._rubrics = {item.rubric_id: item for item in configured}
        self._reviews: dict[UUID, tuple[Review5Plus, ...]] = {}
        self._review_times: dict[tuple[UUID, int], datetime] = {}
        self._appeals: dict[UUID, ReviewAppeal] = {}
        self._claims: dict[UUID, PayoutClaim] = {}
        self._attempts: dict[tuple[UUID, str], SettlementAttempt] = {}

    async def rubric(self, rubric_id: UUID) -> ReviewRubric | None:
        return self._rubrics.get(rubric_id)

    async def add_rubric(self, rubric: ReviewRubric) -> ReviewRubric:
        self._rubrics[rubric.rubric_id] = rubric
        return rubric

    async def review(self, review_id: UUID) -> Review5Plus | None:
        versions = self._reviews.get(review_id, ())
        return versions[-1] if versions else None

    async def add_review_version(self, review: Review5Plus) -> Review5Plus:
        versions = self._reviews.get(review.review_id, ())
        if versions and review.review_version != versions[-1].review_version + 1:
            raise ApiError(
                code="STALE_REVIEW",
                message="Оценка изменилась. Обновите данные перед решением.",
                status_code=409,
            )
        if not versions and review.review_version != 1:
            raise ApiError(
                code="STALE_REVIEW",
                message="Первая версия оценки должна быть черновиком.",
                status_code=409,
            )
        self._reviews[review.review_id] = (*versions, review)
        self._review_times[(review.review_id, review.review_version)] = datetime.now(UTC)
        return review

    async def review_created_at(self, review_id: UUID, review_version: int) -> datetime | None:
        return self._review_times.get((review_id, review_version))

    async def appeal(self, appeal_id: UUID) -> ReviewAppeal | None:
        return self._appeals.get(appeal_id)

    async def open_appeal_for_review(self, review_id: UUID) -> ReviewAppeal | None:
        return next(
            (
                item
                for item in self._appeals.values()
                if item.review_id == review_id and item.status is AppealStatus.OPEN
            ),
            None,
        )

    async def add_review_appeal(
        self, appeal: ReviewAppeal, disputed_review: Review5Plus
    ) -> ReviewAppeal:
        if await self.open_appeal_for_review(appeal.review_id) is not None:
            raise ApiError("APPEAL_ALREADY_OPEN", "Для оценки уже открыта апелляция.", 409)
        await self.add_review_version(disputed_review)
        self._appeals[appeal.appeal_id] = appeal
        return appeal

    async def resolve_review_appeal(
        self,
        appeal: ReviewAppeal,
        review: Review5Plus,
        *,
        expected_appeal_version: int,
        expected_review_version: int,
    ) -> tuple[ReviewAppeal, Review5Plus]:
        current_appeal = self._appeals.get(appeal.appeal_id)
        current_review = await self.review(review.review_id)
        if current_appeal is None or current_appeal.version != expected_appeal_version:
            raise ApiError("STALE_APPEAL", "Апелляция изменилась. Обновите данные.", 409)
        if current_review is None or current_review.review_version != expected_review_version:
            raise ApiError("STALE_REVIEW", "Оценка изменилась. Обновите данные.", 409)
        await self.add_review_version(review)
        self._appeals[appeal.appeal_id] = appeal
        return appeal, review

    async def payout_claim(
        self,
        assignment_id: UUID,
        contribution_version: int,
        terms_version: int,
        review_version: int,
    ) -> PayoutClaim | None:
        return next(
            (
                item
                for item in self._claims.values()
                if (
                    item.assignment_id,
                    item.contribution_version,
                    item.terms_version,
                    item.review_version,
                )
                == (assignment_id, contribution_version, terms_version, review_version)
            ),
            None,
        )

    async def payout_claim_by_id(self, claim_id: UUID) -> PayoutClaim | None:
        return self._claims.get(claim_id)

    async def add_payout_claim(self, claim: PayoutClaim) -> PayoutClaim:
        existing = await self.payout_claim(
            claim.assignment_id,
            claim.contribution_version,
            claim.terms_version,
            claim.review_version,
        )
        if existing is not None:
            return existing
        self._claims[claim.claim_id] = claim
        return claim

    async def save_payout_claim(self, claim: PayoutClaim, expected_version: int) -> PayoutClaim:
        current = self._claims.get(claim.claim_id)
        if current is None or current.version != expected_version:
            raise ApiError(
                code="STALE_PAYOUT",
                message="Начисление изменилось. Обновите данные перед действием.",
                status_code=409,
            )
        self._claims[claim.claim_id] = claim
        return claim

    async def settlement_attempt(
        self, claim_id: UUID, request_key: str
    ) -> SettlementAttempt | None:
        return self._attempts.get((claim_id, request_key))

    async def next_settlement_attempt_number(self, claim_id: UUID) -> int:
        return 1 + sum(
            item.payout_claim_id == claim_id for item in self._attempts.values()
        )

    async def add_settlement_attempt(self, attempt: SettlementAttempt) -> SettlementAttempt:
        key = (attempt.payout_claim_id, attempt.request_key)
        existing = self._attempts.get(key)
        if existing is not None:
            return existing
        self._attempts[key] = attempt
        return attempt


class WorkReviewEvidenceProvider:
    def __init__(self, work_store: WorkStore) -> None:
        self.work_store = work_store

    async def for_mentor(self, mentor_id: UUID, contribution_id: UUID) -> ReviewEvidence | None:
        contribution = await self.work_store.contribution(contribution_id)
        if contribution is None:
            return None
        assignment = await self.work_store.assignment(contribution.assignment_id)
        if assignment is None:
            return None
        task = await self.work_store.get(assignment.task_id)
        if task is None:
            return None
        support = task.aggregate.support
        assigned = task.aggregate.nominated_mentor_id == mentor_id or (
            support is not None and support.assignee_id == mentor_id
        )
        if not assigned:
            return None
        return ReviewEvidence(
            contribution_id=contribution.id,
            contribution_version=contribution.version,
            accepted=contribution.status is ContributionStatus.ACCEPTED,
            authorship_conflict_open=contribution.status is ContributionStatus.DISPUTED,
        )


class RewardService:
    def __init__(
        self,
        store: ReviewStore,
        evidence: ReviewEvidenceProvider,
        work_store: WorkStore | None = None,
        clock: Callable[[], datetime] | None = None,
        appeal_window: timedelta = timedelta(days=14),
    ) -> None:
        self.store = store
        self.evidence = evidence
        self.work_store = work_store
        self.clock = clock or (lambda: datetime.now(UTC))
        self.appeal_window = appeal_window

    @staticmethod
    def _not_found() -> ApiError:
        return ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)

    @staticmethod
    def _mentor(actor: ActorContext) -> None:
        if actor.active_role is not Role.MENTOR:
            raise RewardService._not_found()

    @staticmethod
    def _operator(actor: ActorContext) -> None:
        if actor.active_role is not Role.OPERATOR:
            raise RewardService._not_found()

    @staticmethod
    def _participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise RewardService._not_found()

    @staticmethod
    def _policy(operation: Callable[[], T]) -> T:
        try:
            return operation()
        except CompensationPolicyError as exc:
            raise ApiError(
                code="INVALID_REVIEW_TRANSITION",
                message=str(exc),
                status_code=409,
            ) from exc

    async def _evidence(self, actor: ActorContext, contribution_id: UUID) -> ReviewEvidence:
        self._mentor(actor)
        evidence = await self.evidence.for_mentor(actor.person_id, contribution_id)
        if evidence is None:
            raise self._not_found()
        return evidence

    async def create_draft(
        self,
        actor: ActorContext,
        *,
        contribution_id: UUID,
        rubric_id: UUID,
        grade: ReviewGrade,
        assessments: tuple[CriterionAssessment, ...],
        explanation: str,
        draft_origin: str,
    ) -> Review5Plus:
        evidence = await self._evidence(actor, contribution_id)
        rubric = await self.store.rubric(rubric_id)
        if rubric is None:
            raise self._not_found()
        review = self._policy(
            lambda: Review5Plus.draft(
                review_id=uuid4(),
                contribution_id=contribution_id,
                contribution_version=evidence.contribution_version,
                rubric=rubric,
                grade=grade,
                assessments=assessments,
                explanation=explanation,
                draft_origin=draft_origin,
            )
        )
        return await self.store.add_review_version(review)

    async def rubric(self, actor: ActorContext, rubric_id: UUID) -> ReviewRubric:
        self._mentor(actor)
        rubric = await self.store.rubric(rubric_id)
        if rubric is None:
            raise self._not_found()
        return rubric

    async def propose(
        self, actor: ActorContext, review_id: UUID, expected_version: int
    ) -> Review5Plus:
        review = await self._current(actor, review_id, expected_version)
        return await self.store.add_review_version(self._policy(review.propose))

    async def confirm(
        self, actor: ActorContext, review_id: UUID, expected_version: int
    ) -> Review5Plus:
        review = await self._current(actor, review_id, expected_version)
        return await self.store.add_review_version(
            self._policy(lambda: review.confirm(actor.person_id))
        )

    async def publish(
        self, actor: ActorContext, review_id: UUID, expected_version: int
    ) -> Review5Plus:
        review = await self._current(actor, review_id, expected_version)
        evidence = await self._evidence(actor, review.contribution_id)
        if evidence.contribution_version != review.contribution_version:
            raise ApiError(
                code="STALE_EVIDENCE",
                message="Версия личного вклада изменилась; создайте новую оценку.",
                status_code=409,
            )
        published = self._policy(
            lambda: review.publish(
                actor.person_id,
                contribution_accepted=evidence.accepted,
                authorship_conflict_open=evidence.authorship_conflict_open,
            )
        )
        return await self.store.add_review_version(published)

    async def _current(
        self, actor: ActorContext, review_id: UUID, expected_version: int
    ) -> Review5Plus:
        self._mentor(actor)
        review = await self.store.review(review_id)
        if review is None:
            raise self._not_found()
        await self._evidence(actor, review.contribution_id)
        if review.review_version != expected_version:
            raise ApiError(
                code="STALE_REVIEW",
                message="Оценка изменилась. Обновите данные перед решением.",
                status_code=409,
            )
        return review

    async def calculate_payout(self, actor: ActorContext, review_id: UUID) -> PayoutClaim:
        self._operator(actor)
        if self.work_store is None:
            raise ApiError(
                code="PAYOUT_NOT_CONFIGURED",
                message="Контур начислений не настроен.",
                status_code=503,
            )
        review = await self.store.review(review_id)
        if review is None:
            raise self._not_found()
        await self._ensure_no_open_appeal(review_id)
        contribution = await self.work_store.contribution(review.contribution_id)
        if contribution is None:
            raise self._not_found()
        assignment = await self.work_store.assignment(contribution.assignment_id)
        if assignment is None:
            raise self._not_found()
        application = await self.work_store.application(assignment.application_id)
        if application is None:
            raise self._not_found()
        terms = await self.work_store.terms_version(
            assignment.task_id,
            application.accepted_terms_version,
        )
        if terms is None:
            raise self._not_found()
        existing = await self.store.payout_claim(
            assignment.id,
            contribution.version,
            terms.version,
            review.review_version,
        )
        if existing is not None:
            return existing
        claim = self._policy(
            lambda: PayoutClaim.calculate(
                claim_id=uuid4(),
                assignment_id=assignment.id,
                contribution_version=contribution.version,
                terms_version=terms.version,
                review=review,
                compensation=terms.compensation,
            )
        )
        return await self.store.add_payout_claim(claim)

    async def approve_payout(
        self, actor: ActorContext, claim_id: UUID, expected_version: int
    ) -> PayoutClaim:
        self._operator(actor)
        claim = await self._claim(claim_id, expected_version)
        await self._ensure_no_open_appeal(claim.review_id)
        await self._ensure_claim_review_current(claim)
        approved = self._policy(lambda: claim.approve(actor.person_id))
        return await self.store.save_payout_claim(approved, expected_version)

    async def settle_demo(
        self,
        actor: ActorContext,
        claim_id: UUID,
        expected_version: int,
        *,
        request_key: str,
        success: bool,
    ) -> tuple[PayoutClaim, SettlementAttempt]:
        self._operator(actor)
        existing_attempt = await self.store.settlement_attempt(claim_id, request_key)
        if existing_attempt is not None:
            claim = await self.store.payout_claim_by_id(claim_id)
            if claim is None:
                raise self._not_found()
            return claim, existing_attempt
        claim = await self._claim(claim_id, expected_version)
        await self._ensure_no_open_appeal(claim.review_id)
        await self._ensure_claim_review_current(claim)
        sent = self._policy(claim.send)
        sent = await self.store.save_payout_claim(sent, expected_version)
        settled = self._policy(lambda: sent.settle(success=success))
        settled = await self.store.save_payout_claim(settled, sent.version)
        attempt_number = await self.store.next_settlement_attempt_number(claim_id)
        attempt = SettlementAttempt(
            attempt_id=uuid4(),
            payout_claim_id=claim_id,
            attempt_number=attempt_number,
            request_key=request_key,
            kind=SettlementKind.PAYMENT,
            status=settled.status,
            provider_reference=f"demo-{request_key}",
        )
        return settled, await self.store.add_settlement_attempt(attempt)

    async def reverse_demo(
        self,
        actor: ActorContext,
        claim_id: UUID,
        expected_version: int,
        *,
        request_key: str,
    ) -> tuple[PayoutClaim, SettlementAttempt]:
        self._operator(actor)
        existing_attempt = await self.store.settlement_attempt(claim_id, request_key)
        if existing_attempt is not None:
            claim = await self.store.payout_claim_by_id(claim_id)
            if claim is None:
                raise self._not_found()
            return claim, existing_attempt
        claim = await self._claim(claim_id, expected_version)
        reversed_claim = self._policy(claim.reverse)
        reversed_claim = await self.store.save_payout_claim(reversed_claim, expected_version)
        attempt_number = await self.store.next_settlement_attempt_number(claim_id)
        attempt = SettlementAttempt(
            attempt_id=uuid4(),
            payout_claim_id=claim_id,
            attempt_number=attempt_number,
            request_key=request_key,
            kind=SettlementKind.REVERSAL,
            status=PayoutStatus.REVERSED,
            provider_reference=f"demo-reversal-{request_key}",
        )
        return reversed_claim, await self.store.add_settlement_attempt(attempt)

    async def open_review_appeal(
        self,
        actor: ActorContext,
        review_id: UUID,
        expected_review_version: int,
        *,
        reason: str,
    ) -> tuple[ReviewAppeal, Review5Plus]:
        self._participant(actor)
        if self.work_store is None:
            raise ApiError("APPEAL_NOT_CONFIGURED", "Контур апелляций не настроен.", 503)
        review = await self.store.review(review_id)
        if review is None or review.review_version != expected_review_version:
            raise ApiError("STALE_REVIEW", "Оценка изменилась. Обновите данные.", 409)
        contribution = await self.work_store.contribution(review.contribution_id)
        if contribution is None:
            raise self._not_found()
        assignment = await self.work_store.assignment(contribution.assignment_id)
        if assignment is None or assignment.person_id != actor.person_id:
            raise self._not_found()
        published_at = await self.store.review_created_at(review_id, review.review_version)
        if published_at is None:
            raise self._not_found()
        deadline_at = published_at + self.appeal_window
        now = self.clock()
        if now >= deadline_at:
            raise ApiError("APPEAL_WINDOW_CLOSED", "Срок апелляции завершён.", 409)
        disputed = self._policy(review.dispute)
        appeal = self._policy(
            lambda: ReviewAppeal(
                appeal_id=uuid4(),
                review_id=review_id,
                disputed_review_version=review.review_version,
                participant_id=actor.person_id,
                reason=reason,
                opened_at=now,
                deadline_at=deadline_at,
            )
        )
        saved_appeal = await self.store.add_review_appeal(appeal, disputed)
        return saved_appeal, disputed

    async def resolve_review_appeal(
        self,
        actor: ActorContext,
        appeal_id: UUID,
        *,
        expected_appeal_version: int,
        expected_review_version: int,
        outcome: AppealStatus,
        reason: str,
        grade: ReviewGrade | None = None,
        assessments: tuple[CriterionAssessment, ...] | None = None,
        explanation: str | None = None,
    ) -> tuple[ReviewAppeal, Review5Plus]:
        self._operator(actor)
        appeal = await self.store.appeal(appeal_id)
        if appeal is None or appeal.version != expected_appeal_version:
            raise ApiError("STALE_APPEAL", "Апелляция изменилась. Обновите данные.", 409)
        review = await self.store.review(appeal.review_id)
        if review is None or review.review_version != expected_review_version:
            raise ApiError("STALE_REVIEW", "Оценка изменилась. Обновите данные.", 409)
        if outcome is AppealStatus.UPHELD:
            resolved_review = self._policy(lambda: review.uphold(actor.person_id))
        elif outcome is AppealStatus.CORRECTED:
            if grade is None or assessments is None or explanation is None:
                raise ApiError(
                    "CORRECTION_REQUIRED",
                    "Для исправления нужны оценка, критерии и объяснение.",
                    422,
                )
            resolved_review = self._policy(
                lambda: review.correct(
                    actor.person_id,
                    grade=grade,
                    assessments=assessments,
                    explanation=explanation,
                )
            )
        else:
            raise ApiError("INVALID_APPEAL_OUTCOME", "Недопустимый исход апелляции.", 422)
        resolved_appeal = self._policy(
            lambda: appeal.resolve(
                status=outcome,
                human_id=actor.person_id,
                reason=reason,
                resulting_review_version=resolved_review.review_version,
            )
        )
        return await self.store.resolve_review_appeal(
            resolved_appeal,
            resolved_review,
            expected_appeal_version=expected_appeal_version,
            expected_review_version=expected_review_version,
        )

    async def _ensure_no_open_appeal(self, review_id: UUID) -> None:
        if await self.store.open_appeal_for_review(review_id) is not None:
            raise ApiError(
                "PAYOUT_BLOCKED_BY_APPEAL",
                "Выплата заблокирована до решения по апелляции.",
                409,
            )

    async def _ensure_claim_review_current(self, claim: PayoutClaim) -> None:
        review = await self.store.review(claim.review_id)
        if review is None or review.review_version != claim.review_version:
            raise ApiError(
                "PAYOUT_RECALCULATION_REQUIRED",
                "После решения по апелляции начисление нужно пересчитать по новой версии оценки.",
                409,
            )

    async def _claim(self, claim_id: UUID, expected_version: int) -> PayoutClaim:
        claim = await self.store.payout_claim_by_id(claim_id)
        if claim is None:
            raise self._not_found()
        if claim.version != expected_version:
            raise ApiError(
                code="STALE_PAYOUT",
                message="Начисление изменилось. Обновите данные перед действием.",
                status_code=409,
            )
        return claim
