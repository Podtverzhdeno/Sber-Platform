"""Participant tracks, roadmap, Bootcamp and streak API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.development import DevelopmentService
from impulse.application.identity import AuthenticatedSession
from impulse.domain.development import CompletionStatus, TrackStatus, local_learning_days

router = APIRouter()


class TrackView(BaseModel):
    key: str
    title: str
    status: TrackStatus | None
    completed_milestones: list[str]


class TrackOverview(BaseModel):
    active_count: int
    max_active: int = 2
    tracks: list[TrackView]


class SelectTrackRequest(BaseModel):
    track_key: str = Field(min_length=1, max_length=96)
    freeze_track_key: str | None = Field(default=None, min_length=1, max_length=96)


class MilestoneView(BaseModel):
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str
    completed: bool


class RoadmapView(BaseModel):
    track_key: str
    policy_version: int
    replacement_reason: str | None
    milestones: list[MilestoneView]
    next_step: MilestoneView | None


class CourseView(BaseModel):
    key: str
    title: str
    track_keys: list[str]
    recommendation_reason: str
    source_url: str
    availability: str
    access_note: str
    completion_status: str | None
    rating_eligible: bool


class CompletionView(BaseModel):
    course_key: str
    status: CompletionStatus
    rating_eligible: bool
    explanation: str


class LearningDayRequest(BaseModel):
    occurred_at: AwareDatetime


class StreakView(BaseModel):
    current_days: int
    qualified_dates: list[date]
    reason: str


def _service(request: Request) -> DevelopmentService:
    return request.app.state.development_service


async def _overview(
    service: DevelopmentService, authenticated: AuthenticatedSession
) -> TrackOverview:
    catalog, attempts = await service.track_overview(authenticated.actor)
    attempts_by_key = {item.track_key: item for item in attempts}
    return TrackOverview(
        active_count=sum(item.status is TrackStatus.ACTIVE for item in attempts),
        tracks=[
            TrackView(
                key=item.key,
                title=item.title,
                status=(attempts_by_key[item.key].status if item.key in attempts_by_key else None),
                completed_milestones=(
                    sorted(attempts_by_key[item.key].completed_milestones)
                    if item.key in attempts_by_key
                    else []
                ),
            )
            for item in catalog
        ],
    )


@router.get("/development/tracks", response_model=TrackOverview)
async def tracks(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> TrackOverview:
    return await _overview(service, authenticated)


@router.post("/me/tracks", response_model=TrackOverview)
async def select_track(
    command: SelectTrackRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> TrackOverview:
    await service.choose_track(authenticated.actor, command.track_key, command.freeze_track_key)
    return await _overview(service, authenticated)


def _milestone_view(item: object, completed_keys: frozenset[str]) -> MilestoneView:
    from impulse.domain.development import RoadmapMilestone

    if not isinstance(item, RoadmapMilestone):
        raise TypeError("Expected RoadmapMilestone")
    return MilestoneView(
        key=item.key,
        position=item.position,
        title=item.title,
        purpose=item.purpose,
        skill=item.skill,
        target_kind=item.target_kind,
        target_key=item.target_key,
        completed=item.key in completed_keys,
    )


@router.get("/me/roadmaps", response_model=list[RoadmapView])
async def roadmaps(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> list[RoadmapView]:
    result: list[RoadmapView] = []
    for projection in await service.roadmaps(authenticated.actor):
        milestones = [
            _milestone_view(item, projection.completed_keys) for item in projection.milestones
        ]
        next_step = projection.next_step
        result.append(
            RoadmapView(
                track_key=projection.track_key,
                policy_version=projection.policy_version,
                replacement_reason=projection.replacement_reason,
                milestones=milestones,
                next_step=(
                    _milestone_view(next_step, projection.completed_keys)
                    if next_step is not None
                    else None
                ),
            )
        )
    return result


@router.get("/development/courses", response_model=list[CourseView])
async def courses(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> list[CourseView]:
    enrollments = {
        item.course_key: item
        for item in await service.store.enrollments(authenticated.actor.person_id)
    }
    result: list[CourseView] = []
    for course, reason in await service.course_catalog(authenticated.actor):
        enrollment = enrollments.get(course.key)
        result.append(
            CourseView(
                key=course.key,
                title=course.title,
                track_keys=list(course.track_keys),
                recommendation_reason=reason,
                source_url=course.source_url,
                availability=course.availability,
                access_note=course.access_note,
                completion_status=(enrollment.status.value if enrollment else None),
                rating_eligible=(
                    service.enrollment_rating_eligible(enrollment) if enrollment else False
                ),
            )
        )
    return result


@router.post("/me/courses/{course_key}/completion", response_model=CompletionView)
async def report_completion(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> CompletionView:
    enrollment = await service.report_completion(authenticated.actor, course_key)
    return CompletionView(
        course_key=course_key,
        status=enrollment.status,
        rating_eligible=False,
        explanation="Завершение заявлено и ожидает проверки; рейтинговые баллы не начислены.",
    )


def _streak_view(result: object) -> StreakView:
    from impulse.domain.development import StreakResult

    if not isinstance(result, StreakResult):
        raise TypeError("Expected StreakResult")
    return StreakView(
        current_days=result.current_days,
        qualified_dates=sorted(result.qualified_dates),
        reason=result.reason,
    )


@router.post("/me/courses/{course_key}/learning-days", response_model=StreakView)
async def record_learning_day(
    course_key: str,
    command: LearningDayRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> StreakView:
    result = await service.record_learning(authenticated.actor, course_key, command.occurred_at)
    return _streak_view(result)


@router.get("/me/learning/streak", response_model=StreakView)
async def streak(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> StreakView:
    local_today = next(
        iter(local_learning_days((datetime.now(UTC),), authenticated.actor.timezone))
    )
    return _streak_view(await service.streak(authenticated.actor, local_today=local_today))
