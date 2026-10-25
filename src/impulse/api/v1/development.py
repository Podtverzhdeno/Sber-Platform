"""Participant tracks, roadmap, Bootcamp and streak API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.growth import MonthlyGoalView, monthly_goal_view
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.development import DevelopmentService
from impulse.application.development_overview import (
    CareerGradeSummary,
    DevelopmentOverview,
    DevelopmentOverviewService,
)
from impulse.application.identity import AuthenticatedSession
from impulse.domain.development import CompletionStatus, TrackStatus, local_learning_days
from impulse.domain.engagement import EngagementSource
from impulse.domain.identity import ConsentScope

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
    activities: list[str] = Field(default_factory=list)
    deliverable: str | None = None
    theory: list[str] = Field(default_factory=list)
    lab: str | None = None
    acceptance: list[str] = Field(default_factory=list)
    estimated_hours: int | None = Field(default=None, ge=1, le=80)
    resources: list[dict[str, str]] = Field(default_factory=list[dict[str, str]])


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


class CourseCyclePointView(BaseModel):
    competency: str
    current_level: str
    projected_level: str
    target_level: str
    projected_confirmed: bool
    evidence: str


class CourseDetailView(BaseModel):
    course_key: str
    title: str
    source_url: str
    availability: str
    access_note: str
    enrollment_status: str | None
    verified: bool
    specialization: str | None
    program_version: str | None
    workload_hours: int | None
    program_competencies: list[list[str]]
    objective: str | None
    milestone_title: str | None
    next_step: str | None
    artifact: str | None
    cycle: list[CourseCyclePointView]


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


def _effective_local_today(state: object, timezone: str) -> date:
    """Test seam: app.state.local_today_override keeps client influence out of the clock."""
    override = getattr(state, "local_today_override", None)
    if override is not None:
        return override
    return next(iter(local_learning_days((datetime.now(UTC),), timezone)))


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
        activities=list(item.activities),
        deliverable=item.deliverable,
        theory=list(item.theory),
        lab=item.lab,
        acceptance=list(item.acceptance),
        estimated_hours=item.estimated_hours,
        resources=list(item.resources),
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


@router.get("/me/roadmap-catalog", response_model=list[RoadmapView])
async def roadmap_catalog(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> list[RoadmapView]:
    """All role roadmaps; only the authenticated participant's completions appear."""
    result: list[RoadmapView] = []
    for projection in await service.catalog_roadmaps(authenticated.actor):
        result.append(
            RoadmapView(
                track_key=projection.track_key,
                policy_version=projection.policy_version,
                replacement_reason=projection.replacement_reason,
                milestones=[
                    _milestone_view(item, projection.completed_keys)
                    for item in projection.milestones
                ],
                next_step=(
                    _milestone_view(projection.next_step, projection.completed_keys)
                    if projection.next_step is not None
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


@router.get("/me/courses/{course_key}/detail", response_model=CourseDetailView)
async def course_detail(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> CourseDetailView:
    detail = await service.course_detail(authenticated.actor, course_key)
    return CourseDetailView(
        course_key=detail.course_key,
        title=detail.title,
        source_url=detail.source_url,
        availability=detail.availability,
        access_note=detail.access_note,
        enrollment_status=detail.enrollment_status,
        verified=detail.verified,
        specialization=detail.specialization,
        program_version=detail.program_version,
        workload_hours=detail.workload_hours,
        program_competencies=[list(entry) for entry in detail.program_competencies],
        objective=detail.objective,
        milestone_title=detail.milestone_title,
        next_step=detail.next_step,
        artifact=detail.artifact,
        cycle=[
            CourseCyclePointView(
                competency=item.competency,
                current_level=item.current_level,
                projected_level=item.projected_level,
                target_level=item.target_level,
                projected_confirmed=item.projected_confirmed,
                evidence=item.evidence,
            )
            for item in detail.cycle
        ],
    )


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
    request: Request,
) -> StreakView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    return _streak_view(await service.streak(authenticated.actor, local_today=local_today))


class EngagementQualifyRequest(BaseModel):
    source: EngagementSource
    source_ref: str
    occurred_at: AwareDatetime


class EngagementOverviewView(BaseModel):
    current_days: int
    best_days: int
    qualified_dates: list[date]
    reason: str
    today_saved: bool
    grace_available: bool
    frozen_dates: list[date] = []
    freeze_state: str = "idle"


def _engagement_view(result: object) -> EngagementOverviewView:
    from impulse.domain.engagement import (
        EngagementCalendar,
        FrozenEngagementCalendar,
    )

    if not isinstance(result, (EngagementCalendar, FrozenEngagementCalendar)):
        raise TypeError("Expected EngagementCalendar")
    frozen = result if isinstance(result, FrozenEngagementCalendar) else None
    return EngagementOverviewView(
        current_days=result.current_days,
        best_days=result.best_days,
        qualified_dates=sorted(result.qualified_dates),
        reason=result.reason,
        today_saved=result.today_saved,
        grace_available=result.grace_available,
        frozen_dates=sorted(frozen.frozen_dates) if frozen else [],
        freeze_state=frozen.freeze_state if frozen else "idle",
    )


@router.get("/me/engagement/overview", response_model=EngagementOverviewView)
async def engagement_overview(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
    request: Request,
) -> EngagementOverviewView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    return _engagement_view(await service.engagement(authenticated.actor, local_today=local_today))


@router.post("/me/engagement/qualify", response_model=EngagementOverviewView)
async def record_qualification(
    command: EngagementQualifyRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> EngagementOverviewView:
    if not command.source_ref.strip():
        raise ApiError(
            code="VALIDATION_ERROR",
            message="source_ref идентифицирует квалифицируемое действие.",
            status_code=422,
        )
    return _engagement_view(
        await service.record_qualification(
            authenticated.actor,
            command.source,
            command.source_ref.strip(),
            command.occurred_at,
        )
    )


class FreezeSummaryView(BaseModel):
    policy_version: int
    granted_total: int
    available: int
    consumed_total: int


class FreezeExceptionRequest(BaseModel):
    scope: str = Field(min_length=3, max_length=96)
    explanation: str = Field(min_length=4, max_length=400)
    occurred_at: AwareDatetime


@router.get("/me/engagement/freeze", response_model=FreezeSummaryView)
async def freeze_summary(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> FreezeSummaryView:
    summary = await service.freeze_summary(authenticated.actor)
    return FreezeSummaryView(
        policy_version=int(summary["policy_version"]),
        granted_total=int(summary["granted_total"]),
        available=int(summary["available"]),
        consumed_total=int(summary["consumed_total"]),
    )


@router.post("/me/engagement/freeze/use", response_model=EngagementOverviewView)
async def use_freeze_day(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
    request: Request,
) -> EngagementOverviewView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    result = await service.use_freeze_day(authenticated.actor, local_today=local_today)
    return _engagement_view(result)


@router.post("/me/engagement/freeze/service-block")
async def freeze_service_block(
    command: FreezeExceptionRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> dict[str, str]:
    from impulse.domain.development import local_learning_days as to_local_days

    local_date = next(iter(to_local_days((command.occurred_at,), authenticated.actor.timezone)))
    audit = await service.record_freeze_exception(
        authenticated.actor, local_date, command.scope, command.explanation
    )
    return {"audit": audit}


class WeeklyRhythmRequest(BaseModel):
    preset: str
    custom_days: list[int] = Field(default_factory=list[int])
    reminder_hour: int = Field(ge=0, le=23)
    reminder_window_hours: int = Field(ge=1, le=6)
    effective_from: date


class WeeklyRhythmView(BaseModel):
    versioned: bool
    history_count: int
    version: int | None = None
    preset: str | None = None
    active_days: list[int] = []
    reminder_hour: int | None = None
    reminder_window_hours: int | None = None
    effective_from: date | None = None
    week_start: date | None = None
    week_end: date | None = None
    target_days: int | None = None
    done_days: int | None = None
    hint: str | None = None
    scheduled_from: date | None = None
    scheduled_preset: str | None = None


def _rhythm_view(result: dict[str, object]) -> WeeklyRhythmView:
    from impulse.domain.engagement import WeeklyRhythmProjection

    projection = result.get("projection")
    scheduled_from = result.get("scheduled_from")
    scheduled_preset = result.get("scheduled_preset")
    if not isinstance(projection, WeeklyRhythmProjection):
        return WeeklyRhythmView(
            versioned=False,
            history_count=int(str(result["history_count"])),
            scheduled_from=(scheduled_from if isinstance(scheduled_from, date) else None),
            scheduled_preset=(scheduled_preset if isinstance(scheduled_preset, str) else None),
        )
    return WeeklyRhythmView(
        versioned=True,
        history_count=int(str(result["history_count"])),
        version=projection.version,
        preset=projection.preset,
        active_days=sorted(projection.active_days),
        reminder_hour=projection.reminder_hour,
        reminder_window_hours=projection.reminder_window_hours,
        effective_from=projection.effective_from,
        week_start=projection.week_start,
        week_end=projection.week_end,
        target_days=projection.target_days,
        done_days=projection.done_days,
        hint=projection.hint,
        scheduled_from=(scheduled_from if isinstance(scheduled_from, date) else None),
        scheduled_preset=(scheduled_preset if isinstance(scheduled_preset, str) else None),
    )


@router.get("/me/engagement/rhythm", response_model=WeeklyRhythmView)
async def weekly_rhythm_overview(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
    request: Request,
) -> WeeklyRhythmView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    return _rhythm_view(
        await service.weekly_rhythm_overview(authenticated.actor, local_today=local_today)
    )


@router.post("/me/engagement/rhythm", response_model=WeeklyRhythmView)
async def save_weekly_rhythm(
    command: WeeklyRhythmRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
    request: Request,
) -> WeeklyRhythmView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    saved = await service.save_weekly_rhythm(
        authenticated.actor,
        preset=command.preset,
        custom_days=tuple(command.custom_days),
        reminder_hour=command.reminder_hour,
        reminder_window_hours=command.reminder_window_hours,
        effective_from=command.effective_from,
        local_today=local_today,
    )
    overview = await service.weekly_rhythm_snapshot(
        authenticated.actor, saved, local_today=local_today
    )
    return _rhythm_view(overview)


class CertificateCompetencyView(BaseModel):
    competency: str
    level: str
    evidence: str


class CourseCertificateView(BaseModel):
    certificate_id: str
    verification_id: str
    holder_name: str
    course_key: str
    course_title: str
    specialization: str
    program_version: str
    period: str
    workload_hours: int
    result: str
    competencies: list[CertificateCompetencyView]
    issued_at: AwareDatetime
    preview_marking: str


def _certificate_view(item: object) -> CourseCertificateView:
    from impulse.application.development import CourseCertificate

    if not isinstance(item, CourseCertificate):
        raise TypeError("Expected CourseCertificate")
    return CourseCertificateView(
        certificate_id=str(item.certificate_id),
        verification_id=item.verification_id,
        holder_name=item.holder_name,
        course_key=item.course_key,
        course_title=item.course_title,
        specialization=item.specialization,
        program_version=item.program_version,
        period=item.period,
        workload_hours=item.workload_hours,
        result=item.result,
        competencies=[
            CertificateCompetencyView(
                competency=entry.competency,
                level=entry.level,
                evidence=entry.evidence,
            )
            for entry in item.competencies
        ],
        issued_at=item.issued_at,
        preview_marking=item.preview_marking(),
    )


@router.get("/me/bootcamp/certificates", response_model=list[CourseCertificateView])
async def my_certificates(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> list[CourseCertificateView]:
    certificates = await service.course_certificates(authenticated.actor)
    return [_certificate_view(item) for item in certificates]


@router.post("/me/bootcamp/certificates/{course_key}", response_model=CourseCertificateView)
async def issue_certificate(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[DevelopmentService, Depends(_service)],
) -> CourseCertificateView:
    certificate = await service.issue_course_certificate(
        authenticated.actor,
        course_key,
        holder_name=authenticated.actor.display_name,
    )
    return _certificate_view(certificate)


@router.get("/bootcamp/certificates/{verification_id}", response_model=CourseCertificateView)
async def verify_certificate(
    verification_id: str,
    request: Request,
    service: Annotated[DevelopmentService, Depends(_service)],
) -> CourseCertificateView:
    certificate = await service.verify_course_certificate(verification_id)
    if certificate is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    consents = await request.app.state.auth_service.store.granted_consents(certificate.person_id)
    if ConsentScope.PUBLIC_PROFILE not in consents:
        raise ApiError(
            code="RESOURCE_NOT_FOUND",
            message="Resource not found.",
            status_code=404,
        )
    return _certificate_view(certificate)


class OverviewConceptView(BaseModel):
    universe_version: str
    canonical_surface: str
    independent: bool = True
    value_state: str


class CareerGradeSummaryView(BaseModel):
    policy_version: int
    state: str
    reason: str | None
    hint: str | None
    catalog_version: int | None
    current_grade: str | None
    target_grade: str | None
    readiness_percent: float | None
    auto_transition: bool


class OverviewConceptsView(BaseModel):
    career_grade: CareerGradeSummaryView
    competency_level: OverviewConceptView
    stage_progress: OverviewConceptView
    readiness_percent: OverviewConceptView
    rating_xp: OverviewConceptView
    review_grade: OverviewConceptView


class NextOutcomeView(BaseModel):
    policy_version: int
    trajectory_key: str
    trajectory_title: str
    milestone_key: str
    milestone_position: int
    target_kind: str
    target_key: str
    target_title: str
    reasons: list[str]
    stale_reason: str | None


class RoleCardView(BaseModel):
    track_key: str
    title: str
    state: str
    attempt_number: int | None
    completed_milestones: int
    total_milestones: int


class ActiveTaskView(BaseModel):
    assignment_id: str
    task_id: str
    task_key: str
    project_key: str
    title: str
    status: str
    next_action: str
    open_contributions: int


class DayFocusView(BaseModel):
    date: str
    weekday: int
    planned: bool
    done: bool


class WeekFocusView(BaseModel):
    week_start: str
    week_end: str
    versioned: bool
    preset: str | None
    target_days: int
    done_days: int
    hint: str | None
    days: list[DayFocusView]


class DevelopmentOverviewView(BaseModel):
    overview_version: int
    as_of: AwareDatetime
    actor_timezone: str
    local_today: str
    permissions: dict[str, bool]
    concepts: OverviewConceptsView
    next_outcome: NextOutcomeView | None
    weekly_focus: WeekFocusView
    active_tasks: list[ActiveTaskView]
    roles: list[RoleCardView]
    monthly_plan: MonthlyGoalView | None


def _request_overview_service(request: Request) -> DevelopmentOverviewService:
    service = request.app.state.development_overview_service
    assert isinstance(service, DevelopmentOverviewService)
    return service


def _career_grade_view(summary: CareerGradeSummary) -> CareerGradeSummaryView:
    return CareerGradeSummaryView(
        policy_version=summary.policy_version,
        state=summary.state,
        reason=summary.reason,
        hint=summary.hint,
        catalog_version=summary.catalog_version,
        current_grade=summary.current_grade,
        target_grade=summary.target_grade,
        readiness_percent=summary.readiness_percent,
        auto_transition=summary.auto_transition,
    )


def _concept_surface(name: str) -> OverviewConceptView:
    definitions: dict[str, tuple[str, str]] = {
        "competency_level": ("competencies-framework-v1", "skill-passport"),
        "stage_progress": ("growth-milestones-v1", "trajectory-roadmap"),
        "readiness_percent": ("growth-readiness-v1", "trajectory-roadmap"),
        "rating_xp": ("reward-ledger-v1", "wallet-recognition"),
        "review_grade": ("reward-acceptance-v1", "work-acceptance"),
    }
    universe, surface = definitions[name]
    return OverviewConceptView(
        universe_version=universe,
        canonical_surface=surface,
        independent=True,
        value_state="separate_surface",
    )


def _overview_view(item: DevelopmentOverview) -> DevelopmentOverviewView:
    block = item.weekly_focus
    next_outcome = item.next_outcome
    return DevelopmentOverviewView(
        overview_version=item.overview_version,
        as_of=item.generated_at,
        actor_timezone=item.actor_timezone,
        local_today=item.local_today.isoformat(),
        permissions=dict(item.permissions),
        concepts=OverviewConceptsView(
            career_grade=_career_grade_view(item.career_grade),
            competency_level=_concept_surface("competency_level"),
            stage_progress=_concept_surface("stage_progress"),
            readiness_percent=_concept_surface("readiness_percent"),
            rating_xp=_concept_surface("rating_xp"),
            review_grade=_concept_surface("review_grade"),
        ),
        next_outcome=(
            None
            if next_outcome is None
            else NextOutcomeView(
                policy_version=next_outcome.policy_version,
                trajectory_key=next_outcome.trajectory_key,
                trajectory_title=next_outcome.trajectory_title,
                milestone_key=next_outcome.milestone_key,
                milestone_position=next_outcome.milestone_position,
                target_kind=next_outcome.target_kind,
                target_key=next_outcome.target_key,
                target_title=next_outcome.target_title,
                reasons=list(next_outcome.reasons),
                stale_reason=next_outcome.stale_reason,
            )
        ),
        weekly_focus=WeekFocusView(
            week_start=block.week_start.isoformat(),
            week_end=block.week_end.isoformat(),
            versioned=block.versioned,
            preset=block.preset,
            target_days=block.target_days,
            done_days=block.done_days,
            hint=block.hint,
            days=[
                DayFocusView(
                    date=day.date.isoformat(),
                    weekday=day.weekday,
                    planned=day.planned,
                    done=day.done,
                )
                for day in block.days
            ],
        ),
        active_tasks=[
            ActiveTaskView(
                assignment_id=task.assignment_id,
                task_id=task.task_id,
                task_key=task.task_key,
                project_key=task.project_key,
                title=task.title,
                status=task.status,
                next_action=task.next_action,
                open_contributions=task.open_contributions,
            )
            for task in item.active_tasks
        ],
        roles=[
            RoleCardView(
                track_key=role.track_key,
                title=role.title,
                state=role.state,
                attempt_number=role.attempt_number,
                completed_milestones=role.completed_milestones,
                total_milestones=role.total_milestones,
            )
            for role in item.roles
        ],
        monthly_plan=(None if item.monthly_plan is None else monthly_goal_view(item.monthly_plan)),
    )


@router.get("/participant/me/development-overview", response_model=DevelopmentOverviewView)
async def development_overview(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[DevelopmentOverviewService, Depends(_request_overview_service)],
) -> DevelopmentOverviewView:
    local_today = _effective_local_today(request.app.state, authenticated.actor.timezone)
    overview = await service.overview(authenticated.actor, local_today=local_today)
    return _overview_view(overview)
