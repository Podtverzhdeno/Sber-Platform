"""Evidence-first participant portfolio and consented HR search."""

from __future__ import annotations

import asyncio
from dataclasses import replace
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.concurrency import compose_reads
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


async def _recognition_evidence(
    request: Request,
    authenticated: AuthenticatedSession,
    persona: PersonaRecord,
    consents: frozenset[ConsentScope],
) -> tuple[list[PortfolioCredentialView], list[PortfolioTrophyView], list[dict[str, str]]]:
    """Only issued records and approved public proofs, never candidate XP.

    The owner may see their own issued credentials (including revoked records).
    HR sees credentials only with explicit profile + trophies permission and
    an enabled achievements visibility setting. Public trophy/offer evidence is
    filtered by the same recognition leaderboard policy as the rating page.
    """
    auth = request.app.state.auth_service
    own = (
        authenticated.actor.active_role is Role.PARTICIPANT
        and authenticated.actor.person_id == persona.person_id
    )
    authorized_hr = False
    if authenticated.actor.active_role is Role.HR and ConsentScope.HR_PROFILE in consents:
        settings = await auth.store.hr_visibility(persona.person_id)
        authorized_hr = (
            settings.get("hr_achievements", False)
            and ConsentScope.PUBLIC_TROPHIES in consents
        )
    recognition = request.app.state.recognition_service
    if not (own or authorized_hr):
        return [], [], []

    credential_records, seasons = await asyncio.gather(
        recognition.store.person_credentials(persona.person_id),
        recognition.public_seasons(),
    )
    credentials = [
        PortfolioCredentialView(
            verification_id=credential.verification_id,
            title=credential.title,
            status=credential.status.value,
        )
        for credential in credential_records
    ]

    # The leaderboard applies public_rating/public_trophies/public_profile
    # consent and filters revoked source evidence in its backing store.
    leaderboards = await asyncio.gather(
        *(recognition.leaderboard(season.season_id) for season in seasons)
    )
    trophies: list[PortfolioTrophyView] = []
    offers: list[dict[str, str]] = []
    trophy_sources: set[tuple[str, str, str]] = set()
    offer_sources: set[tuple[str, str]] = set()
    for entries in leaderboards:
        for entry in entries:
            if entry.anonymized or entry.person_id != persona.person_id:
                continue
            for proof in entry.trophies:
                source = (proof.title, proof.trophy_type, proof.source_url)
                if source in trophy_sources:
                    continue
                trophy_sources.add(source)
                trophies.append(
                    PortfolioTrophyView(
                        title=proof.title,
                        organizer="Не указан",
                        source_url=proof.source_url,
                        trophy_type=proof.trophy_type,
                    )
                )
            for proof in entry.offers:
                source = (proof.event_title, proof.source_url)
                if source in offer_sources:
                    continue
                offer_sources.add(source)
                offers.append({"title": proof.event_title, "basis": proof.basis})
    return credentials, trophies, offers


async def _projection(
    request: Request, authenticated: AuthenticatedSession, persona: PersonaRecord
) -> PortfolioView:
    auth, work, reward, development = _services(request)
    actor = _participant_actor(persona, authenticated)
    work_items, reward_items, course_records, enrollments, consents = await asyncio.gather(
        work.participant_work(actor),
        reward.participant_reward_evidence(actor),
        development.store.courses(),
        development.store.enrollments(persona.person_id),
        auth.store.granted_consents(persona.person_id),
    )
    public_statuses = {ReviewStatus.PUBLISHED, ReviewStatus.CORRECTED, ReviewStatus.UPHELD}
    reviews = {
        item.review.contribution_id: item.review
        for item in reward_items
        if item.review.status in public_statuses
    }
    course_titles = {item.key: item.title for item in course_records}
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
    courses = [
        PortfolioCourseView(
            key=item.course_key,
            title=course_titles[item.course_key],
            status=item.status.value,
        )
        for item in enrollments
        if item.status is CompletionStatus.VERIFIED and item.course_key in course_titles
    ]
    credentials, trophies, offers = await _recognition_evidence(
        request, authenticated, persona, consents
    )
    return PortfolioView(
        person_id=persona.person_id,
        display_name=persona.display_name,
        contributions=contributions,
        courses=courses,
        credentials=credentials,
        trophies=trophies,
        offers=offers,
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
    participants = [
        persona for persona in await auth.store.list_personas() if Role.PARTICIPANT in persona.roles
    ]
    consents = await compose_reads(
        participants, lambda persona: auth.store.granted_consents(persona.person_id)
    )
    eligible = [
        persona
        for persona, persona_consents in zip(participants, consents, strict=True)
        if ConsentScope.HR_PROFILE in persona_consents
    ]
    portfolios: tuple[PortfolioView, ...] = ()
    if eligible:
        portfolios = await compose_reads(
            eligible, lambda persona: _projection(request, authenticated, persona)
        )
    result: list[CandidateSummaryView] = []
    for persona, portfolio in zip(eligible, portfolios, strict=True):
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
