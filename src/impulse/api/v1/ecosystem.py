"""Participant event catalog and external participation evidence API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.api.v1.schemas import CursorPage
from impulse.application.ecosystem import ClaimRecord, EcosystemService, EventRecord
from impulse.application.identity import AuthenticatedSession
from impulse.domain.ecosystem import ClaimStatus, ExternalIdentity, claim_creates_trophy

router = APIRouter()


class EventView(BaseModel):
    key: str
    title: str
    event_type: str
    organizer: str
    conditions: str
    source_url: str
    deadline_at: datetime | None
    starts_at: datetime | None
    status: str
    track_keys: list[str]
    recommendation_reason: str
    source_checked_at: datetime
    source_status: str


class ClaimView(BaseModel):
    id: UUID
    event_key: str
    claim_type: str
    status: ClaimStatus
    trophy_created: bool
    verification_explanation: str


class ReportClaimRequest(BaseModel):
    claim_type: Literal["participation", "winner", "prize"] = "participation"


class DecisionRequest(BaseModel):
    status: Literal["verified", "rejected", "revoked"]
    reason: str = Field(min_length=3, max_length=500)


class ImportClaimRequest(BaseModel):
    provider_id: str = Field(min_length=1, max_length=96)
    external_id: str = Field(min_length=1, max_length=160)
    person_external_key: str = Field(min_length=1, max_length=160)
    event_key: str = Field(min_length=1, max_length=128)
    claim_type: Literal["participation", "winner", "prize"] = "participation"


def _service(request: Request) -> EcosystemService:
    return request.app.state.ecosystem_service


def _event_view(item: EventRecord) -> EventView:
    return EventView(
        key=item.key,
        title=item.title,
        event_type=item.event_type,
        organizer=item.organizer,
        conditions=item.conditions,
        source_url=item.source_url,
        deadline_at=item.deadline_at,
        starts_at=item.starts_at,
        status=item.status,
        track_keys=list(item.track_keys),
        recommendation_reason=item.recommendation_reason,
        source_checked_at=item.source_checked_at,
        source_status=item.source_status,
    )


def _claim_view(item: ClaimRecord) -> ClaimView:
    trophy_created = claim_creates_trophy(item.claim_type, item.status)
    explanations = {
        ClaimStatus.REPORTED: "Участие заявлено вами; трофей и баллы не созданы.",
        ClaimStatus.AWAITING_VERIFICATION: "Источник ожидает проверки оператором.",
        ClaimStatus.VERIFIED: "Источник подтверждён.",
        ClaimStatus.REJECTED: "Источник не подтвердил заявленный факт.",
        ClaimStatus.REVOKED: "Подтверждение отозвано; зависимые записи корректируются.",
    }
    return ClaimView(
        id=item.id,
        event_key=item.event_key,
        claim_type=item.claim_type,
        status=item.status,
        trophy_created=trophy_created,
        verification_explanation=explanations[item.status],
    )


@router.get("/ecosystem/events", response_model=CursorPage[EventView])
async def event_catalog(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[EcosystemService, Depends(_service)],
    track: Annotated[str | None, Query(max_length=96)] = None,
    event_type: Annotated[str | None, Query(max_length=64)] = None,
    status: Annotated[str | None, Query(max_length=64)] = None,
    cursor: Annotated[str | None, Query(max_length=128)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CursorPage[EventView]:
    page = await service.catalog(
        authenticated.actor,
        track=track,
        event_type=event_type,
        status=status,
        cursor=cursor,
        limit=limit,
    )
    return CursorPage(
        items=[_event_view(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get("/me/event-claims", response_model=list[ClaimView])
async def participant_claims(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[EcosystemService, Depends(_service)],
) -> list[ClaimView]:
    return [_claim_view(item) for item in await service.participant_claims(authenticated.actor)]


@router.post("/me/events/{event_key}/claims", response_model=ClaimView)
async def report_claim(
    event_key: str,
    command: ReportClaimRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[EcosystemService, Depends(_service)],
) -> ClaimView:
    return _claim_view(await service.report(authenticated.actor, event_key, command.claim_type))


@router.post("/me/event-claims/{claim_id}/submit", response_model=ClaimView)
async def submit_claim(
    claim_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[EcosystemService, Depends(_service)],
) -> ClaimView:
    return _claim_view(await service.submit(authenticated.actor, claim_id))


@router.post("/operations/event-claims/{claim_id}/decision", response_model=ClaimView)
async def decide_claim(
    claim_id: UUID,
    command: DecisionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[EcosystemService, Depends(_service)],
) -> ClaimView:
    return _claim_view(
        await service.decide(authenticated.actor, claim_id, ClaimStatus(command.status))
    )


@router.post("/operations/event-claims/import", response_model=ClaimView)
async def import_claim(
    command: ImportClaimRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[EcosystemService, Depends(_service)],
) -> ClaimView:
    return _claim_view(
        await service.import_external(
            authenticated.actor,
            ExternalIdentity(
                command.provider_id,
                command.external_id,
                command.person_external_key,
            ),
            command.event_key,
            command.claim_type,
        )
    )
