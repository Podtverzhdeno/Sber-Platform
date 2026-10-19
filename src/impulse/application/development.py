"""Participant career and Bootcamp use cases."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol, TypedDict
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
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
from impulse.domain.identity import ActorContext, Role


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
                "https://example.test/courses/openspec",
                "available",
                "Доступен в демо без регистрации во внешней LMS.",
            ),
            CourseRecord(
                "agent-development",
                "Агентная разработка",
                ("python", "ml"),
                "https://example.test/courses/agents",
                "available",
                "Рекомендуется после основ OpenSpec.",
            ),
            CourseRecord(
                "python-base",
                "Python: основа",
                ("python", "data", "ml"),
                "https://example.test/courses/python",
                "unavailable",
                "Внешний курс пока не подключён; доступна исходная ссылка.",
            ),
        )
        self._enrollments: dict[tuple[UUID, str], EnrollmentRecord] = {}
        self._seed_person_id: UUID | None = None
        self._days: dict[UUID, frozenset[date]] = {}

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

    @staticmethod
    def enrollment_rating_eligible(enrollment: EnrollmentRecord) -> bool:
        return rating_eligible(enrollment.status)
