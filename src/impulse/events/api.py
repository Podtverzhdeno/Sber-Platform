"""HTTP API for the participant event detail and registration aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.events.models import EventDetailRecord, RegistrationAggregate
from impulse.events.service import ParticipantEventsService

router = APIRouter(tags=["events"])


class EventProgramStageView(BaseModel):
    day: str
    title: str
    detail: str


class EventRewardView(BaseModel):
    kind: str
    label: str
    note: str


class EventDetailView(BaseModel):
    key: str
    title: str
    event_type: str
    organizer: str
    status: str
    conditions: str
    source_url: str
    source_status: str
    source_checked_at: datetime | None
    track_keys: list[str]
    recommendation_reason: str
    description: str | None
    target_audience: str | None
    prerequisites: list[str] | None
    program: list[EventProgramStageView] | None
    expected_result: str | None
    participation_rules: str | None
    venue_format: str | None
    timezone: str | None
    starts_at: datetime | None
    ends_at: datetime | None
    deadline_at: datetime | None
    rewards: list[EventRewardView] | None


class RegistrationAggregateView(BaseModel):
    event_key: str
    started_registrations: int | None
    confirmed_registrations: int | None
    participations: int | None
    counter_state: str
    computed_at: datetime | None
    source_checked_at: datetime | None
    definition: str
    definition_version: int
    definition_text: str
    contains_personal_data: bool


def _service(request: Request) -> ParticipantEventsService:
    return request.app.state.participant_events_service


def _detail_view(record: EventDetailRecord) -> EventDetailView:
    return EventDetailView(
        key=record.key,
        title=record.title,
        event_type=record.event_type,
        organizer=record.organizer,
        status=record.status,
        conditions=record.conditions,
        source_url=record.source_url,
        source_status=record.source_status,
        source_checked_at=record.source_checked_at,
        track_keys=list(record.track_keys),
        recommendation_reason=record.recommendation_reason,
        description=record.description,
        target_audience=record.target_audience,
        prerequisites=(list(record.prerequisites) if record.prerequisites is not None else None),
        program=(
            [
                EventProgramStageView(day=stage.day, title=stage.title, detail=stage.detail)
                for stage in record.program
            ]
            if record.program is not None
            else None
        ),
        expected_result=record.expected_result,
        participation_rules=record.participation_rules,
        venue_format=record.venue_format,
        timezone=record.timezone,
        starts_at=record.starts_at,
        ends_at=record.ends_at,
        deadline_at=record.deadline_at,
        rewards=(
            [
                EventRewardView(kind=reward.kind, label=reward.label, note=reward.note)
                for reward in record.rewards
            ]
            if record.rewards is not None
            else None
        ),
    )


def _aggregate_view(aggregate: RegistrationAggregate) -> RegistrationAggregateView:
    return RegistrationAggregateView(
        event_key=aggregate.event_key,
        started_registrations=aggregate.started_registrations,
        confirmed_registrations=aggregate.confirmed_registrations,
        participations=aggregate.participations,
        counter_state=aggregate.counter_state,
        computed_at=aggregate.computed_at,
        source_checked_at=aggregate.source_checked_at,
        definition=aggregate.definition,
        definition_version=aggregate.definition_version,
        definition_text=aggregate.definition_text,
        contains_personal_data=aggregate.contains_personal_data,
    )


@router.get("/ecosystem/events/{event_key}", response_model=EventDetailView)
async def event_detail(
    event_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[ParticipantEventsService, Depends(_service)],
) -> EventDetailView:
    record = await service.event_detail(authenticated.actor, event_key)
    return _detail_view(record)


@router.get(
    "/ecosystem/events/{event_key}/registration",
    response_model=RegistrationAggregateView,
)
async def event_registration_aggregate(
    event_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[ParticipantEventsService, Depends(_service)],
) -> RegistrationAggregateView:
    aggregate = await service.registration_aggregate(authenticated.actor, event_key)
    return _aggregate_view(aggregate)
