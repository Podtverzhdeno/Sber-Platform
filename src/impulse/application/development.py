"""Participant career and Bootcamp use cases."""

from __future__ import annotations

import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Protocol, TypedDict
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.competencies import LEVEL_RANK, UNKNOWN_LEVEL
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    RoadmapProjection,
    StreakResult,
    TrackAttempt,
    TrackPolicyError,
    TrackStatus,
    calculate_streak,
    local_learning_days,
    rating_eligible,
    recalculate_roadmap,
    select_track,
)
from impulse.domain.engagement import (
    FREEZE_GRANT_MILESTONE_DAYS,
    FREEZE_POLICY_VERSION,
    EngagementSource,
    FreezeInventory,
    FrozenEngagementCalendar,
    WeeklyRhythm,
    WeeklyRhythmError,
    engagement_calendar,
    frozen_calendar,
    preset_active_days,
    service_block_audit,
    weekly_rhythm_projection,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.monthly_goal import (
    MonthlyGoalPlan,
    MonthlyGoalProjection,
    build_monthly_goal_projection,
    month_bounds,
)


@dataclass(frozen=True, slots=True)
class TrackRecord:
    key: str
    title: str


@dataclass(frozen=True, slots=True)
class RoadmapRecord:
    track_key: str
    policy_version: int
    milestones: tuple[RoadmapMilestone, ...]


@dataclass(frozen=True, slots=True)
class CourseRecord:
    key: str
    title: str
    track_keys: tuple[str, ...]
    source_url: str
    availability: str
    access_note: str


@dataclass(frozen=True, slots=True)
class EnrollmentRecord:
    course_key: str
    status: CompletionStatus


@dataclass(frozen=True, slots=True)
class CompletedCompetency:
    competency: str
    level: str
    evidence: str


@dataclass(frozen=True, slots=True)
class CourseCertificate:
    certificate_id: UUID
    verification_id: str
    person_id: UUID
    holder_name: str
    course_key: str
    course_title: str
    specialization: str
    program_version: str
    period: str
    workload_hours: int
    result: str
    competencies: tuple[CompletedCompetency, ...]
    issued_at: datetime

    def preview_marking(self) -> str:
        """Demo issuer documents are never presented as an official Sber certificate."""
        return "Демонстрационный образец"


class CourseCertificateSpec(TypedDict):
    """Static per-course certificate descriptor from the Bootcamp registry."""

    specialization: str
    program_version: str
    workload_hours: int
    competencies: tuple[tuple[str, str, str], ...]


COURSE_CERTIFICATE_REGISTRY: dict[str, CourseCertificateSpec] = {
    "openspec-sdd": {
        "specialization": "Python / Data / Product / ML",
        "program_version": "1.0.0",
        "workload_hours": 24,
        "competencies": (
            ("Спецификация и документация", "базовый", "OpenSpec-задание курса"),
            ("Ведение проекта по SDD", "базовый", "Практическое задание курса"),
        ),
    },
    "agent-development": {
        "specialization": "Python / ML",
        "program_version": "1.0.0",
        "workload_hours": 32,
        "competencies": (
            ("Проектирование агентных сценариев", "базовый", "Практическое задание курса"),
            ("Контекст и ограничения агентов", "базовый", "Практическое задание курса"),
        ),
    },
    "python-base": {
        "specialization": "Python / Data / ML",
        "program_version": "1.0.0",
        "workload_hours": 40,
        "competencies": (("Синтаксис и идиомы Python", "базовый", "Итоговое задание курса"),),
    },
}


class CertificateStore(Protocol):
    async def course_certificate(
        self, person_id: UUID, course_key: str
    ) -> CourseCertificate | None: ...

    async def certificate_by_verification(
        self, verification_id: str
    ) -> CourseCertificate | None: ...

    async def course_certificates(self, person_id: UUID) -> tuple[CourseCertificate, ...]: ...

    async def add_course_certificate(self, certificate: CourseCertificate) -> CourseCertificate: ...


class MemoryCertificateStore:
    """Deterministic in-memory adapter for demo runs and tests."""

    def __init__(self) -> None:
        self._by_person_course: dict[tuple[UUID, str], CourseCertificate] = {}
        self._by_verification: dict[str, CourseCertificate] = {}

    async def course_certificate(
        self, person_id: UUID, course_key: str
    ) -> CourseCertificate | None:
        return self._by_person_course.get((person_id, course_key))

    async def certificate_by_verification(self, verification_id: str) -> CourseCertificate | None:
        return self._by_verification.get(verification_id)

    async def course_certificates(self, person_id: UUID) -> tuple[CourseCertificate, ...]:
        items = [item for key, item in self._by_person_course.items() if key[0] == person_id]
        items.sort(key=lambda item: item.issued_at)
        return tuple(items)

    async def add_course_certificate(self, certificate: CourseCertificate) -> CourseCertificate:
        self._by_person_course[(certificate.person_id, certificate.course_key)] = certificate
        self._by_verification[certificate.verification_id] = certificate
        return certificate

    def install_course_certificate(self, certificate: CourseCertificate) -> None:
        """Sync seeding hook for deterministic demo documents."""
        self._by_person_course[(certificate.person_id, certificate.course_key)] = certificate
        self._by_verification[certificate.verification_id] = certificate


def demo_course_certificate(person_id: UUID, certificate_id: UUID) -> CourseCertificate:
    """Synthetic preview document for the demo roster; never an official certificate."""
    registry = COURSE_CERTIFICATE_REGISTRY["openspec-sdd"]
    return CourseCertificate(
        certificate_id=certificate_id,
        verification_id="demo-cert-openspec-sdd",
        person_id=person_id,
        holder_name="Алекс Речной",
        course_key="openspec-sdd",
        course_title="OpenSpec и SDD",
        specialization=str(registry["specialization"]),
        program_version=str(registry["program_version"]),
        period="2026",
        workload_hours=int(registry["workload_hours"]),
        result="Подтверждённое завершение Bootcamp-курса",
        competencies=tuple(CompletedCompetency(*entry) for entry in registry["competencies"]),
        issued_at=datetime.now(UTC),
    )


@dataclass(frozen=True, slots=True)
class CourseMilestoneFact:
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    completed: bool


@dataclass(frozen=True, slots=True)
class CourseCycleFact:
    competency: str
    current_level: str
    projected_level: str
    target_level: str
    projected_confirmed: bool
    evidence: str


@dataclass(frozen=True, slots=True)
class CourseDetailProjection:
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
    program_competencies: tuple[tuple[str, str, str], ...]
    objective: str | None
    milestone_title: str | None
    next_step: str | None
    artifact: str | None
    cycle: tuple[CourseCycleFact, ...]


def strongest_level_label(first: str, second: str) -> str:
    first_rank = LEVEL_RANK.get(first, -1)
    second_rank = LEVEL_RANK.get(second, -1)
    if first_rank >= second_rank:
        return first if first_rank >= 0 else (second if second_rank >= 0 else UNKNOWN_LEVEL)
    return second


def build_course_detail(
    course: CourseRecord,
    *,
    program: CourseCertificateSpec | None,
    enrollment_status: CompletionStatus | None,
    milestones: tuple[CourseMilestoneFact, ...],
    skill_levels: Mapping[str, str] | None = None,
    course_endorsed: Mapping[str, str] | None = None,
) -> CourseDetailProjection:
    """Assemble the explainable course-detail projection for one Bootcamp course."""
    levels = dict(skill_levels or {})
    endorsed = dict(course_endorsed or {})
    first_milestone = milestones[0] if milestones else None
    open_milestone = next((item for item in milestones if not item.completed), None)
    competencies: tuple[tuple[str, str, str], ...] = (
        tuple(program["competencies"]) if program is not None else ()
    )
    artifact = competencies[0][2] if competencies else None
    cycle: list[CourseCycleFact] = []
    for name, target_level, evidence in competencies:
        confirmed = endorsed.get(name)
        current = levels.get(name) or UNKNOWN_LEVEL
        projected = (
            strongest_level_label(current, confirmed)
            if confirmed is not None
            else strongest_level_label(current, target_level)
        )
        cycle.append(
            CourseCycleFact(
                competency=name,
                current_level=current,
                projected_level=projected,
                target_level=target_level,
                projected_confirmed=confirmed is not None,
                evidence=evidence,
            )
        )
    return CourseDetailProjection(
        course_key=course.key,
        title=course.title,
        source_url=course.source_url,
        availability=course.availability,
        access_note=course.access_note,
        enrollment_status=(enrollment_status.value if enrollment_status is not None else None),
        verified=enrollment_status is CompletionStatus.VERIFIED,
        specialization=(str(program["specialization"]) if program is not None else None),
        program_version=(str(program["program_version"]) if program is not None else None),
        workload_hours=(int(program["workload_hours"]) if program is not None else None),
        program_competencies=competencies,
        objective=(first_milestone.purpose if first_milestone is not None else None),
        milestone_title=(first_milestone.title if first_milestone is not None else None),
        next_step=(open_milestone.title if open_milestone is not None else None),
        artifact=artifact,
        cycle=tuple(cycle),
    )


class DevelopmentStore(Protocol):
    async def tracks(self) -> tuple[TrackRecord, ...]: ...

    async def attempts(self, person_id: UUID) -> tuple[TrackAttempt, ...]: ...

    async def replace_attempts(
        self, person_id: UUID, attempts: tuple[TrackAttempt, ...]
    ) -> None: ...

    async def roadmap(self, track_key: str) -> RoadmapRecord | None: ...

    async def courses(self) -> tuple[CourseRecord, ...]: ...

    async def enrollments(self, person_id: UUID) -> tuple[EnrollmentRecord, ...]: ...

    async def report_completion(self, person_id: UUID, course_key: str) -> EnrollmentRecord: ...

    async def record_learning_day(
        self, person_id: UUID, course_key: str, local_date: date, timezone: str
    ) -> None: ...

    async def learning_dates(self, person_id: UUID) -> frozenset[date]: ...

    async def record_engagement_event(
        self,
        person_id: UUID,
        source: EngagementSource,
        source_ref: str,
        local_date: date,
        timezone: str,
    ) -> None: ...

    async def engagement_dates(self, person_id: UUID) -> frozenset[date]: ...

    async def freeze_counts(self, person_id: UUID) -> tuple[int, int, frozenset[date]]:
        """(granted_total, available, consumed_dates) for versioned freeze policy."""
        ...

    async def grant_freeze_day(self, person_id: UUID, granted_at: datetime, rule: str) -> None: ...

    async def consume_freeze_day(self, person_id: UUID, local_date: date) -> bool: ...

    async def record_freeze_exception(
        self, person_id: UUID, local_date: date, scope: str, explanation: str
    ) -> None: ...

    async def freeze_exceptions(self, person_id: UUID) -> tuple[str, ...]: ...

    async def weekly_rhythm_history(self, person_id: UUID) -> tuple[WeeklyRhythm, ...]:
        """All saved rhythm versions, ascending by version."""
        ...

    async def save_weekly_rhythm(self, person_id: UUID, rhythm: WeeklyRhythm) -> None: ...

    async def monthly_goal_history(
        self, person_id: UUID, period: date
    ) -> tuple[MonthlyGoalPlan, ...]:
        """Saved goal plans for the period, ascending by plan_version."""
        ...

    async def save_monthly_goal(self, person_id: UUID, plan: MonthlyGoalPlan) -> None: ...


class MemoryDevelopmentStore:
    def __init__(self) -> None:
        self._tracks = (
            TrackRecord("python", "Python-разработчик"),
            TrackRecord("data", "Аналитик данных"),
            TrackRecord("product", "Продуктовый аналитик"),
            TrackRecord("ml", "ML-инженер"),
        )
        self._attempts: dict[UUID, tuple[TrackAttempt, ...]] = {}
        self._roadmaps: dict[str, RoadmapRecord] = {
            item.key: RoadmapRecord(
                track_key=item.key,
                policy_version=1,
                milestones=(
                    RoadmapMilestone(
                        "foundation",
                        1,
                        "Освоить основу",
                        "Создать базу для первой практической задачи.",
                        item.title,
                        "course",
                        "openspec-sdd" if item.key == "product" else "python-base",
                    ),
                    RoadmapMilestone(
                        "practice",
                        2,
                        "Применить на практике",
                        "Собрать проверяемый артефакт для портфолио.",
                        "Проектная работа",
                        "task",
                        "demo-task-1",
                    ),
                ),
            )
            for item in self._tracks
        }
        self._courses = (
            CourseRecord(
                "openspec-sdd",
                "OpenSpec и SDD",
                ("python", "data", "product", "ml"),
                "https://github.com/Fission-AI/OpenSpec",
                "available",
                "Доступен в демо без регистрации во внешней LMS.",
            ),
            CourseRecord(
                "agent-development",
                "Агентная разработка",
                ("python", "ml"),
                "https://developers.sber.ru/docs/ru/gigachat/",
                "available",
                "Рекомендуется после основ OpenSpec.",
            ),
            CourseRecord(
                "python-base",
                "Python: основа",
                ("python", "data", "ml"),
                "https://docs.python.org/3/tutorial/",
                "unavailable",
                "Внешний курс пока не подключён; доступна исходная ссылка.",
            ),
        )
        self._enrollments: dict[tuple[UUID, str], EnrollmentRecord] = {}
        self._seed_person_id: UUID | None = None
        self._days: dict[UUID, frozenset[date]] = {}
        self._engagement: dict[UUID, list[tuple[EngagementSource, str, date]]] = {}
        self._freeze: dict[UUID, list[tuple[date | None, str]]] = {}
        self._freeze_exceptions: dict[UUID, list[tuple[date, str, str]]] = {}
        self._weekly_rhythm: dict[UUID, list[WeeklyRhythm]] = {}
        self._monthly_goals: dict[UUID, list[MonthlyGoalPlan]] = {}

    async def tracks(self) -> tuple[TrackRecord, ...]:
        return self._tracks

    async def attempts(self, person_id: UUID) -> tuple[TrackAttempt, ...]:
        return self._attempts.get(
            person_id,
            (TrackAttempt("python", 1, TrackStatus.ACTIVE),),
        )

    async def replace_attempts(self, person_id: UUID, attempts: tuple[TrackAttempt, ...]) -> None:
        self._attempts[person_id] = attempts

    async def roadmap(self, track_key: str) -> RoadmapRecord | None:
        return self._roadmaps.get(track_key)

    def install_roadmap(self, roadmap: RoadmapRecord) -> None:
        """Replace one in-memory policy version for deterministic contract tests."""
        self._roadmaps[roadmap.track_key] = roadmap

    def install_enrollments(self, records: tuple[EnrollmentRecord, ...]) -> None:
        """Seed per-person enrollments for deterministic certificate tests."""
        seed = self._seed_person_id
        if seed is None:
            raise RuntimeError("Call enroll_as(person_id) before install_enrollments")
        for record in records:
            self._enrollments[(seed, record.course_key)] = record

    def enroll_as(self, person_id: UUID) -> None:
        """Select the owner for subsequently installed enrollments."""
        self._seed_person_id = person_id

    async def courses(self) -> tuple[CourseRecord, ...]:
        return self._courses

    async def enrollments(self, person_id: UUID) -> tuple[EnrollmentRecord, ...]:
        return tuple(
            value for (owner, _course), value in self._enrollments.items() if owner == person_id
        )

    async def report_completion(self, person_id: UUID, course_key: str) -> EnrollmentRecord:
        if not any(item.key == course_key for item in self._courses):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        record = EnrollmentRecord(course_key, CompletionStatus.REPORTED)
        self._enrollments[(person_id, course_key)] = record
        return record

    async def record_learning_day(
        self, person_id: UUID, course_key: str, local_date: date, timezone: str
    ) -> None:
        if not any(item.key == course_key for item in self._courses):
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        self._days[person_id] = self._days.get(person_id, frozenset()) | {local_date}

    async def learning_dates(self, person_id: UUID) -> frozenset[date]:
        return self._days.get(person_id, frozenset())

    async def record_engagement_event(
        self,
        person_id: UUID,
        source: EngagementSource,
        source_ref: str,
        local_date: date,
        timezone: str,
    ) -> None:
        seen = self._engagement.setdefault(person_id, [])
        if any(entry[0] == source and entry[1] == source_ref for entry in seen):
            return
        seen.append((source, source_ref, local_date))

    async def engagement_dates(self, person_id: UUID) -> frozenset[date]:
        return frozenset(entry[2] for entry in self._engagement.get(person_id, ()))

    def first_engagement_person(self) -> UUID:
        """Test/demo helper: first person that recorded at least one qualification event."""
        return next(iter(self._engagement))

    async def freeze_counts(self, person_id: UUID) -> tuple[int, int, frozenset[date]]:
        rows = self._freeze.get(person_id, [])
        consumed = frozenset(entry[0] for entry in rows if entry[0] is not None)
        available = sum(1 for entry in rows if entry[0] is None)
        return len(rows), available, consumed

    async def grant_freeze_day(self, person_id: UUID, granted_at: datetime, rule: str) -> None:
        self._freeze.setdefault(person_id, []).append((None, granted_at.isoformat()))

    async def consume_freeze_day(self, person_id: UUID, local_date: date) -> bool:
        rows = self._freeze.setdefault(person_id, [])
        for index, (consumed_day, _rule) in enumerate(rows):
            if consumed_day is None:
                rows[index] = (local_date, _rule)
                return True
        return False

    async def record_freeze_exception(
        self, person_id: UUID, local_date: date, scope: str, explanation: str
    ) -> None:
        self._freeze_exceptions.setdefault(person_id, []).append((local_date, scope, explanation))

    async def freeze_exceptions(self, person_id: UUID) -> tuple[str, ...]:
        return tuple(
            f"{scope}:{explanation}"
            for _, scope, explanation in self._freeze_exceptions.get(person_id, ())
        )

    async def weekly_rhythm_history(self, person_id: UUID) -> tuple[WeeklyRhythm, ...]:
        return tuple(self._weekly_rhythm.get(person_id, ()))

    async def save_weekly_rhythm(self, person_id: UUID, rhythm: WeeklyRhythm) -> None:
        self._weekly_rhythm.setdefault(person_id, []).append(rhythm)

    async def monthly_goal_history(
        self, person_id: UUID, period: date
    ) -> tuple[MonthlyGoalPlan, ...]:
        return tuple(
            plan for plan in self._monthly_goals.get(person_id, ()) if plan.period == period
        )

    async def save_monthly_goal(self, person_id: UUID, plan: MonthlyGoalPlan) -> None:
        self._monthly_goals.setdefault(person_id, []).append(plan)


class DevelopmentService:
    def __init__(
        self, store: DevelopmentStore, certificates: CertificateStore | None = None
    ) -> None:
        self.store = store
        self.certificates = certificates
        self.competency_service: object | None = None

    @staticmethod
    def _participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN", message="Действие доступно участнику.", status_code=403
            )

    async def track_overview(
        self, actor: ActorContext
    ) -> tuple[tuple[TrackRecord, ...], tuple[TrackAttempt, ...]]:
        self._participant(actor)
        return await self.store.tracks(), await self.store.attempts(actor.person_id)

    async def choose_track(
        self, actor: ActorContext, track_key: str, freeze_track_key: str | None
    ) -> tuple[TrackAttempt, ...]:
        self._participant(actor)
        catalog = await self.store.tracks()
        if track_key not in {item.key for item in catalog}:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        try:
            selection = select_track(
                await self.store.attempts(actor.person_id),
                track_key,
                freeze_track_key=freeze_track_key,
            )
        except TrackPolicyError as exc:
            raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
        await self.store.replace_attempts(actor.person_id, selection.attempts)
        return selection.attempts

    async def roadmaps(self, actor: ActorContext) -> tuple[RoadmapProjection, ...]:
        self._participant(actor)
        attempts = await self.store.attempts(actor.person_id)
        projections: list[RoadmapProjection] = []
        for attempt in attempts:
            if attempt.status is not TrackStatus.ACTIVE:
                continue
            record = await self.store.roadmap(attempt.track_key)
            if record is None:
                continue
            previous = RoadmapProjection(
                track_key=attempt.track_key,
                policy_version=max(record.policy_version - 1, 1),
                milestones=(),
                completed_keys=attempt.completed_milestones,
            )
            projections.append(
                recalculate_roadmap(
                    previous,
                    track_key=record.track_key,
                    policy_version=record.policy_version,
                    milestones=record.milestones,
                )
            )
        return tuple(projections)

    async def set_monthly_goal(
        self,
        actor: ActorContext,
        *,
        track_key: str,
        milestone_key: str,
        local_today: date,
    ) -> MonthlyGoalProjection:
        """Append a versioned plan for the current month and return its live projection."""
        self._participant(actor)
        attempts = await self.store.attempts(actor.person_id)
        attempt = next(
            (
                item
                for item in attempts
                if item.track_key == track_key and item.status is TrackStatus.ACTIVE
            ),
            None,
        )
        roadmap = await self.store.roadmap(track_key)
        if attempt is None or roadmap is None:
            raise ApiError(
                code="MONTHLY_GOAL_TRACK_NOT_ACTIVE",
                message="Monthly goal requires an active trajectory.",
                status_code=409,
            )
        target = next((item for item in roadmap.milestones if item.key == milestone_key), None)
        if target is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Roadmap checkpoint not found.", status_code=404
            )
        period, _ = month_bounds(local_today)
        history = await self.store.monthly_goal_history(actor.person_id, period)
        baseline = sum(
            1
            for item in roadmap.milestones
            if item.position <= target.position and item.key in attempt.completed_milestones
        )
        plan = MonthlyGoalPlan(
            period=period,
            plan_version=len(history) + 1,
            track_key=track_key,
            milestone_key=milestone_key,
            baseline_count=baseline,
            created_by=str(actor.person_id),
        )
        await self.store.save_monthly_goal(actor.person_id, plan)
        projection = await self.monthly_goal(actor, local_today=local_today)
        if projection is None:  # pragma: no cover - guarded by the validated roadmap above
            raise RuntimeError("Saved monthly goal could not be projected")
        return projection

    async def monthly_goal(
        self, actor: ActorContext, *, local_today: date
    ) -> MonthlyGoalProjection | None:
        """Return the latest current-month plan over current verified facts."""
        self._participant(actor)
        period, _ = month_bounds(local_today)
        history = await self.store.monthly_goal_history(actor.person_id, period)
        if not history:
            return None
        plan = history[-1]
        roadmap = await self.store.roadmap(plan.track_key)
        if roadmap is None:
            return None
        attempts = await self.store.attempts(actor.person_id)
        attempt = next((item for item in attempts if item.track_key == plan.track_key), None)
        confirmed: frozenset[str] = (
            attempt.completed_milestones if attempt is not None else frozenset()
        )
        enrollment_by_course = {
            item.course_key: item.status for item in await self.store.enrollments(actor.person_id)
        }
        submitted = frozenset(
            milestone.key
            for milestone in roadmap.milestones
            if milestone.target_kind == "course"
            and enrollment_by_course.get(milestone.target_key) is CompletionStatus.REPORTED
            and milestone.key not in confirmed
        )
        published_targets = frozenset(item.key for item in await self.store.courses())
        rhythm_history = await self.store.weekly_rhythm_history(actor.person_id)
        active_rhythms = [item for item in rhythm_history if item.effective_from <= local_today]
        active_days: frozenset[int] = (
            active_rhythms[-1].active_days if active_rhythms else frozenset()
        )
        tracks = {item.key: item.title for item in await self.store.tracks()}
        return build_monthly_goal_projection(
            track_key=plan.track_key,
            track_title=tracks.get(plan.track_key, plan.track_key),
            requested_target_key=plan.milestone_key,
            milestones=roadmap.milestones,
            confirmed=confirmed,
            submitted=submitted,
            published_targets=published_targets,
            baseline_count=plan.baseline_count,
            plan_version=plan.plan_version,
            history_count=len(history),
            rhythm_active_days=active_days,
            local_today=local_today,
            timezone=actor.timezone,
            generated_at=datetime.now(UTC),
            created_by=plan.created_by,
        )

    async def course_catalog(self, actor: ActorContext) -> tuple[tuple[CourseRecord, str], ...]:
        self._participant(actor)
        active = {
            item.track_key
            for item in await self.store.attempts(actor.person_id)
            if item.status is TrackStatus.ACTIVE
        }
        result: list[tuple[CourseRecord, str]] = []
        for course in await self.store.courses():
            matching = active & set(course.track_keys)
            if matching:
                result.append(
                    (
                        course,
                        f"Подходит для направлений: {', '.join(sorted(matching))}.",
                    )
                )
        return tuple(result)

    async def course_detail(self, actor: ActorContext, course_key: str) -> CourseDetailProjection:
        self._participant(actor)
        course = next((item for item in await self.store.courses() if item.key == course_key), None)
        if course is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        program = COURSE_CERTIFICATE_REGISTRY.get(course_key)
        enrolled = {
            item.course_key: item.status for item in await self.store.enrollments(actor.person_id)
        }
        milestone_facts: list[CourseMilestoneFact] = []
        for projection in await self.roadmaps(actor):
            for milestone in projection.milestones:
                if milestone.target_kind != "course" or milestone.target_key != course_key:
                    continue
                milestone_facts.append(
                    CourseMilestoneFact(
                        key=milestone.key,
                        position=milestone.position,
                        title=milestone.title,
                        purpose=milestone.purpose,
                        skill=milestone.skill,
                        completed=milestone.key in projection.completed_keys,
                    )
                )
        milestone_facts.sort(key=lambda item: (item.position, item.key))
        skill_levels: dict[str, str] = {}
        course_endorsed: dict[str, str] = {}
        anchor_service = getattr(self, "competency_service", None)
        if anchor_service is not None:
            course_ref = f"course:{course_key}"
            for report in await anchor_service.person_reports(actor.person_id):
                for point in getattr(report, "skills", ()):
                    title = point.skill.title
                    existing = skill_levels.get(title)
                    if existing is None or LEVEL_RANK.get(point.level, -1) > LEVEL_RANK.get(
                        existing, -1
                    ):
                        skill_levels[title] = point.level
                    for anchor in point.anchors:
                        row = anchor.row
                        if row.source_kind == "course" and row.source_ref == course_ref:
                            mapped = course_endorsed.get(title)
                            if mapped is None or LEVEL_RANK.get(row.level, -1) > LEVEL_RANK.get(
                                mapped, -1
                            ):
                                course_endorsed[title] = row.level
        return build_course_detail(
            course,
            program=program,
            enrollment_status=enrolled.get(course_key),
            milestones=tuple(milestone_facts),
            skill_levels=skill_levels,
            course_endorsed=course_endorsed,
        )

    async def report_completion(self, actor: ActorContext, course_key: str) -> EnrollmentRecord:
        self._participant(actor)
        return await self.store.report_completion(actor.person_id, course_key)

    async def issue_course_certificate(
        self,
        actor: ActorContext,
        course_key: str,
        *,
        holder_name: str,
    ) -> CourseCertificate:
        """Issue the Bootcamp certificate only after a verified course completion."""
        self._participant(actor)
        registry = COURSE_CERTIFICATE_REGISTRY.get(course_key)
        if registry is None or self.certificates is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        existing = await self.certificates.course_certificate(actor.person_id, course_key)
        if existing is not None:
            return existing
        enrolled = {
            item.course_key: item.status for item in await self.store.enrollments(actor.person_id)
        }
        if enrolled.get(course_key) is not CompletionStatus.VERIFIED:
            raise ApiError(
                code="CERTIFICATE_NOT_VERIFIED",
                message="Сертификат выдаётся только после подтверждённого завершения курса.",
                status_code=409,
            )
        course = next((item for item in await self.store.courses() if item.key == course_key), None)
        if course is None:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        certificate = CourseCertificate(
            certificate_id=uuid4(),
            verification_id=secrets.token_urlsafe(16),
            person_id=actor.person_id,
            holder_name=holder_name,
            course_key=course.key,
            course_title=course.title,
            specialization=str(registry["specialization"]),
            program_version=str(registry["program_version"]),
            period="2026",
            workload_hours=int(registry["workload_hours"]),
            result="Подтверждённое завершение Bootcamp-курса",
            competencies=tuple(CompletedCompetency(*entry) for entry in registry["competencies"]),
            issued_at=datetime.now(UTC),
        )
        issued = await self.certificates.add_course_certificate(certificate)
        anchor = getattr(self, "competency_service", None)
        if anchor is not None:
            for entry in certificate.competencies:
                await anchor.record_source_transition(
                    actor.person_id,
                    entry.competency,
                    source_kind="course",
                    source_ref=f"course:{certificate.course_key}",
                    level=entry.level,
                    observed_at=certificate.issued_at,
                )
        return issued

    async def course_certificates(self, actor: ActorContext) -> tuple[CourseCertificate, ...]:
        if self.certificates is None:
            return ()
        self._participant(actor)
        return await self.certificates.course_certificates(actor.person_id)

    async def verify_course_certificate(self, verification_id: str) -> CourseCertificate | None:
        if self.certificates is None:
            return None
        return await self.certificates.certificate_by_verification(verification_id)

    async def record_learning(
        self, actor: ActorContext, course_key: str, occurred_at: datetime
    ) -> StreakResult:
        self._participant(actor)
        local_date = next(iter(local_learning_days((occurred_at,), actor.timezone)))
        await self.store.record_learning_day(
            actor.person_id, course_key, local_date, actor.timezone
        )
        return calculate_streak(
            await self.store.learning_dates(actor.person_id), local_today=local_date
        )

    async def streak(self, actor: ActorContext, *, local_today: date) -> StreakResult:
        self._participant(actor)
        return calculate_streak(
            await self.store.learning_dates(actor.person_id), local_today=local_today
        )

    async def engagement(
        self, actor: ActorContext, *, local_today: date
    ) -> FrozenEngagementCalendar:
        """Engagement with the versioned freeze policy applied (v1 inventory sync included)."""
        return await self.engagement_with_freeze(actor, local_today=local_today)

    async def record_qualification(
        self,
        actor: ActorContext,
        source: EngagementSource,
        source_ref: str,
        occurred_at: datetime,
    ) -> FrozenEngagementCalendar:
        """First qualifying action accrues one local day; later events never double-credit."""
        self._participant(actor)
        local_date = next(iter(local_learning_days((occurred_at,), actor.timezone)))
        await self.store.record_engagement_event(
            actor.person_id, source, source_ref, local_date, actor.timezone
        )
        return await self.engagement(actor, local_today=local_date)

    @staticmethod
    async def _sync_freeze_inventory(
        store: DevelopmentStore, person_id: UUID, inventory: FreezeInventory, best_days: int
    ) -> None:
        for _milestone in range(inventory.grants_due(best_days)):
            await store.grant_freeze_day(
                person_id, datetime.now(UTC), f"milestone_{FREEZE_POLICY_VERSION}"
            )

    async def engagement_with_freeze(
        self, actor: ActorContext, *, local_today: date
    ) -> FrozenEngagementCalendar:
        self._participant(actor)
        dates = await self.store.learning_dates(actor.person_id)
        dates |= await self.store.engagement_dates(actor.person_id)
        granted_total, available, consumed = await self.store.freeze_counts(actor.person_id)
        inventory = FreezeInventory(
            granted_total=granted_total,
            available=available,
            consumed_total=len(consumed),
            next_grant_best_days=FREEZE_GRANT_MILESTONE_DAYS,
        )
        base_calendar = engagement_calendar(dates, local_today=local_today)
        await self._sync_freeze_inventory(
            self.store, actor.person_id, inventory, base_calendar.best_days
        )
        # N2: re-read after the milestone sync so a fresh grant can enable the bridge.
        _granted, available, consumed = await self.store.freeze_counts(actor.person_id)
        yesterday = local_today - timedelta(days=1)
        frozen = frozen_calendar(base_calendar, available, consumed, local_today=local_today)
        # Domain auto_apply already refuses when yesterday was bridged before (no double spend).
        if frozen.freeze_state == "frozen":
            await self.store.consume_freeze_day(actor.person_id, yesterday)
        return frozen

    async def use_freeze_day(
        self, actor: ActorContext, *, local_today: date
    ) -> FrozenEngagementCalendar:
        """Manual enablement from the popover: one stock day only when yesterday was missed."""
        self._participant(actor)
        return await self.engagement_with_freeze(actor, local_today=local_today)

    async def freeze_summary(self, actor: ActorContext) -> dict[str, int | str]:
        self._participant(actor)
        granted_total, available, consumed = await self.store.freeze_counts(actor.person_id)
        return {
            "policy_version": FREEZE_POLICY_VERSION,
            "granted_total": granted_total,
            "available": available,
            "consumed_total": len(consumed),
        }

    async def record_freeze_exception(
        self, actor: ActorContext, local_date: date, scope: str, explanation: str
    ) -> str:
        """Outage/external block: audit-only record, inventory is never spent."""
        self._participant(actor)
        await self.store.record_freeze_exception(actor.person_id, local_date, scope, explanation)
        return service_block_audit(scope=scope, explanation=explanation)

    async def save_weekly_rhythm(
        self,
        actor: ActorContext,
        *,
        preset: str,
        custom_days: tuple[int, ...],
        reminder_hour: int,
        reminder_window_hours: int,
        effective_from: date,
        local_today: date,
    ) -> WeeklyRhythm:
        """Versioned rhythm contract; past effective dates are refused, nothing retroactive."""
        self._participant(actor)
        if effective_from < local_today:
            raise ApiError(
                code="RETROACTIVE_CONTRACT",
                message=(
                    "Дата вступления силы не может быть в прошлом: "
                    "ритм не задним числом закрывает пропуски."
                ),
                status_code=400,
            )
        try:
            active_days = preset_active_days(preset, custom_days)
            history = await self.store.weekly_rhythm_history(actor.person_id)
            rhythm = WeeklyRhythm(
                version=len(history) + 1,
                preset=preset,
                active_days=active_days,
                reminder_hour=reminder_hour,
                reminder_window_hours=reminder_window_hours,
                effective_from=effective_from,
            )
        except WeeklyRhythmError as error:
            raise ApiError(code=error.code, message=str(error), status_code=422) from error
        await self.store.save_weekly_rhythm(actor.person_id, rhythm)
        return rhythm

    async def weekly_rhythm_overview(
        self, actor: ActorContext, *, local_today: date
    ) -> dict[str, object]:
        """Active contract (latest version already in force) plus honest progress."""
        self._participant(actor)
        history = await self.store.weekly_rhythm_history(actor.person_id)
        active_candidates = [item for item in history if item.effective_from <= local_today]
        current = active_candidates[-1] if active_candidates else None
        scheduled = next((item for item in history if item.effective_from > local_today), None)
        if current is None:
            context: dict[str, object] = {"versioned": False}
        else:
            context = await self.weekly_rhythm_snapshot(actor, current, local_today=local_today)
        context["history_count"] = len(history)
        if scheduled is not None:
            context["scheduled_from"] = scheduled.effective_from
            context["scheduled_preset"] = scheduled.preset
        return context

    async def weekly_rhythm_snapshot(
        self, actor: ActorContext, rhythm: WeeklyRhythm, *, local_today: date
    ) -> dict[str, object]:
        """Echo a specific saved rhythm plus honest within-week progress (не серия)."""
        self._participant(actor)
        history = await self.store.weekly_rhythm_history(actor.person_id)
        dates = await self.store.learning_dates(actor.person_id)
        dates |= await self.store.engagement_dates(actor.person_id)
        projection = weekly_rhythm_projection(rhythm, dates, local_today=local_today)
        return {"versioned": True, "history_count": len(history), "projection": projection}

    @staticmethod
    def enrollment_rating_eligible(enrollment: EnrollmentRecord) -> bool:
        return rating_eligible(enrollment.status)
