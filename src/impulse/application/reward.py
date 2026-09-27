"""Human-controlled 5+ review use cases."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.work import WorkStore
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import (
    CompensationPolicyError,
    CriterionAssessment,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
)
from impulse.domain.work import ContributionStatus


@dataclass(frozen=True, slots=True)
class ReviewEvidence:
    contribution_id: UUID
    contribution_version: int
    accepted: bool
    authorship_conflict_open: bool


class ReviewStore(Protocol):
    async def rubric(self, rubric_id: UUID) -> ReviewRubric | None: ...
    async def add_rubric(self, rubric: ReviewRubric) -> ReviewRubric: ...
    async def review(self, review_id: UUID) -> Review5Plus | None: ...
    async def add_review_version(self, review: Review5Plus) -> Review5Plus: ...


class ReviewEvidenceProvider(Protocol):
    async def for_mentor(self, mentor_id: UUID, contribution_id: UUID) -> ReviewEvidence | None: ...


class MemoryRewardStore:
    def __init__(self, rubrics: tuple[ReviewRubric, ...] = ()) -> None:
        self._rubrics = {item.rubric_id: item for item in rubrics}
        self._reviews: dict[UUID, tuple[Review5Plus, ...]] = {}

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
        return review


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
    def __init__(self, store: ReviewStore, evidence: ReviewEvidenceProvider) -> None:
        self.store = store
        self.evidence = evidence

    @staticmethod
    def _not_found() -> ApiError:
        return ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)

    @staticmethod
    def _mentor(actor: ActorContext) -> None:
        if actor.active_role is not Role.MENTOR:
            raise RewardService._not_found()

    @staticmethod
    def _policy(operation: Callable[[], Review5Plus]) -> Review5Plus:
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
