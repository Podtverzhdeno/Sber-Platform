"""Versioned development overview projection (participant-home-trajectory-grades 1.3).

Composes the existing authoritative projections - growth trajectories with
the priority-engine next step, the monthly plan, the versioned weekly rhythm
and active work assignments - into one canonical read contract for the
participant home v2 preview, so the client never merges surfaces by title and
never renders fallback demo data. The career grade block reports the honest
not_evaluable state while the grade catalog policy (gate 0.3) is open.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING

from impulse.api.errors import ApiError
from impulse.application.development import DevelopmentService, TrackRecord
from impulse.application.growth import GrowthService
from impulse.application.identity import Role
from impulse.application.work import WorkItem, WorkService
from impulse.domain.career_grade import CareerGradeSummary, grade_summary
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.engagement import (
    WeeklyRhythm,
    iso_week_bounds,
    weekly_rhythm_projection,
)
from impulse.domain.monthly_goal import MonthlyGoalProjection
from impulse.domain.priority import PolicyResult, StepSpec
from impulse.domain.work import AssignmentStatus, ContributionStatus

if TYPE_CHECKING:
    from impulse.application.competencies import CompetencyService
    from impulse.application.identity import ActorContext

DEVELOPMENT_OVERVIEW_VERSION = 1

ACTIVE_ASSIGNMENT_STATUSES = frozenset(
    {
        AssignmentStatus.STAFFED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.SUBMITTED,
        AssignmentStatus.REVISION_REQUESTED,
        AssignmentStatus.DISPUTED,
    }
)

# Legitimate client pointers derived from the assignment engine state machine.
ASSIGNMENT_NEXT_ACTIONS: dict[AssignmentStatus, str] = {
    AssignmentStatus.STAFFED: "start",
    AssignmentStatus.IN_PROGRESS: "send_work",
    AssignmentStatus.SUBMITTED: "await_review",
    AssignmentStatus.REVISION_REQUESTED: "revise",
    AssignmentStatus.DISPUTED: "dispute_pending",
}

TRACK_STATE_LABELS: dict[TrackStatus | None, str] = {
    TrackStatus.ACTIVE: "active",
    TrackStatus.FROZEN: "paused",
    None: "unselected",
}


@dataclass(frozen=True, slots=True)
class OverviewNextOutcome:
    """Canonical next step resolved by the same priority engine as /me/growth/next-step."""

    policy_version: int
    trajectory_key: str
    trajectory_title: str
    milestone_key: str
    milestone_position: int
    target_kind: str
    target_key: str
    target_title: str
    reasons: tuple[str, ...]
    stale_reason: str | None


@dataclass(frozen=True, slots=True)
class OverviewRoleCard:
    """Server truth per catalog role; unselected roles expose no personal progress."""

    track_key: str
    title: str
    state: str
    attempt_number: int | None
    completed_milestones: int
    total_milestones: int


@dataclass(frozen=True, slots=True)
class OverviewActiveTask:
    assignment_id: str
    task_id: str
    task_key: str
    project_key: str
    title: str
    status: str
    next_action: str
    open_contributions: int


@dataclass(frozen=True, slots=True)
class OverviewDayFocus:
    date: date
    weekday: int
    planned: bool
    done: bool


@dataclass(frozen=True, slots=True)
class OverviewWeekFocus:
    week_start: date
    week_end: date
    versioned: bool
    preset: str | None
    target_days: int
    done_days: int
    hint: str | None
    days: tuple[OverviewDayFocus, ...]


@dataclass(frozen=True, slots=True)
class DevelopmentOverview:
    overview_version: int
    generated_at: datetime
    actor_timezone: str
    local_today: date
    permissions: dict[str, bool]
    career_grade: CareerGradeSummary
    next_outcome: OverviewNextOutcome | None
    weekly_focus: OverviewWeekFocus
    active_tasks: tuple[OverviewActiveTask, ...]
    roles: tuple[OverviewRoleCard, ...]
    monthly_plan: MonthlyGoalProjection | None


def _permission_flags() -> dict[str, bool]:
    """Launch flags owned by the server; prototype-only UI stays off by default."""
    return {"trajectory_switch": True, "grade_request": False, "share": False}


def _week_dates(week_start: date) -> tuple[date, ...]:
    return tuple(week_start + timedelta(days=offset) for offset in range(7))


class DevelopmentOverviewService:
    """Deterministic composition over development, competency and work services."""

    def __init__(
        self,
        development: DevelopmentService,
        competency: CompetencyService,
        work: WorkService,
    ) -> None:
        self._development = development
        self._competency = competency
        self._work = work
        self._growth = GrowthService(development, competency, work)

    def _participant(self, actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN", message="Обзор развития доступен участнику.", status_code=403
            )

    async def overview(
        self,
        actor: ActorContext,
        *,
        local_today: date,
    ) -> DevelopmentOverview:
        """Single read entry point; one as_of, one set of versioned blocks."""
        self._participant(actor)
        generated_at = datetime.now(UTC).replace(microsecond=0)
        goal = await self._development.monthly_goal(actor, local_today=local_today)
        _plans, result = await self._growth.next_step(actor)
        items = await self._work.participant_work(actor)
        store = self._development.store
        achieved = await store.learning_dates(actor.person_id) | await store.engagement_dates(
            actor.person_id
        )
        rhythm_history = await store.weekly_rhythm_history(actor.person_id)
        attempts = await store.attempts(actor.person_id)
        tracks = await store.tracks()
        roles = await self._role_cards(tracks, attempts)
        return DevelopmentOverview(
            overview_version=DEVELOPMENT_OVERVIEW_VERSION,
            generated_at=generated_at,
            actor_timezone=actor.timezone,
            local_today=local_today,
            permissions=_permission_flags(),
            career_grade=grade_summary(),
            next_outcome=_next_outcome(result, tracks),
            weekly_focus=self._weekly_focus(rhythm_history, achieved, local_today=local_today),
            active_tasks=_active_tasks(items),
            roles=roles,
            monthly_plan=goal,
        )

    @staticmethod
    def _weekly_focus(
        rhythm_history: tuple[WeeklyRhythm, ...],
        achieved: frozenset[date],
        *,
        local_today: date,
    ) -> OverviewWeekFocus:
        week_start, week_end = iso_week_bounds(local_today)
        current = next(
            (rhythm for rhythm in reversed(rhythm_history) if rhythm.effective_from <= local_today),
            None,
        )
        days = tuple(
            OverviewDayFocus(
                date=day,
                weekday=day.isoweekday(),
                planned=(
                    current is not None
                    and current.effective_from <= day
                    and day.isoweekday() in current.active_days
                ),
                done=day in achieved,
            )
            for day in _week_dates(week_start)
        )
        if current is None:
            return OverviewWeekFocus(
                week_start=week_start,
                week_end=week_end,
                versioned=False,
                preset=None,
                target_days=0,
                done_days=0,
                hint=None,
                days=days,
            )
        projection = weekly_rhythm_projection(current, achieved, local_today=local_today)
        return OverviewWeekFocus(
            week_start=week_start,
            week_end=week_end,
            versioned=True,
            preset=current.preset,
            target_days=projection.target_days,
            done_days=projection.done_days,
            hint=projection.hint,
            days=days,
        )

    async def _role_cards(
        self,
        tracks: tuple[TrackRecord, ...],
        attempts: tuple[TrackAttempt, ...],
    ) -> tuple[OverviewRoleCard, ...]:
        store = self._development.store
        by_track = {attempt.track_key: attempt for attempt in attempts}
        cards: list[OverviewRoleCard] = []
        for track in tracks:
            attempt = by_track.get(track.key)
            roadmap = await store.roadmap(track.key)
            cards.append(
                OverviewRoleCard(
                    track_key=track.key,
                    title=track.title,
                    state=TRACK_STATE_LABELS[None if attempt is None else attempt.status],
                    attempt_number=None if attempt is None else attempt.attempt_number,
                    completed_milestones=(
                        0 if attempt is None else len(attempt.completed_milestones)
                    ),
                    total_milestones=0 if roadmap is None else len(roadmap.milestones),
                )
            )
        return tuple(cards)


def _next_outcome(
    result: PolicyResult,
    tracks: tuple[TrackRecord, ...],
) -> OverviewNextOutcome | None:
    card = result.next_available()
    if card is None and result.steps:
        card = result.steps[0]
    if card is None:
        return None
    spec: StepSpec = card.spec
    titles = {track.key: track.title for track in tracks}
    return OverviewNextOutcome(
        policy_version=result.policy_version,
        trajectory_key=spec.trajectory_key,
        trajectory_title=titles.get(spec.trajectory_key, spec.trajectory_key),
        milestone_key=spec.milestone_key,
        milestone_position=spec.position,
        target_kind=spec.target_kind,
        target_key=spec.target_key,
        target_title=spec.target_title,
        reasons=tuple(card.reasons),
        stale_reason=card.stale_reason,
    )


def _active_tasks(items: tuple[WorkItem, ...]) -> tuple[OverviewActiveTask, ...]:
    cards: list[OverviewActiveTask] = []
    for item in items:
        assignment = item.assignment
        if assignment.status not in ACTIVE_ASSIGNMENT_STATUSES:
            continue
        open_contributions = sum(
            1
            for contribution in item.contributions
            if contribution.status is not ContributionStatus.ACCEPTED
        )
        cards.append(
            OverviewActiveTask(
                assignment_id=str(assignment.id),
                task_id=str(assignment.task_id),
                task_key=item.task.task_key,
                project_key=item.task.project_key,
                title=item.task.title,
                status=assignment.status.value,
                next_action=ASSIGNMENT_NEXT_ACTIONS[assignment.status],
                open_contributions=open_contributions,
            )
        )
    return tuple(cards)


__all__ = [
    "DEVELOPMENT_OVERVIEW_VERSION",
    "DevelopmentOverview",
    "DevelopmentOverviewService",
    "OverviewActiveTask",
    "OverviewDayFocus",
    "OverviewNextOutcome",
    "OverviewRoleCard",
    "OverviewWeekFocus",
]
