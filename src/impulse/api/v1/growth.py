"""GET /me/growth/snapshot — versioned participant growth projection (openspec 22.11)."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel

from impulse.api.v1.identity import current_session
from impulse.application.competencies import CompetencyService
from impulse.application.development import DevelopmentService
from impulse.application.growth import GrowthService
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import WorkService
from impulse.domain.priority import ScoredStep

router = APIRouter()

TARGET_LEVEL_LABEL = "уверенный"


class WeightedProgressView(BaseModel):
    percent: float | None
    coverage: float
    partial: bool


class SkillPositionView(BaseModel):
    skill_key: str
    title: str
    current_level: str
    target_level: str
    known: bool


class MilestoneView(BaseModel):
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str
    target_title: str
    status: str
    known: bool


class TrajectoryGrowthView(BaseModel):
    track_key: str
    track_title: str
    policy_version: int
    milestones: list[MilestoneView]
    completion: WeightedProgressView
    readiness_skills: list[SkillPositionView]
    readiness: WeightedProgressView
    object_refs: list[str]
    next_step_ref: str | None


class ActivityEventView(BaseModel):
    kind: str
    title: str
    occurred_at: AwareDatetime
    source_kind: str
    source_ref: str


class TrustedIntervalView(BaseModel):
    start: AwareDatetime
    end: AwareDatetime
    source_kind: str
    source_ref: str


class HoursView(BaseModel):
    known: bool
    trusted_minutes: int | None
    self_reported_minutes: int | None
    intervals: list[TrustedIntervalView]


class FreshnessView(BaseModel):
    known: bool
    latest_observed_at: AwareDatetime | None


class ScoredStepView(BaseModel):
    trajectory_key: str
    milestone_key: str
    target_kind: str
    target_key: str
    target_title: str
    position: int
    score: float
    factors: list[str]
    reasons: list[str]
    available: bool
    stale_reason: str | None


class NextStepView(BaseModel):
    policy_version: int
    steps: list[ScoredStepView]
    next_available: ScoredStepView | None


def _step_view(item: ScoredStep) -> ScoredStepView:
    spec = item.spec
    return ScoredStepView(
        trajectory_key=spec.trajectory_key,
        milestone_key=spec.milestone_key,
        target_kind=spec.target_kind,
        target_key=spec.target_key,
        target_title=spec.target_title,
        position=spec.position,
        score=float(item.score),
        factors=list(item.factors),
        reasons=list(item.reasons),
        available=item.available,
        stale_reason=item.stale_reason,
    )


class ActivityBucketView(BaseModel):
    total: int
    course_checkpoint: int
    project_submission: int
    revision_accepted: int
    event_participation: int


class GrowthSnapshotView(BaseModel):
    snapshot_id: str
    generated_at: AwareDatetime
    snapshot_version: int
    actor_timezone: str
    definitions: dict[str, str]
    period_boundaries: dict[str, dict[str, str]]
    activity: dict[str, ActivityBucketView]
    events: list[ActivityEventView]
    hours: HoursView
    freshness: FreshnessView
    trajectories: list[TrajectoryGrowthView]


def _request_growth_service(request: Request) -> GrowthService:
    development = request.app.state.development_service
    assert isinstance(development, DevelopmentService)
    competency = request.app.state.competency_service
    assert isinstance(competency, CompetencyService)
    work = request.app.state.work_service
    assert isinstance(work, WorkService)
    return GrowthService(development, competency, work)


@router.get("/me/growth/snapshot", response_model=GrowthSnapshotView)
async def growth_snapshot(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[GrowthService, Depends(_request_growth_service)],
) -> GrowthSnapshotView:
    from impulse.domain.growth import period_boundaries

    snapshot = await service.snapshot(authenticated.actor)
    boundaries = period_boundaries(now=snapshot.generated_at, timezone=snapshot.actor_timezone)
    return GrowthSnapshotView(
        snapshot_id=str(snapshot.snapshot_id),
        generated_at=snapshot.generated_at,
        snapshot_version=snapshot.snapshot_version,
        actor_timezone=snapshot.actor_timezone,
        definitions=snapshot.definitions,
        period_boundaries=boundaries,
        activity={
            name: ActivityBucketView(**counts)
            for name, counts in sorted(snapshot.activity.items())
        },
        events=[
            ActivityEventView(
                kind=event.kind,
                title=event.title,
                occurred_at=event.occurred_at,
                source_kind=event.source_kind,
                source_ref=event.source_ref,
            )
            for event in snapshot.events
        ],
        hours=HoursView(
            known=snapshot.hours.known,
            trusted_minutes=snapshot.hours.trusted_minutes,
            self_reported_minutes=snapshot.hours.self_reported_minutes,
            intervals=[
                TrustedIntervalView(
                    start=item.start,
                    end=item.end,
                    source_kind=item.source_kind,
                    source_ref=item.source_ref,
                )
                for item in snapshot.hours.intervals
            ],
        ),
        freshness=FreshnessView(
            known=snapshot.freshness.known,
            latest_observed_at=snapshot.freshness.latest_observed_at,
        ),
        trajectories=[
            TrajectoryGrowthView(
                track_key=trajectory.track_key,
                track_title=trajectory.track_title,
                policy_version=trajectory.policy_version,
                milestones=[
                    MilestoneView(
                        key=item.key,
                        position=item.position,
                        title=item.title,
                        purpose=item.purpose,
                        skill=item.skill,
                        target_kind=item.target_kind,
                        target_key=item.target_key,
                        target_title=item.target_title,
                        status=item.status,
                        known=item.known,
                    )
                    for item in trajectory.milestones
                ],
                completion=WeightedProgressView(
                    percent=_share(trajectory.completion.percent),
                    coverage=_share(trajectory.completion.coverage) or 0.0,
                    partial=trajectory.completion.partial,
                ),
                readiness_skills=[
                    SkillPositionView(
                        skill_key=point.skill_key,
                        title=point.title,
                        current_level=point.current_level,
                        target_level=_target_level_label(),
                        known=point.known,
                    )
                    for point in trajectory.readiness_skills
                ],
                readiness=WeightedProgressView(
                    percent=_share(trajectory.readiness.percent),
                    coverage=_share(trajectory.readiness.coverage) or 0.0,
                    partial=trajectory.readiness.partial,
                ),
                object_refs=list(trajectory.object_refs),
                next_step_ref=trajectory.next_step_ref,
            )
            for trajectory in snapshot.trajectories
        ],
    )


def _target_level_label() -> str:
    return TARGET_LEVEL_LABEL


@router.get("/me/growth/next-step", response_model=NextStepView)
async def growth_next_step(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[GrowthService, Depends(_request_growth_service)],
) -> NextStepView:
    _roadmaps, result = await service.next_step(authenticated.actor)
    return NextStepView(
        policy_version=result.policy_version,
        steps=[_step_view(item) for item in result.steps],
        next_available=(
            _step_view(best) if (best := result.next_available()) is not None else None
        ),
    )


def _share(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(Decimal("0.001")))


__all__ = ["router"]
