"""Human-controlled 5+ review API."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.reward import RewardService
from impulse.domain.reward import (
    CriterionAssessment,
    Review5Plus,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
)

router = APIRouter()


class CriterionAssessmentRequest(BaseModel):
    criterion_key: str = Field(min_length=1, max_length=96)
    finding: str = Field(min_length=1, max_length=2000)
    evidence_refs: list[str] = Field(min_length=1, max_length=30)


class CreateReviewRequest(BaseModel):
    rubric_id: UUID
    grade: ReviewGrade
    assessments: list[CriterionAssessmentRequest] = Field(min_length=1, max_length=30)
    explanation: str = Field(min_length=1, max_length=4000)
    draft_origin: Literal["human", "ai_suggestion"] = "human"


class ReviewTransitionRequest(BaseModel):
    expected_version: int = Field(ge=1)


class RubricCriterionView(BaseModel):
    key: str
    title: str


class ReviewRubricView(BaseModel):
    id: UUID
    key: str
    version: int
    criteria: list[RubricCriterionView]


class CriterionAssessmentView(BaseModel):
    criterion_key: str
    finding: str
    evidence_refs: list[str]


class ReviewView(BaseModel):
    id: UUID
    contribution_id: UUID
    contribution_version: int
    rubric_id: UUID
    rubric_version: int
    version: int
    grade: ReviewGrade
    assessments: list[CriterionAssessmentView]
    explanation: str
    status: ReviewStatus
    draft_origin: str
    confirmed_by: UUID | None
    published_by: UUID | None


def _service(request: Request) -> RewardService:
    return request.app.state.reward_service


def _rubric_view(rubric: ReviewRubric) -> ReviewRubricView:
    return ReviewRubricView(
        id=rubric.rubric_id,
        key=rubric.key,
        version=rubric.version,
        criteria=[RubricCriterionView(key=item.key, title=item.title) for item in rubric.criteria],
    )


def _review_view(review: Review5Plus) -> ReviewView:
    return ReviewView(
        id=review.review_id,
        contribution_id=review.contribution_id,
        contribution_version=review.contribution_version,
        rubric_id=review.rubric_id,
        rubric_version=review.rubric_version,
        version=review.review_version,
        grade=review.grade,
        assessments=[
            CriterionAssessmentView(
                criterion_key=item.criterion_key,
                finding=item.finding,
                evidence_refs=list(item.evidence_refs),
            )
            for item in review.assessments
        ],
        explanation=review.explanation,
        status=review.status,
        draft_origin=review.draft_origin,
        confirmed_by=review.confirmed_by,
        published_by=review.published_by,
    )


@router.get("/mentor/review-rubrics/{rubric_id}", response_model=ReviewRubricView)
async def review_rubric(
    rubric_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewRubricView:
    return _rubric_view(await service.rubric(authenticated.actor, rubric_id))


@router.post("/mentor/contributions/{contribution_id}/reviews", response_model=ReviewView)
async def create_review(
    contribution_id: UUID,
    command: CreateReviewRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewView:
    return _review_view(
        await service.create_draft(
            authenticated.actor,
            contribution_id=contribution_id,
            rubric_id=command.rubric_id,
            grade=command.grade,
            assessments=tuple(
                CriterionAssessment(
                    criterion_key=item.criterion_key,
                    finding=item.finding,
                    evidence_refs=tuple(item.evidence_refs),
                )
                for item in command.assessments
            ),
            explanation=command.explanation,
            draft_origin=command.draft_origin,
        )
    )


async def _transition(
    action: str,
    review_id: UUID,
    command: ReviewTransitionRequest,
    authenticated: AuthenticatedSession,
    service: RewardService,
) -> ReviewView:
    operation = {
        "propose": service.propose,
        "confirm": service.confirm,
        "publish": service.publish,
    }[action]
    return _review_view(await operation(authenticated.actor, review_id, command.expected_version))


@router.post("/mentor/reviews/{review_id}/propose", response_model=ReviewView)
async def propose_review(
    review_id: UUID,
    command: ReviewTransitionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewView:
    return await _transition("propose", review_id, command, authenticated, service)


@router.post("/mentor/reviews/{review_id}/confirm", response_model=ReviewView)
async def confirm_review(
    review_id: UUID,
    command: ReviewTransitionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewView:
    return await _transition("confirm", review_id, command, authenticated, service)


@router.post("/mentor/reviews/{review_id}/publish", response_model=ReviewView)
async def publish_review(
    review_id: UUID,
    command: ReviewTransitionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewView:
    return await _transition("publish", review_id, command, authenticated, service)
