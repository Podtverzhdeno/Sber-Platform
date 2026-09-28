"""Role-scoped analytics API."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.analytics import participant_analytics
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter()


class FunnelStageView(BaseModel):
    key: str
    title: str
    status: str
    completed: bool
    count: int


class EarningsView(BaseModel):
    calculated: Decimal
    approved: Decimal
    paid: Decimal
    failed: Decimal
    currency: str | None
    unknown_items: int


class ParticipantAnalyticsView(BaseModel):
    stages: list[FunnelStageView]
    successful: bool
    next_action: str
    earnings: EarningsView
    freshness: str
    generated_at: datetime


@router.get("/me/analytics/journey", response_model=ParticipantAnalyticsView)
async def participant_journey(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> ParticipantAnalyticsView:
    actor = authenticated.actor
    if actor.active_role is not Role.PARTICIPANT:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    projection = participant_analytics(
        await request.app.state.development_service.store.attempts(actor.person_id),
        await request.app.state.development_service.store.enrollments(actor.person_id),
        await request.app.state.work_service.participant_work(actor),
        await request.app.state.reward_service.participant_reward_evidence(actor),
        generated_at=datetime.now(UTC),
    )
    return ParticipantAnalyticsView.model_validate(projection, from_attributes=True)
