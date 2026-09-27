"""Evidence-first participant portfolio and consented HR search."""

from __future__ import annotations

from dataclasses import replace
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.development import DevelopmentService
from impulse.application.identity import AuthenticatedSession, DemoAuthService, PersonaRecord
from impulse.application.reward import RewardService
from impulse.application.talent import PipelineEvent, PipelineStage, TalentService
from impulse.application.work import WorkService
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import ConsentScope, Role
from impulse.domain.reward import ReviewStatus
from impulse.domain.work import ContributionStatus

router = APIRouter()


class PortfolioContributionView(BaseModel):
    contribution_id: UUID
    project_title: str
    personal_summary: str
    artifact_keys: list[str]
    grade: str | None
    review_reason: str | None
    verification_status: str


class PortfolioCourseView(BaseModel):
    key: str
    title: str
    status: str


class PortfolioCredentialView(BaseModel):
    verification_id: str
    title: str
    status: str


class PortfolioTrophyView(BaseModel):
    title: str
    organizer: str
    source_url: str
    trophy_type: str


class PortfolioView(BaseModel):
    person_id: UUID
    display_name: str
    contributions: list[PortfolioContributionView]
    courses: list[PortfolioCourseView]
    credentials: list[PortfolioCredentialView]
    trophies: list[PortfolioTrophyView]
    offers: list[dict[str, str]]
    visibility: dict[str, bool]
    demo_data: bool = True


class CandidateSummaryView(BaseModel):
    person_id: UUID
    display_name: str
    accepted_projects: int
    verified_courses: int
    top_grade: str | None


class PipelineEventCommand(BaseModel):
    stage: PipelineStage
    note: str = Field(default="", max_length=500)


class PipelineEventView(BaseModel):
    id: UUID
    candidate_id: UUID
    candidate_name: str
    stage: PipelineStage
    note: str
    occurred_at: str
    origin: str


class PipelineView(BaseModel):
    counts: dict[PipelineStage, int]
    events: list[PipelineEventView]


def _services(
    request: Request,
) -> tuple[DemoAuthService, WorkService, RewardService, DevelopmentService]:
    return (
        request.app.state.auth_service,
        request.app.state.work_service,
        request.app.state.reward_service,
        request.app.state.development_service,
    )


def _participant_actor(persona: PersonaRecord, authenticated: AuthenticatedSession):
    return replace(
        authenticated.actor,
        person_id=persona.person_id,
        display_name=persona.display_name,
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
    )


async def _projection(
    request: Request, authenticated: AuthenticatedSession, persona: PersonaRecord
) -> PortfolioView:
    auth, work, reward, development = _services(request)
    actor = _participant_actor(persona, authenticated)
    work_items = await work.participant_work(actor)
    reward_items = await reward.participant_reward_evidence(actor)
    public_statuses = {ReviewStatus.PUBLISHED, ReviewStatus.CORRECTED, ReviewStatus.UPHELD}
    reviews = {
        item.review.contribution_id: item.review
        for item in reward_items
        if item.review.status in public_statuses
    }
    contributions: list[PortfolioContributionView] = []
    for item in work_items:
        for contribution in item.contributions:
            if contribution.status is not ContributionStatus.ACCEPTED:
                continue
            review = reviews.get(contribution.id)
            contributions.append(
                PortfolioContributionView(
                    contribution_id=contribution.id,
                    project_title=item.task.title,
                    personal_summary=contribution.personal_summary,
                    artifact_keys=list(contribution.artifact_keys),
                    grade=review.grade.value if review else None,
                    review_reason=review.explanation if review else None,
                    verification_status="verified",
                )
            )
    course_records = {item.key: item for item in await development.store.courses()}
    courses = [
        PortfolioCourseView(
            key=item.course_key,
            title=course_records[item.course_key].title,
            status=item.status.value,
        )
        for item in await development.store.enrollments(persona.person_id)
        if item.status is CompletionStatus.VERIFIED and item.course_key in course_records
    ]
    consents = await auth.store.granted_consents(persona.person_id)
    return PortfolioView(
        person_id=persona.person_id,
        display_name=persona.display_name,
        contributions=contributions,
        courses=courses,
        credentials=[],
        trophies=[],
        offers=[],
        visibility={scope.value: scope in consents for scope in ConsentScope},
    )


def _require_role(authenticated: AuthenticatedSession, role: Role) -> None:
    if authenticated.actor.active_role is not role:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)


@router.get("/me/portfolio", response_model=PortfolioView)
async def my_portfolio(
    request: Request, authenticated: Annotated[AuthenticatedSession, Depends(current_session)]
) -> PortfolioView:
    _require_role(authenticated, Role.PARTICIPANT)
    auth, *_ = _services(request)
    persona = await auth.store.get_persona_by_id(authenticated.actor.person_id)
    if persona is None:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    return await _projection(request, authenticated, persona)


@router.get("/hr/candidates", response_model=list[CandidateSummaryView])
async def hr_candidates(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    search: Annotated[str | None, Query(max_length=100)] = None,
    min_projects: Annotated[int, Query(ge=0, le=100)] = 0,
    grade: Annotated[str | None, Query(pattern="^[ABC]$")] = None,
) -> list[CandidateSummaryView]:
    _require_role(authenticated, Role.HR)
    auth, *_ = _services(request)
    result: list[CandidateSummaryView] = []
    for persona in await auth.store.list_personas():
        if Role.PARTICIPANT not in persona.roles:
            continue
        if ConsentScope.HR_PROFILE not in await auth.store.granted_consents(persona.person_id):
            continue
        portfolio = await _projection(request, authenticated, persona)
        grades = [item.grade for item in portfolio.contributions if item.grade]
        candidate = CandidateSummaryView(
            person_id=persona.person_id,
            display_name=persona.display_name,
            accepted_projects=len(portfolio.contributions),
            verified_courses=len(portfolio.courses),
            top_grade=min(grades) if grades else None,
        )
        if search and search.casefold() not in candidate.display_name.casefold():
            continue
        if candidate.accepted_projects < min_projects:
            continue
        if grade and candidate.top_grade != grade:
            continue
        result.append(candidate)
    return result


@router.get("/hr/candidates/{person_id}", response_model=PortfolioView)
async def hr_candidate(
    person_id: UUID,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> PortfolioView:
    _require_role(authenticated, Role.HR)
    auth, *_ = _services(request)
    persona = await auth.store.get_persona_by_id(person_id)
    if persona is None or ConsentScope.HR_PROFILE not in await auth.store.granted_consents(
        person_id
    ):
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    return await _projection(request, authenticated, persona)


def _pipeline_event_view(event: PipelineEvent, names: dict[UUID, str]) -> PipelineEventView:
    return PipelineEventView(
        id=event.id,
        candidate_id=event.candidate_id,
        candidate_name=names.get(event.candidate_id, "Участник"),
        stage=event.stage,
        note=event.note,
        occurred_at=event.occurred_at.isoformat(),
        origin=event.origin,
    )


@router.get("/hr/pipeline", response_model=PipelineView)
async def hr_pipeline(
    request: Request, authenticated: Annotated[AuthenticatedSession, Depends(current_session)]
) -> PipelineView:
    _require_role(authenticated, Role.HR)
    service: TalentService = request.app.state.talent_service
    events = await service.events(authenticated.actor)
    auth, *_ = _services(request)
    personas = {item.person_id: item.display_name for item in await auth.store.list_personas()}
    return PipelineView(
        counts={stage: sum(item.stage is stage for item in events) for stage in PipelineStage},
        events=[_pipeline_event_view(item, personas) for item in events],
    )


@router.post("/hr/candidates/{person_id}/pipeline-events", response_model=PipelineEventView)
async def create_pipeline_event(
    person_id: UUID,
    command: PipelineEventCommand,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
) -> PipelineEventView:
    _require_role(authenticated, Role.HR)
    auth, *_ = _services(request)
    persona = await auth.store.get_persona_by_id(person_id)
    if persona is None or ConsentScope.HR_PROFILE not in await auth.store.granted_consents(
        person_id
    ):
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    service: TalentService = request.app.state.talent_service
    event = await service.record(authenticated.actor, person_id, command.stage, command.note)
    return _pipeline_event_view(event, {person_id: persona.display_name})
