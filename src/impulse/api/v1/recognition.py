"""Operator API for versioned rating seasons and policies."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import csrf_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.recognition import RecognitionService
from impulse.domain.recognition import (
    CohortRule,
    DiplomaThreshold,
    RatingPolicy,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    SeasonStatus,
    Standing,
    TieBreaker,
)

router = APIRouter()


def _service(request: Request) -> RecognitionService:
    return request.app.state.recognition_service


class CreateSeasonRequest(BaseModel):
    key: str = Field(min_length=1, max_length=96)
    title: str = Field(min_length=1, max_length=200)


class CohortRuleModel(BaseModel):
    key: str = Field(min_length=1, max_length=96)
    title: str = Field(min_length=1, max_length=200)
    program_key: str = Field(min_length=1, max_length=96)
    track_keys: list[str] = Field(min_length=1, max_length=20)
    minimum_size: int = Field(ge=2)


class ScoreSourceRuleModel(BaseModel):
    rule_id: str = Field(min_length=1, max_length=96)
    source_type: str = Field(min_length=1, max_length=64)
    weight: Decimal = Field(gt=0)
    cap: Decimal = Field(gt=0)


class DiplomaThresholdModel(BaseModel):
    level: str = Field(min_length=1, max_length=64)
    place_from: int = Field(ge=1)
    place_to: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)


class PublishPolicyRequest(BaseModel):
    expected_season_version: int = Field(ge=1)
    cohort: CohortRuleModel
    sources: list[ScoreSourceRuleModel] = Field(min_length=1, max_length=30)
    tie_breakers: list[TieBreaker] = Field(min_length=1, max_length=4)
    diploma_thresholds: list[DiplomaThresholdModel] = Field(min_length=1, max_length=20)
    appeal_period_days: int = Field(ge=1, le=365)


class OpenSeasonRequest(BaseModel):
    expected_version: int = Field(ge=1)


class AppendScoreRequest(BaseModel):
    person_id: UUID
    source_type: str = Field(min_length=1, max_length=64)
    source_id: UUID
    rule_id: str = Field(min_length=1, max_length=96)
    points: Decimal = Field(gt=0)
    occurred_at: datetime


class CorrectScoreRequest(BaseModel):
    points_delta: Decimal
    reason: str = Field(min_length=1, max_length=2000)
    occurred_at: datetime


class SeasonView(BaseModel):
    id: UUID
    key: str
    title: str
    status: SeasonStatus
    version: int
    policy_version: int | None


class RatingPolicyView(BaseModel):
    id: UUID
    season_id: UUID
    version: int
    cohort: CohortRuleModel
    sources: list[ScoreSourceRuleModel]
    tie_breakers: list[TieBreaker]
    diploma_thresholds: list[DiplomaThresholdModel]
    appeal_period_days: int


class ScoreEntryView(BaseModel):
    id: UUID
    season_id: UUID
    person_id: UUID
    source_type: str
    source_id: UUID
    rule_id: str
    points: Decimal
    occurred_at: datetime
    correction_of: UUID | None
    correction_reason: str | None


class StandingView(BaseModel):
    season_id: UUID
    person_id: UUID
    place: int
    score: Decimal
    successful_projects: int
    highest_project_score: Decimal
    earliest_achievement: datetime | None


def _season_view(season: RatingSeason) -> SeasonView:
    return SeasonView(
        id=season.season_id,
        key=season.key,
        title=season.title,
        status=season.status,
        version=season.version,
        policy_version=season.policy_version,
    )


def _policy_view(policy: RatingPolicy) -> RatingPolicyView:
    return RatingPolicyView(
        id=policy.policy_id,
        season_id=policy.season_id,
        version=policy.version,
        cohort=CohortRuleModel(
            key=policy.cohort.key,
            title=policy.cohort.title,
            program_key=policy.cohort.program_key,
            track_keys=list(policy.cohort.track_keys),
            minimum_size=policy.cohort.minimum_size,
        ),
        sources=[
            ScoreSourceRuleModel(
                rule_id=item.rule_id,
                source_type=item.source_type,
                weight=item.weight,
                cap=item.cap,
            )
            for item in policy.sources
        ],
        tie_breakers=list(policy.tie_breakers),
        diploma_thresholds=[
            DiplomaThresholdModel(
                level=item.level,
                place_from=item.place_from,
                place_to=item.place_to,
                title=item.title,
            )
            for item in policy.diploma_thresholds
        ],
        appeal_period_days=policy.appeal_period_days,
    )


def _score_view(entry: ScoreEntry) -> ScoreEntryView:
    return ScoreEntryView(
        id=entry.entry_id,
        season_id=entry.season_id,
        person_id=entry.person_id,
        source_type=entry.source_type,
        source_id=entry.source_id,
        rule_id=entry.rule_id,
        points=entry.points,
        occurred_at=entry.occurred_at,
        correction_of=entry.correction_of,
        correction_reason=entry.correction_reason,
    )


def _standing_view(row: Standing) -> StandingView:
    return StandingView(**{field: getattr(row, field) for field in StandingView.model_fields})


@router.post("/operations/rating-seasons", response_model=SeasonView)
async def create_season(
    command: CreateSeasonRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> SeasonView:
    return _season_view(
        await service.create_season(authenticated.actor, key=command.key, title=command.title)
    )


@router.post(
    "/operations/rating-seasons/{season_id}/policies",
    response_model=RatingPolicyView,
)
async def publish_policy(
    season_id: UUID,
    command: PublishPolicyRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> RatingPolicyView:
    policy = await service.publish_policy(
        authenticated.actor,
        season_id,
        expected_season_version=command.expected_season_version,
        cohort=CohortRule(**command.cohort.model_dump()),
        sources=tuple(ScoreSourceRule(**item.model_dump()) for item in command.sources),
        tie_breakers=tuple(command.tie_breakers),
        thresholds=tuple(
            DiplomaThreshold(**item.model_dump()) for item in command.diploma_thresholds
        ),
        appeal_period_days=command.appeal_period_days,
    )
    return _policy_view(policy)


@router.post("/operations/rating-seasons/{season_id}/open", response_model=SeasonView)
async def open_season(
    season_id: UUID,
    command: OpenSeasonRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> SeasonView:
    return _season_view(
        await service.open_season(
            authenticated.actor, season_id, expected_version=command.expected_version
        )
    )


@router.post("/operations/rating-seasons/{season_id}/scores", response_model=ScoreEntryView)
async def append_score(
    season_id: UUID,
    command: AppendScoreRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> ScoreEntryView:
    return _score_view(
        await service.append_score(
            authenticated.actor,
            season_id,
            person_id=command.person_id,
            source_type=command.source_type,
            source_id=command.source_id,
            rule_id=command.rule_id,
            points=command.points,
            occurred_at=command.occurred_at,
        )
    )


@router.post("/operations/score-entries/{entry_id}/corrections", response_model=ScoreEntryView)
async def correct_score(
    entry_id: UUID,
    command: CorrectScoreRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> ScoreEntryView:
    return _score_view(
        await service.correct_score(
            authenticated.actor,
            entry_id,
            points_delta=command.points_delta,
            reason=command.reason,
            occurred_at=command.occurred_at,
        )
    )


@router.post(
    "/operations/rating-seasons/{season_id}/standings/rebuild",
    response_model=list[StandingView],
)
async def rebuild_standings_projection(
    season_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[RecognitionService, Depends(_service)],
) -> list[StandingView]:
    return [_standing_view(item) for item in await service.rebuild(authenticated.actor, season_id)]
