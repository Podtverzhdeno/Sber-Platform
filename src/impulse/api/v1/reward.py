"""Human-controlled 5+ review API."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.reward import RewardService, RewardWorkspaceItem
from impulse.domain.reward import (
    AppealStatus,
    CriterionAssessment,
    PayoutClaim,
    PayoutStatus,
    Review5Plus,
    ReviewAppeal,
    ReviewGrade,
    ReviewRubric,
    ReviewStatus,
    SettlementAttempt,
    SettlementKind,
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


class DemoSettlementRequest(ReviewTransitionRequest):
    request_key: str = Field(min_length=1, max_length=160)
    success: bool = True


class DemoReversalRequest(ReviewTransitionRequest):
    request_key: str = Field(min_length=1, max_length=160)


class OpenReviewAppealRequest(ReviewTransitionRequest):
    reason: str = Field(min_length=1, max_length=4000)


class ResolveReviewAppealRequest(BaseModel):
    expected_appeal_version: int = Field(ge=1)
    expected_review_version: int = Field(ge=1)
    outcome: Literal[AppealStatus.UPHELD, AppealStatus.CORRECTED]
    reason: str = Field(min_length=1, max_length=4000)
    grade: ReviewGrade | None = None
    assessments: list[CriterionAssessmentRequest] | None = None
    explanation: str | None = Field(default=None, min_length=1, max_length=4000)


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


class PayoutClaimView(BaseModel):
    id: UUID
    assignment_id: UUID
    contribution_version: int
    terms_version: int
    review_id: UUID
    review_version: int
    grade: ReviewGrade
    amount: Decimal | None
    currency: str | None
    status: PayoutStatus
    version: int
    approved_by: UUID | None


class SettlementAttemptView(BaseModel):
    id: UUID
    payout_claim_id: UUID
    attempt_number: int
    request_key: str
    kind: SettlementKind
    status: PayoutStatus
    provider_reference: str | None
    demo: bool


class DemoSettlementView(BaseModel):
    claim: PayoutClaimView
    settlement: SettlementAttemptView


class ReviewAppealView(BaseModel):
    id: UUID
    review_id: UUID
    disputed_review_version: int
    participant_id: UUID
    reason: str
    opened_at: datetime
    deadline_at: datetime
    status: AppealStatus
    version: int
    resolved_by: UUID | None
    resolution_reason: str | None
    resulting_review_version: int | None


class ReviewAppealResultView(BaseModel):
    appeal: ReviewAppealView
    review: ReviewView


class RewardWorkspaceItemView(BaseModel):
    review: ReviewView
    payout: PayoutClaimView | None


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


def _payout_view(claim: PayoutClaim) -> PayoutClaimView:
    return PayoutClaimView(
        id=claim.claim_id,
        assignment_id=claim.assignment_id,
        contribution_version=claim.contribution_version,
        terms_version=claim.terms_version,
        review_id=claim.review_id,
        review_version=claim.review_version,
        grade=claim.grade,
        amount=claim.amount,
        currency=claim.currency,
        status=claim.status,
        version=claim.version,
        approved_by=claim.approved_by,
    )


def _settlement_view(attempt: SettlementAttempt) -> SettlementAttemptView:
    return SettlementAttemptView(
        id=attempt.attempt_id,
        payout_claim_id=attempt.payout_claim_id,
        attempt_number=attempt.attempt_number,
        request_key=attempt.request_key,
        kind=attempt.kind,
        status=attempt.status,
        provider_reference=attempt.provider_reference,
        demo=attempt.demo,
    )


def _appeal_view(appeal: ReviewAppeal) -> ReviewAppealView:
    return ReviewAppealView(
        id=appeal.appeal_id,
        review_id=appeal.review_id,
        disputed_review_version=appeal.disputed_review_version,
        participant_id=appeal.participant_id,
        reason=appeal.reason,
        opened_at=appeal.opened_at,
        deadline_at=appeal.deadline_at,
        status=appeal.status,
        version=appeal.version,
        resolved_by=appeal.resolved_by,
        resolution_reason=appeal.resolution_reason,
        resulting_review_version=appeal.resulting_review_version,
    )


def _workspace_view(item: RewardWorkspaceItem) -> RewardWorkspaceItemView:
    return RewardWorkspaceItemView(
        review=_review_view(item.review),
        payout=_payout_view(item.payout) if item.payout is not None else None,
    )


@router.get("/me/reward-evidence", response_model=list[RewardWorkspaceItemView])
async def participant_reward_evidence(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> list[RewardWorkspaceItemView]:
    return [
        _workspace_view(item)
        for item in await service.participant_reward_evidence(authenticated.actor)
    ]


@router.get("/mentor/review-workspace", response_model=list[RewardWorkspaceItemView])
async def mentor_review_workspace(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> list[RewardWorkspaceItemView]:
    return [
        _workspace_view(item)
        for item in await service.mentor_review_workspace(authenticated.actor)
    ]


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


@router.post(
    "/operations/reviews/{review_id}/payout-calculation",
    response_model=PayoutClaimView,
)
async def calculate_payout(
    review_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> PayoutClaimView:
    return _payout_view(await service.calculate_payout(authenticated.actor, review_id))


@router.post("/operations/payouts/{claim_id}/approve", response_model=PayoutClaimView)
async def approve_payout(
    claim_id: UUID,
    command: ReviewTransitionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> PayoutClaimView:
    return _payout_view(
        await service.approve_payout(
            authenticated.actor, claim_id, command.expected_version
        )
    )


@router.post(
    "/operations/payouts/{claim_id}/demo-settle",
    response_model=DemoSettlementView,
)
async def settle_payout_demo(
    claim_id: UUID,
    command: DemoSettlementRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> DemoSettlementView:
    claim, attempt = await service.settle_demo(
        authenticated.actor,
        claim_id,
        command.expected_version,
        request_key=command.request_key,
        success=command.success,
    )
    return DemoSettlementView(
        claim=_payout_view(claim), settlement=_settlement_view(attempt)
    )


@router.post(
    "/operations/payouts/{claim_id}/demo-reverse",
    response_model=DemoSettlementView,
)
async def reverse_payout_demo(
    claim_id: UUID,
    command: DemoReversalRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> DemoSettlementView:
    claim, attempt = await service.reverse_demo(
        authenticated.actor,
        claim_id,
        command.expected_version,
        request_key=command.request_key,
    )
    return DemoSettlementView(
        claim=_payout_view(claim), settlement=_settlement_view(attempt)
    )


@router.post(
    "/me/reviews/{review_id}/appeals",
    response_model=ReviewAppealResultView,
)
async def open_review_appeal(
    review_id: UUID,
    command: OpenReviewAppealRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewAppealResultView:
    appeal, review = await service.open_review_appeal(
        authenticated.actor,
        review_id,
        command.expected_version,
        reason=command.reason,
    )
    return ReviewAppealResultView(appeal=_appeal_view(appeal), review=_review_view(review))


@router.post(
    "/operations/review-appeals/{appeal_id}/resolve",
    response_model=ReviewAppealResultView,
)
async def resolve_review_appeal(
    appeal_id: UUID,
    command: ResolveReviewAppealRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RewardService, Depends(_service)],
) -> ReviewAppealResultView:
    assessments = (
        tuple(
            CriterionAssessment(
                criterion_key=item.criterion_key,
                finding=item.finding,
                evidence_refs=tuple(item.evidence_refs),
            )
            for item in command.assessments
        )
        if command.assessments is not None
        else None
    )
    appeal, review = await service.resolve_review_appeal(
        authenticated.actor,
        appeal_id,
        expected_appeal_version=command.expected_appeal_version,
        expected_review_version=command.expected_review_version,
        outcome=command.outcome,
        reason=command.reason,
        grade=command.grade,
        assessments=assessments,
        explanation=command.explanation,
    )
    return ReviewAppealResultView(appeal=_appeal_view(appeal), review=_review_view(review))
