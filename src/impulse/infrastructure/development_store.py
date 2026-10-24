"""PostgreSQL adapter for career tracks, roadmaps and Bootcamp progress."""

from __future__ import annotations

from datetime import date, datetime
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
from impulse.bootstrap.ai_curriculum_details import AI_CURRICULUM_DETAILS, learning_details
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    TrackAttempt,
    TrackStatus,
)
from impulse.domain.engagement import EngagementSource, WeeklyRhythm
from impulse.domain.monthly_goal import MonthlyGoalPlan
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.development import (
    course_track_links,
    courses,
    enrollments,
    freeze_days,
    freeze_exceptions,
    learning_days,
    milestones,
    monthly_goal_plans,
    qualification_events,
    roadmap_versions,
    track_attempts,
    tracks,
    weekly_rhythm_versions,
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
                    activities=tuple(
                        str(item)
                        for item in row["payload"].get("activities", [])
                        if isinstance(item, str)
                    ),
                    deliverable=(
                        str(row["payload"]["deliverable"])
                        if row["payload"].get("deliverable")
                        else None
                    ),
                    theory=tuple(
                        str(topic)
                        for topic in row["payload"].get("theory", [])
                        if isinstance(topic, str)
                    ),
                    lab=(
                        str(learning_details(track_key, int(row["position"]))["lab"])
                        if row["data_origin"] == "demo_seed"
                        and track_key in AI_CURRICULUM_DETAILS
                        and 1 <= int(row["position"]) <= len(AI_CURRICULUM_DETAILS[track_key])
                        else str(row["payload"]["lab"])
                        if row["payload"].get("lab")
                        else None
                    ),
                    acceptance=tuple(
                        str(check)
                        for check in row["payload"].get("acceptance", [])
                        if isinstance(check, str)
                    ),
                    estimated_hours=(
                        int(row["payload"]["estimated_hours"])
                        if isinstance(row["payload"].get("estimated_hours"), int)
                        else None
                    ),
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

    async def record_engagement_event(
        self,
        person_id: UUID,
        source: EngagementSource,
        source_ref: str,
        local_date: date,
        timezone: str,
    ) -> None:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(qualification_events)
                .values(
                    person_id=person_id,
                    source=source.value,
                    source_ref=source_ref,
                    local_date=local_date,
                    timezone=timezone,
                    data_origin="qualified_action",
                    created_by=person_id,
                )
                .on_conflict_do_nothing(
                    constraint="uq_qualification_events_person_id_source_source_ref"
                )
            )

    async def engagement_dates(self, person_id: UUID) -> frozenset[date]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(qualification_events.c.local_date)
                    .where(qualification_events.c.person_id == person_id)
                    .distinct()
                )
            ).scalars()
            return frozenset(rows)

    async def freeze_counts(self, person_id: UUID) -> tuple[int, int, frozenset[date]]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(freeze_days.c.local_date, freeze_days.c.status).where(
                        freeze_days.c.person_id == person_id,
                        freeze_days.c.status.in_(("available", "consumed")),
                    )
                )
            ).mappings()
        status_by_date: list[tuple[date | None, str]] = [
            (row["local_date"], row["status"]) for row in rows
        ]
        granted = len(status_by_date)
        available = sum(1 for entry in status_by_date if entry[1] == "available")
        consumed_dates = frozenset(
            entry[0] for entry in status_by_date if entry[1] == "consumed" and entry[0] is not None
        )
        return granted, available, consumed_dates

    async def grant_freeze_day(self, person_id: UUID, granted_at: datetime, rule: str) -> None:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(freeze_days).values(
                    person_id=person_id,
                    local_date=None,
                    status="available",
                    data_origin=rule,
                    created_by=person_id,
                )
            )

    async def consume_freeze_day(self, person_id: UUID, local_date: date) -> bool:
        async with self.database.session() as session:
            candidate = await session.execute(
                select(freeze_days.c.id)
                .where(freeze_days.c.person_id == person_id, freeze_days.c.status == "available")
                .order_by(freeze_days.c.created_at)
                .limit(1)
            )
            row_id = candidate.scalar_one_or_none()
            if row_id is None:
                return False
            await session.execute(
                freeze_days.update()
                .where(freeze_days.c.id == row_id)
                .values(status="consumed", local_date=local_date)
            )
            return True

    async def record_freeze_exception(
        self, person_id: UUID, local_date: date, scope: str, explanation: str
    ) -> None:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(freeze_exceptions).values(
                    person_id=person_id,
                    local_date=local_date,
                    scope=scope,
                    explanation=explanation,
                    data_origin="service_block",
                    created_by=person_id,
                )
            )

    async def freeze_exceptions(self, person_id: UUID) -> tuple[str, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(freeze_exceptions.c.scope, freeze_exceptions.c.explanation)
                    .where(freeze_exceptions.c.person_id == person_id)
                    .order_by(freeze_exceptions.c.created_at)
                )
            ).mappings()
        return tuple(f"{row['scope']}:{row['explanation']}" for row in rows)

    async def weekly_rhythm_history(self, person_id: UUID) -> tuple[WeeklyRhythm, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(
                        weekly_rhythm_versions.c.rhythm_version,
                        weekly_rhythm_versions.c.preset,
                        weekly_rhythm_versions.c.active_days,
                        weekly_rhythm_versions.c.reminder_hour,
                        weekly_rhythm_versions.c.reminder_window_hours,
                        weekly_rhythm_versions.c.effective_from,
                    )
                    .where(weekly_rhythm_versions.c.person_id == person_id)
                    .order_by(weekly_rhythm_versions.c.rhythm_version)
                )
            ).mappings()
        rhythms = tuple(
            WeeklyRhythm(
                version=row["rhythm_version"],
                preset=row["preset"],
                active_days=frozenset(int(day) for day in row["active_days"].split(",") if day),
                reminder_hour=row["reminder_hour"],
                reminder_window_hours=row["reminder_window_hours"],
                effective_from=row["effective_from"],
            )
            for row in rows
        )
        return rhythms

    async def save_weekly_rhythm(self, person_id: UUID, rhythm: WeeklyRhythm) -> None:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(weekly_rhythm_versions).values(
                    person_id=person_id,
                    rhythm_version=rhythm.version,
                    preset=rhythm.preset,
                    active_days=",".join(str(day) for day in sorted(rhythm.active_days)),
                    reminder_hour=rhythm.reminder_hour,
                    reminder_window_hours=rhythm.reminder_window_hours,
                    effective_from=rhythm.effective_from,
                    data_origin=f"weekly_rhythm_v{rhythm.version}",
                    created_by=person_id,
                )
            )

    async def monthly_goal_history(
        self, person_id: UUID, period: date
    ) -> tuple[MonthlyGoalPlan, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(
                        monthly_goal_plans.c.plan_version,
                        monthly_goal_plans.c.period,
                        monthly_goal_plans.c.track_key,
                        monthly_goal_plans.c.milestone_key,
                        monthly_goal_plans.c.baseline_count,
                        monthly_goal_plans.c.created_by,
                    )
                    .where(
                        monthly_goal_plans.c.person_id == person_id,
                        monthly_goal_plans.c.period == period,
                    )
                    .order_by(monthly_goal_plans.c.plan_version)
                )
            ).mappings()
        return tuple(
            MonthlyGoalPlan(
                period=row["period"],
                plan_version=row["plan_version"],
                track_key=row["track_key"],
                milestone_key=row["milestone_key"],
                baseline_count=row["baseline_count"],
                created_by=str(row["created_by"]) if row["created_by"] else None,
            )
            for row in rows
        )

    async def save_monthly_goal(self, person_id: UUID, plan: MonthlyGoalPlan) -> None:
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(monthly_goal_plans).values(
                    person_id=person_id,
                    period=plan.period,
                    plan_version=plan.plan_version,
                    track_key=plan.track_key,
                    milestone_key=plan.milestone_key,
                    baseline_count=plan.baseline_count,
                    created_by=person_id,
                    data_origin=f"monthly_goal_v{plan.plan_version}",
                )
            )
