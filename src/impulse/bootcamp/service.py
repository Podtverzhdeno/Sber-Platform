"""Bootcamp catalog service composing real stores into explainable projections.

The projection keeps the three card measurements independent: access,
completion/verification and recommendation. It is a read model, so role
limits stay at the API boundary and the service only guards the participant
persona consistently with the development use cases.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol
from uuid import UUID

from impulse.api.errors import ApiError
from impulse.application.competencies import FrameworkReport
from impulse.application.development import DevelopmentStore
from impulse.bootcamp.catalog import (
    CourseCard,
    MilestoneOnTrajectory,
    SkillPosition,
    project_cards,
)
from impulse.domain.competencies import UNKNOWN_LEVEL
from impulse.domain.development import CompletionStatus, TrackStatus
from impulse.domain.identity import ActorContext, Role


class CompetencyReportsStore(Protocol):
    """Narrow read surface of the competency application service."""

    async def person_reports(self, person_id: UUID) -> tuple[FrameworkReport, ...]: ...


def _skill_positions(reports: tuple[FrameworkReport, ...]) -> dict[str, SkillPosition]:
    positions: dict[str, SkillPosition] = {}
    for report in reports:
        for skill in report.skills:
            positions[skill.skill.key.lower()] = SkillPosition(
                skill_key=skill.skill.key,
                title=skill.skill.title,
                current_level=skill.level,
                known=skill.level != UNKNOWN_LEVEL,
            )
    return positions


class BootcampCatalogService:
    """Read projection of the Bootcamp catalog for one participant."""

    def __init__(
        self, development: DevelopmentStore, competencies: CompetencyReportsStore | None = None
    ) -> None:
        self.development = development
        self.competencies = competencies

    @staticmethod
    def _participant(actor: ActorContext) -> None:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError(
                code="FORBIDDEN", message="Каталог Bootcamp доступен участнику.", status_code=403
            )

    async def catalog(self, actor: ActorContext) -> tuple[CourseCard, ...]:
        """Project every catalog card with independent state dimensions."""
        self._participant(actor)
        courses = await self.development.courses()
        enrollments = await self.development.enrollments(actor.person_id)
        status_by_course: dict[str, CompletionStatus | None] = {
            course.key: None for course in courses
        }
        verified = frozenset(
            item.course_key for item in enrollments if item.status is CompletionStatus.VERIFIED
        )
        for item in enrollments:
            if item.course_key in status_by_course:
                status_by_course[item.course_key] = item.status
        milestones_by_course = await self._milestones_by_course(actor.person_id)
        reports = (
            ()
            if self.competencies is None
            else await self.competencies.person_reports(actor.person_id)
        )
        return project_cards(
            courses,
            enrollment_status=status_by_course,
            milestones_by_course=milestones_by_course,
            verified_courses=verified,
            skill_positions=_skill_positions(reports),
            titles={course.key: course.title for course in courses},
        )

    async def _milestones_by_course(
        self, person_id: UUID
    ) -> dict[str, tuple[MilestoneOnTrajectory, ...]]:
        attempts = await self.development.attempts(person_id)
        track_titles: Mapping[str, str] = {
            item.key: item.title for item in await self.development.tracks()
        }
        by_course: dict[str, list[MilestoneOnTrajectory]] = {}
        for attempt in attempts:
            # Supplementary study is an enrolled path as well.  Archived and
            # frozen paths must not appear in the learner's current recommendations.
            if attempt.status not in (TrackStatus.ACTIVE, TrackStatus.EXPLORING):
                continue
            record = await self.development.roadmap(attempt.track_key)
            if record is None:
                continue
            track_title = track_titles.get(attempt.track_key, attempt.track_key)
            for milestone in record.milestones:
                if milestone.target_kind != "course":
                    continue
                by_course.setdefault(milestone.target_key, []).append(
                    MilestoneOnTrajectory(
                        milestone=milestone,
                        track_key=attempt.track_key,
                        track_title=track_title,
                        completed=milestone.key in attempt.completed_milestones,
                    )
                )
        return {key: tuple(items) for key, items in by_course.items()}


__all__ = [
    "BootcampCatalogService",
    "CompetencyReportsStore",
]
