"""PostgreSQL adapter for career tracks, roadmaps and Bootcamp progress."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from impulse.api.errors import ApiError
from impulse.application.development import (
    CourseRecord,
    DevelopmentStore,
    EnrollmentRecord,
    RoadmapRecord,
    TrackRecord,
)
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    TrackAttempt,
    TrackStatus,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.development import (
    course_track_links,
    courses,
    enrollments,
    learning_days,
    milestones,
    roadmap_versions,
    track_attempts,
    tracks,
)


class SqlDevelopmentStore(DevelopmentStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def tracks(self) -> tuple[TrackRecord, ...]:
        async with self.database.sessions() as session:
            rows = (await session.execute(select(tracks).order_by(tracks.c.title))).mappings()
            return tuple(TrackRecord(row["slug"], row["title"]) for row in rows)

    async def attempts(self, person_id: UUID) -> tuple[TrackAttempt, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(
                        tracks.c.slug,
                        track_attempts.c.attempt_number,
                        track_attempts.c.status,
                        track_attempts.c.payload,
                    )
                    .join(tracks, tracks.c.id == track_attempts.c.track_id)
                    .where(track_attempts.c.person_id == person_id)
                    .order_by(track_attempts.c.created_at)
                )
            ).all()
        return tuple(
            TrackAttempt(
                track_key=slug,
                attempt_number=attempt_number,
                status=TrackStatus(status),
                completed_milestones=frozenset(payload.get("completed_milestones", [])),
            )
            for slug, attempt_number, status, payload in rows
        )

    async def replace_attempts(self, person_id: UUID, attempts: tuple[TrackAttempt, ...]) -> None:
        async with self.database.session() as session:
            track_rows = (await session.execute(select(tracks.c.id, tracks.c.slug))).all()
            ids = {slug: track_id for track_id, slug in track_rows}
            for attempt in attempts:
                track_id = ids.get(attempt.track_key)
                if track_id is None:
                    raise ApiError(
                        code="RESOURCE_NOT_FOUND",
                        message="Resource not found.",
                        status_code=404,
                    )
                await session.execute(
                    postgres_insert(track_attempts)
                    .values(
                        person_id=person_id,
                        track_id=track_id,
                        attempt_number=attempt.attempt_number,
                        status=attempt.status.value,
                        data_origin="demo_runtime",
                        payload={"completed_milestones": sorted(attempt.completed_milestones)},
                        created_by=person_id,
                    )
                    .on_conflict_do_update(
                        constraint="uq_track_attempts_person_id_track_id_attempt_number",
                        set_={
                            "status": attempt.status.value,
                            "payload": {
                                "completed_milestones": sorted(attempt.completed_milestones)
                            },
                            "version": track_attempts.c.version + 1,
                        },
                    )
                )

    async def roadmap(self, track_key: str) -> RoadmapRecord | None:
        async with self.database.sessions() as session:
            roadmap = (
                await session.execute(
                    select(
                        roadmap_versions.c.id,
                        roadmap_versions.c.policy_version,
                    )
                    .join(tracks, tracks.c.id == roadmap_versions.c.track_id)
                    .where(tracks.c.slug == track_key)
                    .order_by(roadmap_versions.c.policy_version.desc())
                    .limit(1)
                )
            ).one_or_none()
            if roadmap is None:
                return None
            roadmap_id, policy_version = roadmap
            rows = (
                await session.execute(
                    select(milestones)
                    .where(milestones.c.roadmap_version_id == roadmap_id)
                    .order_by(milestones.c.position)
                )
            ).mappings()
            items = tuple(
                RoadmapMilestone(
                    key=row["milestone_key"],
                    position=row["position"],
                    title=str(row["payload"].get("title", row["milestone_key"])),
                    purpose=str(
                        row["payload"].get(
                            "purpose", "Подготовиться к следующему практическому шагу."
                        )
                    ),
                    skill=str(row["payload"].get("skill", "Профессиональная основа")),
                    target_kind=str(row["payload"].get("target_kind", "course")),
                    target_key=str(row["payload"].get("target_key", "demo-course-1")),
                )
                for row in rows
            )
        return RoadmapRecord(track_key, policy_version, items)

    async def courses(self) -> tuple[CourseRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                (
                    await session.execute(
                        select(courses, tracks.c.slug)
                        .outerjoin(
                            course_track_links, course_track_links.c.course_id == courses.c.id
                        )
                        .outerjoin(tracks, tracks.c.id == course_track_links.c.track_id)
                        .order_by(courses.c.title)
                    )
                )
                .mappings()
                .all()
            )
        grouped: dict[UUID, tuple[dict[str, Any], list[str]]] = {}
        for row in rows:
            course_id = row["id"]
            if course_id not in grouped:
                grouped[course_id] = (dict(row), [])
            if row["slug_1"] is not None:
                grouped[course_id][1].append(str(row["slug_1"]))
        return tuple(
            CourseRecord(
                key=str(row["slug"]),
                title=str(row["title"]),
                track_keys=tuple(linked_tracks),
                source_url=str(
                    row["payload"].get("source_url", f"https://example.test/courses/{row['slug']}")
                ),
                availability=str(row["payload"].get("availability", "available")),
                access_note=str(
                    row["payload"].get("access_note", "Демо-каталог корпоративного обучения.")
                ),
            )
            for row, linked_tracks in grouped.values()
        )

    async def enrollments(self, person_id: UUID) -> tuple[EnrollmentRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(courses.c.slug, enrollments.c.status)
                    .join(courses, courses.c.id == enrollments.c.course_id)
                    .where(enrollments.c.person_id == person_id)
                )
            ).all()
        return tuple(
            EnrollmentRecord(slug, CompletionStatus(status))
            for slug, status in rows
            if status in set(CompletionStatus)
        )

    async def report_completion(self, person_id: UUID, course_key: str) -> EnrollmentRecord:
        async with self.database.session() as session:
            course_id = await session.scalar(
                select(courses.c.id).where(courses.c.slug == course_key)
            )
            if course_id is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            await session.execute(
                postgres_insert(enrollments)
                .values(
                    person_id=person_id,
                    course_id=course_id,
                    attempt_number=1,
                    status=CompletionStatus.REPORTED.value,
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_update(
                    constraint="uq_enrollments_person_id_course_id_attempt_number",
                    set_={
                        "status": CompletionStatus.REPORTED.value,
                        "version": enrollments.c.version + 1,
                    },
                )
            )
        return EnrollmentRecord(course_key, CompletionStatus.REPORTED)

    async def record_learning_day(
        self, person_id: UUID, course_key: str, local_date: date, timezone: str
    ) -> None:
        async with self.database.session() as session:
            course_id = await session.scalar(
                select(courses.c.id).where(courses.c.slug == course_key)
            )
            if course_id is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            enrollment_id = await session.scalar(
                select(enrollments.c.id).where(
                    enrollments.c.person_id == person_id,
                    enrollments.c.course_id == course_id,
                    enrollments.c.attempt_number == 1,
                )
            )
            if enrollment_id is None:
                result = await session.execute(
                    postgres_insert(enrollments)
                    .values(
                        person_id=person_id,
                        course_id=course_id,
                        attempt_number=1,
                        status="in_progress",
                        data_origin="demo_runtime",
                        created_by=person_id,
                    )
                    .returning(enrollments.c.id)
                )
                enrollment_id = result.scalar_one()
            await session.execute(
                postgres_insert(learning_days)
                .values(
                    enrollment_id=enrollment_id,
                    local_date=local_date,
                    timezone=timezone,
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_nothing(constraint="uq_learning_days_enrollment_id_local_date")
            )

    async def learning_dates(self, person_id: UUID) -> frozenset[date]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(learning_days.c.local_date)
                    .join(enrollments, enrollments.c.id == learning_days.c.enrollment_id)
                    .where(enrollments.c.person_id == person_id)
                    .distinct()
                )
            ).scalars()
            return frozenset(rows)
