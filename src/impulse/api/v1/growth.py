"""GET /me/growth/snapshot — versioned participant growth projection (openspec 22.11)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel, Field

from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.competencies import CompetencyService
from impulse.application.development import DevelopmentService
from impulse.application.growth import GrowthService
from impulse.application.identity import AuthenticatedSession
from impulse.application.work import WorkService
from impulse.domain.development import local_learning_days
from impulse.domain.monthly_goal import MonthlyGoalProjection
from impulse.domain.passport import SkillGapProjection
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


class SkillGapView(BaseModel):
    """Skill Passport gap projection for the next-result card (openspec 22.2)."""

    policy_version: int
    skill_key: str | None
    title: str
    requested_skill: str
    current_level: str
    target_level: str
    current_known: bool
    counted_sources: list[str]
    missing_evidence: list[str]
    explanation: str
    fallback: str | None


class NextStepView(BaseModel):
    policy_version: int
    steps: list[ScoredStepView]
    next_available: ScoredStepView | None
    skill: SkillGapView | None


class SetMonthlyGoalRequest(BaseModel):
    track_key: str = Field(min_length=1, max_length=96)
    milestone_key: str = Field(min_length=1, max_length=96)


class MonthlyGoalStepView(BaseModel):
    key: str
    position: int
    title: str
    skill: str
    mandatory: bool
    status: str
    ref: str


class MonthlyGoalContoursView(BaseModel):
    baseline: int
    current: int
    projected: int
    target: int


class MonthlyGoalFeasibilityView(BaseModel):
    known: bool
    capacity_days: int
    required_steps: int
    feasible: bool
    deficit: int
    text: str


class MonthlyGoalView(BaseModel):
    policy_version: int
    generated_at: AwareDatetime
    track_key: str
    track_title: str
    goal_title: str
    goal_ref: str
    period_start: str
    period_end: str
    days_left: int
    timezone: str
    plan_version: int
    history_count: int
    steps: list[MonthlyGoalStepView]
    contours: MonthlyGoalContoursView
    remaining: int
    next_checkpoint: str | None
    next_checkpoint_ref: str | None
    feasibility: MonthlyGoalFeasibilityView
    partial_forecast: bool
    coverage: float
    missing_mappings: list[str]
    assumptions: list[str]


def _monthly_goal_view(item: MonthlyGoalProjection) -> MonthlyGoalView:
    target = item.contours.target
    return MonthlyGoalView(
        policy_version=item.policy_version,
        generated_at=item.generated_at,
        track_key=item.track_key,
        track_title=item.track_title,
        goal_title=item.goal_title,
        goal_ref=item.goal_ref,
        period_start=item.period_start.isoformat(),
        period_end=item.period_end.isoformat(),
        days_left=item.days_left,
        timezone=item.timezone,
        plan_version=item.plan_version,
        history_count=item.history_count,
        steps=[
            MonthlyGoalStepView(
                key=step.key,
                position=step.position,
                title=step.title,
                skill=step.skill,
                mandatory=step.mandatory,
                status=step.status,
                ref=step.ref,
            )
            for step in item.steps
        ],
        contours=MonthlyGoalContoursView(
            baseline=item.contours.baseline,
            current=item.contours.current,
            projected=item.contours.projected,
            target=target,
        ),
        remaining=max(target - item.contours.current, 0),
        next_checkpoint=item.next_checkpoint,
        next_checkpoint_ref=item.next_checkpoint_ref,
        feasibility=MonthlyGoalFeasibilityView(
            known=item.feasibility.known,
            capacity_days=item.feasibility.capacity_days,
            required_steps=item.feasibility.required_steps,
            feasible=item.feasibility.feasible,
            deficit=item.feasibility.deficit,
            text=item.feasibility.text,
        ),
        partial_forecast=item.partial_forecast,
        coverage=(target - len(item.missing_mappings)) / target if target else 0.0,
        missing_mappings=list(item.missing_mappings),
        assumptions=list(item.assumptions),
    )


def _skill_gap_view(item: SkillGapProjection) -> SkillGapView:
    return SkillGapView(
        policy_version=item.policy_version,
        skill_key=item.skill_key,
        title=item.title,
        requested_skill=item.requested_skill,
        current_level=item.current_level,
        target_level=item.target_level,
        current_known=item.current_known,
        counted_sources=list(f"{kind}:{ref}" for kind, ref in item.counted_sources),
        missing_evidence=list(f"{kind}:{ref}" for kind, ref in item.missing_evidence),
        explanation=item.explanation,
        fallback=item.fallback,
    )


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


class ActivityStateView(BaseModel):
    """Versioned activity evaluation for one period (openspec 22.4)."""

    version: int
    state: str
    total: int
    target_min: int | None
    target_max: int | None
    missing_category: str | None
    text: str
    action: str | None


class GrowthSnapshotView(BaseModel):
    snapshot_id: str
    generated_at: AwareDatetime
    snapshot_version: int
    actor_timezone: str
    definitions: dict[str, str]
    period_boundaries: dict[str, dict[str, str]]
    activity: dict[str, ActivityBucketView]
    activity_state: dict[str, ActivityStateView]
    events: list[ActivityEventView]
    hours: HoursView
    freshness: FreshnessView
    trajectories: list[TrajectoryGrowthView]


def _activity_states(
    activity: dict[str, ActivityBucketView],
    *,
    has_plan: bool,
) -> dict[str, ActivityStateView]:
    from impulse.domain.growth import ACTIVITY_TARGET_RANGES, activity_state

    states: dict[str, ActivityStateView] = {}
    for period, bucket in sorted(activity.items()):
        target = ACTIVITY_TARGET_RANGES.get(period) if has_plan else None
        result = activity_state(
            bucket.model_dump(),
            target=target,
        )
        states[period] = ActivityStateView(
            version=result.version,
            state=result.state,
            total=result.total,
            target_min=result.target_min,
            target_max=result.target_max,
            missing_category=result.missing_category,
            text=result.text,
            action=result.action,
        )
    return states


def _request_growth_service(request: Request) -> GrowthService:
    development = request.app.state.development_service
    assert isinstance(development, DevelopmentService)
    competency = request.app.state.competency_service
    assert isinstance(competency, CompetencyService)
    work = request.app.state.work_service
    assert isinstance(work, WorkService)
    return GrowthService(development, competency, work)


def _request_development_service(request: Request) -> DevelopmentService:
    service = request.app.state.development_service
    assert isinstance(service, DevelopmentService)
    return service


def _local_today(request: Request, timezone: str) -> date:
    override = getattr(request.app.state, "local_today_override", None)
    if override is not None:
        return override
    return next(iter(local_learning_days((datetime.now(UTC),), timezone)))


@router.get("/me/growth/snapshot", response_model=GrowthSnapshotView)
async def growth_snapshot(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[GrowthService, Depends(_request_growth_service)],
) -> GrowthSnapshotView:
    from impulse.domain.growth import period_boundaries

    snapshot = await service.snapshot(authenticated.actor)
    boundaries = period_boundaries(now=snapshot.generated_at, timezone=snapshot.actor_timezone)
    activity_buckets = {
        name: ActivityBucketView(**counts) for name, counts in sorted(snapshot.activity.items())
    }
    return GrowthSnapshotView(
        snapshot_id=str(snapshot.snapshot_id),
        generated_at=snapshot.generated_at,
        snapshot_version=snapshot.snapshot_version,
        actor_timezone=snapshot.actor_timezone,
        definitions=snapshot.definitions,
        period_boundaries=boundaries,
        activity=activity_buckets,
        activity_state=_activity_states(activity_buckets, has_plan=bool(snapshot.trajectories)),
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
        skill=(
            _skill_gap_view(gap)
            if (gap := await service.skill_passport(authenticated.actor, result, _roadmaps))
            is not None
            else None
        ),
    )


@router.get("/me/growth/monthly-goal", response_model=MonthlyGoalView | None)
async def monthly_goal(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_request_development_service)],
) -> MonthlyGoalView | None:
    local_today = _local_today(request, authenticated.actor.timezone)
    projection = await service.monthly_goal(authenticated.actor, local_today=local_today)
    return _monthly_goal_view(projection) if projection is not None else None


@router.post("/me/growth/monthly-goal", response_model=MonthlyGoalView)
async def set_monthly_goal(
    command: SetMonthlyGoalRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_request_development_service)],
) -> MonthlyGoalView:
    local_today = _local_today(request, authenticated.actor.timezone)
    projection = await service.set_monthly_goal(
        authenticated.actor,
        track_key=command.track_key,
        milestone_key=command.milestone_key,
        local_today=local_today,
    )
    return _monthly_goal_view(projection)


def _share(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(Decimal("0.001")))


__all__ = ["router"]
