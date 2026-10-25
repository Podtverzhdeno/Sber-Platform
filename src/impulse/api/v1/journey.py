"""Authorized cross-section read model for one participant.

This endpoint joins existing domain facts without creating grades, verified
skills, scores or credentials. "Finished self-study" is NOT "verified course".
Every relationship is keyed by canonical entity IDs, never by course title.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp.editorial_learning import ImpulseStudySummary, impulse_study_summary
from impulse.domain.development import CompletionStatus
from impulse.domain.identity import Role
from impulse.domain.work import ContributionStatus

router = APIRouter(tags=["journey"])


class StudyEvidenceView(BaseModel):
    completed_units: int = Field(ge=0)
    total_units: int = Field(ge=1)
    finished: bool
    finished_at: datetime | None
    certificate_id: UUID | None
    practice_status: str | None
    practical_certificate_id: UUID | None
    source_updated_at: datetime


class RoadmapEvidenceLink(BaseModel):
    track_key: str
    policy_version: int
    milestone_key: str
    milestone_completed: bool


class JourneyCourseView(BaseModel):
    course_key: str
    title: str
    self_study: StudyEvidenceView | None
    provider_status: CompletionStatus | None
    provider_verified: bool
    roadmap_links: list[RoadmapEvidenceLink]


class JourneyProjectView(BaseModel):
    assignment_id: UUID
    task_id: UUID
    title: str
    assignment_status: str
    submitted_contribution_ids: list[UUID]
    accepted_contribution_ids: list[UUID]


class JourneyRatingView(BaseModel):
    season_id: UUID
    season_version: int
    policy_version: int | None
    place: int
    points: Decimal
    successful_projects: int
    trophy_titles: list[str]
    verified_offer_titles: list[str]


class JourneySnapshotView(BaseModel):
    """Null means not available; zero is reserved for a known empty collection."""

    person_id: UUID
    observed_at: datetime
    self_study_available: bool
    courses: list[JourneyCourseView]
    projects: list[JourneyProjectView]
    ratings: list[JourneyRatingView]
    published_rating_seasons: int
    accepted_case_count: int
    verified_provider_course_count: int


def _merge_courses(
    *,
    catalog: tuple[object, ...],
    enrollments: tuple[object, ...],
    roadmaps: tuple[object, ...],
    study: ImpulseStudySummary | None,
) -> list[JourneyCourseView]:
    """Canonical course_key joins; unknown self-study stays unknown, not 0."""
    names = {item.key: item.title for item in catalog}
    providers = {item.course_key: item.status for item in enrollments}
    study_by_key = {item.course_key: item for item in study.courses} if study is not None else {}
    links: dict[str, list[RoadmapEvidenceLink]] = {}
    for roadmap in roadmaps:
        for milestone in roadmap.milestones:
            if milestone.target_kind != "course":
                continue
            links.setdefault(milestone.target_key, []).append(
                RoadmapEvidenceLink(
                    track_key=roadmap.track_key,
                    policy_version=roadmap.policy_version,
                    milestone_key=milestone.key,
                    milestone_completed=milestone.key in roadmap.completed_keys,
                )
            )
    all_keys = set(names) | set(providers) | set(study_by_key)
    return [
        JourneyCourseView(
            course_key=key,
            title=names.get(key, key),
            self_study=(
                StudyEvidenceView(
                    completed_units=study_by_key[key].completed_units,
                    total_units=study_by_key[key].total_units,
                    finished=study_by_key[key].finished,
                    finished_at=study_by_key[key].finished_at,
                    certificate_id=study_by_key[key].certificate_id,
                    practice_status=study_by_key[key].practice_status,
                    practical_certificate_id=study_by_key[key].practical_certificate_id,
                    source_updated_at=study_by_key[key].updated_at,
                )
                if key in study_by_key
                else None
            ),
            provider_status=providers.get(key),
            provider_verified=providers.get(key) is CompletionStatus.VERIFIED,
            roadmap_links=links.get(key, []),
        )
        for key in sorted(all_keys)
    ]


@router.get("/me/journey/snapshot", response_model=JourneySnapshotView)
async def my_journey_snapshot(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> JourneySnapshotView:
    """Read participant-owned state; never expose another person's evidence."""
    actor = authenticated.actor
    if actor.active_role is not Role.PARTICIPANT:
        raise ApiError(
            code="RESOURCE_NOT_FOUND",
            message="Resource not found.",
            status_code=404,
        )

    development = request.app.state.development_service
    work = request.app.state.work_service
    recognition = request.app.state.recognition_service

    catalog, enrollments, roadmaps, work_items, cases, seasons = await asyncio.gather(
        development.store.courses(),
        development.store.enrollments(actor.person_id),
        development.catalog_roadmaps(actor),
        work.participant_work(actor),
        work.participant_case_evidence(actor),
        recognition.public_seasons(),
    )

    # Self-study is a separate SQL-backed subsystem. A missing study database
    # must not be presented as "0 lessons" or silently imply no achievements.
    study = (
        await impulse_study_summary(authenticated, request)
        if getattr(request.app.state, "database", None) is not None
        else None
    )

    projects = [
        JourneyProjectView(
            assignment_id=item.assignment.id,
            task_id=item.task.aggregate.task_id,
            title=item.task.title,
            assignment_status=item.assignment.status.value,
            submitted_contribution_ids=[
                contribution.id
                for contribution in item.contributions
                if contribution.status is not ContributionStatus.ACCEPTED
            ],
            accepted_contribution_ids=[
                contribution.id for contribution in item.contributions
                if contribution.status is ContributionStatus.ACCEPTED
            ],
        )
        for item in work_items
    ]

    ratings: list[JourneyRatingView] = []
    for season in seasons:
        # The same public/consent filter as the rating page and TopbarRank:
        # anonymized entries cannot be matched by person_id.
        standings = await recognition.leaderboard(season.season_id)
        for entry in standings:
            if entry.anonymized or entry.person_id != actor.person_id:
                continue
            ratings.append(
                JourneyRatingView(
                    season_id=season.season_id,
                    season_version=season.version,
                    policy_version=season.policy_version,
                    place=entry.place,
                    points=entry.score,
                    successful_projects=entry.successful_projects,
                    trophy_titles=[trophy.title for trophy in entry.trophies],
                    verified_offer_titles=[offer.event_title for offer in entry.offers],
                )
            )

    return JourneySnapshotView(
        person_id=actor.person_id,
        observed_at=datetime.now(UTC),
        self_study_available=study is not None,
        courses=_merge_courses(
            catalog=catalog, enrollments=enrollments, roadmaps=roadmaps, study=study
        ),
        projects=projects,
        ratings=ratings,
        published_rating_seasons=len(seasons),
        accepted_case_count=len(cases),
        verified_provider_course_count=sum(
            enrollment.status is CompletionStatus.VERIFIED for enrollment in enrollments
        ),
    )
