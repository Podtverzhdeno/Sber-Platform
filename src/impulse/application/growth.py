"""Versioned participant growth snapshot (openspec 22.11).

Проекция собирается только из подтверждённых доменных записей: активные
траектории с помеченными завершениями (development), Skills Passport
(competency framework), выбранные и принятые вклады (work). Формулы
версионируются константами из impulse.domain.growth; процент считается
только по полностью известным обязательным позициям, иначе итог остаётся
partial с coverage вместо округления к нулю.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid5

from impulse.application.competencies import CompetencyService, FrameworkReport
from impulse.application.development import (
    CourseRecord,
    DevelopmentService,
    RoadmapRecord,
    TrackAttempt,
    TrackRecord,
)
from impulse.application.work import WorkItem, WorkService
from impulse.domain.competencies import LEVEL_RANK, UNKNOWN_LEVEL
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    TrackStatus,
)
from impulse.domain.growth import (
    ACTIVITY_DEFINITIONS_VERSION,
    HOURS_DEFINITIONS_VERSION,
    MILESTONE_DEFINITIONS_VERSION,
    READINESS_DEFINITIONS_VERSION,
    MilestoneWeight,
    ReadinessWeight,
    WeightedResult,
    activity_bucket_counts,
    merged_minutes,
    period_boundaries,
    readiness,
    weighted_completion,
)
from impulse.domain.identity import ActorContext
from impulse.domain.priority import (
    PolicyResult,
    StepSpec,
    TargetState,
    select_steps,
)
from impulse.domain.work import AssignmentStatus, ContributionStatus

GROWTH_SNAPSHOT_VERSION = 2
STATUS_COMPLETED = "completed"
STATUS_AVAILABLE = "available"
STATUS_UNKNOWN = "unknown"

SKILL_TARGET_RANK = 1  # «уверенный» — целевой ранг в словаре LEVEL_RANK


@dataclass(frozen=True, slots=True)
class SkillPositionSnapshot:
    skill_key: str
    title: str
    current_level: str
    known: bool


@dataclass(frozen=True, slots=True)
class MilestoneSnapshot:
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


@dataclass(frozen=True, slots=True)
class TrajectoryGrowth:
    track_key: str
    track_title: str
    policy_version: int
    milestones: tuple[MilestoneSnapshot, ...]
    completion: WeightedResult
    readiness_skills: tuple[SkillPositionSnapshot, ...]
    readiness: WeightedResult
    object_refs: tuple[str, ...]
    next_step_ref: str | None


@dataclass(frozen=True, slots=True)
class ActivityEventSnapshot:
    kind: str
    title: str
    occurred_at: datetime
    source_kind: str
    source_ref: str


@dataclass(frozen=True, slots=True)
class TrustedIntervalSnapshot:
    start: datetime
    end: datetime
    source_kind: str
    source_ref: str


@dataclass(frozen=True, slots=True)
class HoursBlock:
    known: bool
    trusted_minutes: int | None
    self_reported_minutes: int | None
    intervals: tuple[TrustedIntervalSnapshot, ...]


@dataclass(frozen=True, slots=True)
class FreshnessBlock:
    known: bool
    latest_observed_at: datetime | None


@dataclass(frozen=True, slots=True)
class GrowthSnapshot:
    snapshot_id: UUID
    generated_at: datetime
    snapshot_version: int
    actor_timezone: str
    definitions: dict[str, str]
    activity: dict[str, dict[str, int]]
    events: tuple[ActivityEventSnapshot, ...]
    hours: HoursBlock
    freshness: FreshnessBlock
    trajectories: tuple[TrajectoryGrowth, ...]


class GrowthService:
    """Deterministic projection over development, competency and work stores."""

    def __init__(
        self,
        development: DevelopmentService,
        competency: CompetencyService,
        work: WorkService,
    ) -> None:
        self._development = development
        self._competency = competency
        self._work = work

    def definitions(self) -> dict[str, str]:
        return {
            "activity": f"impulse-growth-activity-v{ACTIVITY_DEFINITIONS_VERSION}",
            "hours": f"impulse-growth-hours-v{HOURS_DEFINITIONS_VERSION}",
            "milestones": f"impulse-growth-milestones-v{MILESTONE_DEFINITIONS_VERSION}",
            "readiness": f"impulse-growth-readiness-v{READINESS_DEFINITIONS_VERSION}",
            "snapshot": f"impulse-growth-snapshot-v{GROWTH_SNAPSHOT_VERSION}",
        }

    async def snapshot(self, actor: ActorContext) -> GrowthSnapshot:
        """Сводный слепок роста участника: активность, часы, траектории."""
        now = datetime.now(UTC).replace(microsecond=0)
        store = self._development.store
        tracks = {item.key: item for item in await store.tracks()}
        attempts = (await store.attempts(actor.person_id))
        attempts_by_track = {attempt.track_key: attempt for attempt in attempts}
        active_tracks = tuple(
            tracks[attempt.track_key] for attempt in attempts if attempt.track_key in tracks
        )
        roadmaps: dict[str, RoadmapRecord] = {}
        for track in active_tracks:
            record = await store.roadmap(track.key)
            if record is not None:
                roadmaps[track.key] = record
        verified_courses = frozenset(
            enrollment.course_key
            for enrollment in await store.enrollments(actor.person_id)
            if enrollment.status is CompletionStatus.VERIFIED
        )
        course_index: dict[str, CourseRecord] = {
            item.key: item for item in await store.courses()
        }
        published_task_keys = frozenset(
            item.task_key for item in await self._work.store.published_tasks()
        )
        reports = await self._competency.person_reports(actor.person_id)
        work_items = await self._work.participant_work(actor)
        accepted_items = tuple(
            item for item in work_items if item.assignment.status is AssignmentStatus.ACCEPTED
        )
        published_task_keys = published_task_keys | frozenset(
            item.task.task_key for item in accepted_items
        )
        accepted_task_keys = frozenset(item.task.task_key for item in accepted_items)
        events = self._activity_events(accepted_items)
        intervals = self._trusted_intervals(accepted_items)
        boundaries = period_boundaries(now=now, timezone=actor.timezone)
        activity = activity_bucket_counts(
            tuple((event.occurred_at, event.kind) for event in events),
            boundaries=boundaries,
        )
        observed = frozenset(
            event.occurred_at for event in events
        ) | frozenset(interval[1] for interval in intervals)
        latest_observed_at = max(observed) if observed else None
        return GrowthSnapshot(
            snapshot_id=uuid5(NAMESPACE_URL, f"impulse-growth:{actor.person_id}:{now}"),
            generated_at=now,
            snapshot_version=GROWTH_SNAPSHOT_VERSION,
            actor_timezone=actor.timezone,
            definitions=self.definitions(),
            activity=activity,
            events=events,
            hours=self._hours(intervals),
            freshness=FreshnessBlock(
                known=latest_observed_at is not None,
                latest_observed_at=latest_observed_at,
            ),
            trajectories=self._trajectory_growth(
                active_tracks,
                roadmaps,
                attempts_by_track,
                verified_courses,
                course_index,
                published_task_keys,
                accepted_task_keys,
                reports,
            ),
        )

    def _trajectory_growth(
        self,
        tracks: tuple[TrackRecord, ...],
        roadmaps: dict[str, RoadmapRecord],
        attempts: dict[str, TrackAttempt],
        verified_courses: frozenset[str],
        courses: dict[str, CourseRecord],
        published_task_keys: frozenset[str],
        accepted_task_keys: frozenset[str],
        reports: tuple[FrameworkReport, ...],
    ) -> tuple[TrajectoryGrowth, ...]:
        growths: list[TrajectoryGrowth] = []
        for track in tracks:
            roadmap = roadmaps.get(track.key)
            attempt = attempts.get(track.key)
            if roadmap is None or attempt is None or track.key not in attempts:
                continue
            milestones = roadmap.milestones
            completed_keys = self.completed_milestone_keys(
                milestones,
                attempt,
                verified_courses,
                published_task_keys,
                accepted_task_keys,
            )
            mandatory_count = sum(1 for item in milestones if item.mandatory)
            weights = tuple(
                MilestoneWeight(
                    key=item.key,
                    mandatory=item.mandatory,
                    weight=(
                        (Decimal(1) / Decimal(mandatory_count))
                        if self._target_known(item, courses, published_task_keys)
                        else None
                    ),
                )
                for item in milestones
            )
            readiness_skills, readiness_result = self._readiness(reports)
            views = self._milestone_views(
                milestones,
                weights,
                completed_keys,
                courses,
                published_task_keys,
            )
            refs = tuple(f"{item.target_kind}:{item.target_key}" for item in views if item.known)
            next_step = next(
                (view for view in views if view.status is not STATUS_COMPLETED and view.known),
                None,
            )
            growths.append(
                TrajectoryGrowth(
                    track_key=track.key,
                    track_title=track.title,
                    policy_version=roadmap.policy_version,
                    milestones=views,
                    completion=weighted_completion(weights, completed_keys),
                    readiness_skills=readiness_skills,
                    readiness=readiness_result,
                    object_refs=refs,
                    next_step_ref=(
                        f"{next_step.target_kind}:{next_step.target_key}"
                        if next_step is not None
                        else None
                    ),
                )
            )
        return tuple(growths)

    def completed_milestone_keys(
        self,
        milestones: tuple[RoadmapMilestone, ...],
        attempt: TrackAttempt,
        verified_courses: frozenset[str],
        published_task_keys: frozenset[str],
        accepted_task_keys: frozenset[str],
    ) -> frozenset[str]:
        """Каноническое множество завершённых ключей дорожной карты."""
        course_done = frozenset(
            item.key
            for item in milestones
            if item.mandatory
            and item.target_kind == "course"
            and item.target_key in verified_courses
        )
        task_done = frozenset(
            item.key
            for item in milestones
            if item.mandatory
            and item.target_kind == "task"
            and item.target_key in published_task_keys
            and item.target_key in accepted_task_keys
        )
        return frozenset(attempt.completed_milestones) | course_done | task_done

    def _readiness(
        self, reports: tuple[FrameworkReport, ...]
    ) -> tuple[tuple[SkillPositionSnapshot, ...], WeightedResult]:
        skills = tuple(
            SkillPositionSnapshot(
                skill_key=point.skill.key,
                title=point.skill.title,
                current_level=point.level,
                known=point.level != UNKNOWN_LEVEL,
            )
            for report in reports
            for point in report.skills
        )
        weights = tuple(
            ReadinessWeight(
                skill_key=point.skill_key,
                target_level=SKILL_TARGET_RANK,
                weight=(Decimal(1) / Decimal(len(skills))) if skills else Decimal(0),
            )
            for point in skills
        )
        current_ranks = {
            point.skill_key: LEVEL_RANK.get(point.current_level, -1) for point in skills
        }
        known_keys = frozenset(point.skill_key for point in skills if point.known)
        return skills, readiness(weights, current_ranks, known_keys)

    def _hours(
        self, intervals: tuple[tuple[datetime, datetime, str, str], ...]
    ) -> HoursBlock:
        minutes = merged_minutes(tuple((item[0], item[1]) for item in intervals))
        return HoursBlock(
            known=bool(intervals),
            trusted_minutes=minutes if intervals else None,
            self_reported_minutes=0,
            intervals=tuple(
                TrustedIntervalSnapshot(
                    start=item[0], end=item[1], source_kind=item[2], source_ref=item[3]
                )
                for item in intervals
            ),
        )

    def _activity_events(
        self, items: tuple[WorkItem, ...]
    ) -> tuple[ActivityEventSnapshot, ...]:
        events: list[ActivityEventSnapshot] = []
        for item in items:
            title = item.task.title
            decisions = {row.contribution_id: row for row in item.decisions}
            for contribution in item.contributions:
                decision = decisions.get(contribution.id)
                if decision is None:
                    continue
                if decision.decision is ContributionStatus.ACCEPTED:
                    if decision.decided_at is not None:
                        events.append(
                            ActivityEventSnapshot(
                                kind="revision_accepted",
                                title=title,
                                occurred_at=decision.decided_at,
                                source_kind="work_contribution",
                                source_ref=str(contribution.id),
                            )
                        )
                    continue
                events.append(
                    ActivityEventSnapshot(
                        kind="project_submission",
                        title=title,
                        occurred_at=contribution.submitted_at,
                        source_kind="work_contribution",
                        source_ref=str(contribution.id),
                    )
                )
        return tuple(events)

    def _trusted_intervals(
        self, items: tuple[WorkItem, ...]
    ) -> tuple[tuple[datetime, datetime, str, str], ...]:
        intervals: list[tuple[datetime, datetime, str, str]] = []
        for item in items:
            assignment = item.assignment
            decision = next(
                (row for row in item.decisions if row.decision is ContributionStatus.ACCEPTED),
                None,
            )
            if (
                assignment.created_at is not None
                and decision is not None
                and decision.decided_at is not None
                and decision.decided_at > assignment.created_at
            ):
                intervals.append(
                    (
                        assignment.created_at,
                        decision.decided_at,
                        "work_assignment",
                        str(assignment.id),
                    )
                )
        return tuple(intervals)

    def _milestone_views(
        self,
        milestones: tuple[RoadmapMilestone, ...],
        weights: tuple[MilestoneWeight, ...],
        completed_keys: frozenset[str],
        courses: dict[str, CourseRecord],
        published_task_keys: frozenset[str],
    ) -> tuple[MilestoneSnapshot, ...]:
        views: list[MilestoneSnapshot] = []
        for item, weight in zip(milestones, weights, strict=True):
            known = self._target_known(item, courses, published_task_keys)
            completed = item.key in completed_keys
            status = (
                STATUS_COMPLETED
                if completed
                else STATUS_AVAILABLE
                if known and weight.weight is not None
                else STATUS_UNKNOWN
            )
            views.append(
                MilestoneSnapshot(
                    key=item.key,
                    position=item.position,
                    title=item.title,
                    purpose=item.purpose,
                    skill=item.skill,
                    target_kind=item.target_kind,
                    target_key=item.target_key,
                    target_title=self._target_title(item, courses),
                    status=status,
                    known=known,
                )
            )
        return tuple(views)

    def _target_known(
        self,
        item: RoadmapMilestone,
        courses: dict[str, CourseRecord],
        published_task_keys: frozenset[str],
    ) -> bool:
        if item.target_kind == "course":
            return item.target_key in courses
        if item.target_kind == "task":
            return item.target_key in published_task_keys
        return False

    def _target_title(
        self, item: RoadmapMilestone, courses: dict[str, CourseRecord]
    ) -> str:
        if item.target_kind == "course":
            course = courses.get(item.target_key)
            if course is not None:
                return course.title
        return item.target_key

    async def next_step(
        self, actor: ActorContext
    ) -> tuple[dict[str, RoadmapRecord] | None, PolicyResult]:
        """Детерминированный приоритет следующего шага (openspec 22.12)."""
        store = self._development.store
        catalog = {item.key: item for item in await store.tracks()}
        attempts = await store.attempts(actor.person_id)
        active_attempts = tuple(item for item in attempts if item.status is TrackStatus.ACTIVE)
        active_tracks = tuple(
            catalog[attempt.track_key]
            for attempt in active_attempts
            if attempt.track_key in catalog
        )
        trajectory_positions = {
            attempt.track_key: position for position, attempt in enumerate(active_attempts)
        }
        roadmaps: dict[str, RoadmapRecord] = {}
        for track in active_tracks:
            record = await store.roadmap(track.key)
            if record is not None:
                roadmaps[track.key] = record
        courses_index: dict[str, CourseRecord] = {
            item.key: item for item in await store.courses()
        }
        tasks_by_key: dict[str, object] = {
            item.task_key: item for item in await self._work.store.published_tasks()
        }
        specs: list[StepSpec] = []
        for track in active_tracks:
            roadmap = roadmaps.get(track.key)
            attempt = next((item for item in active_attempts if item.track_key == track.key), None)
            if roadmap is None or attempt is None:
                continue
            for milestone in roadmap.milestones:
                if not milestone.mandatory or milestone.key in attempt.completed_milestones:
                    continue
                known = (
                    milestone.target_kind == "course" and milestone.target_key in courses_index
                ) or (milestone.target_kind == "task" and milestone.target_key in tasks_by_key)
                if not known:
                    continue
                target_title = self._target_title(milestone, courses_index)
                specs.append(
                    StepSpec(
                        trajectory_key=track.key,
                        trajectory_position=trajectory_positions.get(track.key, 0),
                        position=milestone.position,
                        milestone_key=milestone.key,
                        target_kind=milestone.target_kind,
                        target_key=milestone.target_key,
                        target_title=target_title,
                    )
                )
        states = await self._target_states(active_tracks, roadmaps, courses_index, tasks_by_key)
        return roadmaps if roadmaps else None, select_steps(tuple(specs), states)

    async def _target_states(
        self,
        active_tracks: tuple[TrackRecord, ...],
        roadmaps: dict[str, RoadmapRecord],
        courses: dict[str, CourseRecord],
        published_tasks: dict[str, object],
    ) -> dict[tuple[str, str], TargetState]:
        states: dict[tuple[str, str], TargetState] = {}
        for track in active_tracks:
            roadmap = roadmaps.get(track.key)
            if roadmap is None:
                continue
            for milestone in roadmap.milestones:
                key = (milestone.target_kind, milestone.target_key)
                if key in states:
                    continue
                if milestone.target_kind == "course":
                    record = courses.get(milestone.target_key)
                    if record is None:
                        continue
                    states[key] = TargetState(
                        published=record.availability != "unavailable",
                        prerequisites_known=False,
                        prerequisites_met=True,
                        effort_hours=None,
                    )
                elif milestone.target_kind == "task":
                    record = published_tasks.get(milestone.target_key)
                    if record is None:
                        continue
                    accepted = sum(
                        1
                        for item in await self._work.store.assignments_for_task(
                            record.aggregate.task_id  # type: ignore[attr-defined]
                        )
                        if item.status is AssignmentStatus.ACCEPTED
                    )
                    states[key] = TargetState(
                        published=True,
                        places_filled=accepted >= record.places,  # type: ignore[attr-defined]
                        prerequisites_known=False,
                        prerequisites_met=True,
                        effort_hours=None,
                    )
        return states


__all__ = [
    "GROWTH_SNAPSHOT_VERSION",
    "GrowthService",
    "GrowthSnapshot",
    "HoursBlock",
    "MilestoneSnapshot",
    "SkillPositionSnapshot",
    "TrajectoryGrowth",
]
