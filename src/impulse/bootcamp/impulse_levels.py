"""Authoritative Impulse *learning* levels, independent of career grades.

L0 is the initial level of an enrolled role. L0 -> L1 requires every
published role course and at least one independently approved practical
certificate. Later cycles need separately published curriculum; old
certificates MUST NOT be replayed as evidence for a new level.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp.editorial_learning import ELIGIBLE_KEYS, impulse_study_summary
from impulse.domain.identity import Role

router = APIRouter(tags=["bootcamp"])
POLICY_VERSION = 1
PRACTICE_MINIMUM = 1


class ImpulseLevelView(BaseModel):
    track_key: str
    level: int = Field(ge=0)
    cycle_number: int = Field(ge=1)
    curriculum_state: Literal["published", "unpublished"]
    completed_courses: int = Field(ge=0)
    required_courses: int = Field(ge=0)
    approved_practices: int = Field(ge=0)
    required_practices: int = Field(ge=1)
    advance_ready: bool
    history: list[dict[str, object]] = Field(default_factory=list)
    policy_version: int = POLICY_VERSION


async def _actor_track(
    request: Request, authenticated: AuthenticatedSession, track_key: str
) -> None:
    if authenticated.actor.active_role is not Role.PARTICIPANT:
        raise ApiError(code="FORBIDDEN", message="Доступно только участнику.", status_code=403)
    attempts = await request.app.state.development_service.store.attempts(
        authenticated.actor.person_id
    )
    if not any(attempt.track_key == track_key for attempt in attempts):
        raise ApiError(
            code="ROLE_NOT_SELECTED", message="Сначала выберите направление.", status_code=409
        )


async def _evidence(
    request: Request, authenticated: AuthenticatedSession, track_key: str
) -> tuple[int, int, int, tuple[str, ...]]:
    courses = await request.app.state.development_service.store.courses()
    keys = tuple(
        sorted(
            course.key
            for course in courses
            if track_key in course.track_keys and course.key in ELIGIBLE_KEYS
        )
    )
    summary = await impulse_study_summary(authenticated, request)
    verified_by_key = {course.course_key: course for course in summary.courses}
    finished = sum(verified_by_key[key].finished for key in keys if key in verified_by_key)
    approved = sum(
        verified_by_key[key].practical_certificate_id is not None
        for key in keys
        if key in verified_by_key
    )
    return finished, len(keys), approved, keys


async def _saved(
    request: Request, person_id: UUID, track_key: str
) -> tuple[int, int, list[dict[str, object]]]:
    async with request.app.state.database.sessions() as session:
        row = (
            (
                await session.execute(
                    text(
                        "SELECT level, cycle_number, history FROM impulse_role_levels "
                        "WHERE person_id = :person AND track_key = :track"
                    ),
                    {"person": person_id, "track": track_key},
                )
            )
            .mappings()
            .one_or_none()
        )
    if row is None:
        return 0, 1, []
    return int(row["level"]), int(row["cycle_number"]), list(row["history"])


async def _project(
    request: Request, authenticated: AuthenticatedSession, track_key: str
) -> ImpulseLevelView:
    await _actor_track(request, authenticated, track_key)
    level, cycle, history = await _saved(request, authenticated.actor.person_id, track_key)
    # Only the first-cycle curriculum has been published. Past certificates
    # cannot automatically count in a future cycle.
    if level > 0:
        return ImpulseLevelView(
            track_key=track_key,
            level=level,
            cycle_number=cycle,
            curriculum_state="unpublished",
            completed_courses=0,
            required_courses=0,
            approved_practices=0,
            required_practices=PRACTICE_MINIMUM,
            advance_ready=False,
            history=history,
        )
    finished, required, approved, _keys = await _evidence(request, authenticated, track_key)
    return ImpulseLevelView(
        track_key=track_key,
        level=level,
        cycle_number=cycle,
        curriculum_state="published" if required > 0 else "unpublished",
        completed_courses=finished,
        required_courses=required,
        approved_practices=approved,
        required_practices=PRACTICE_MINIMUM,
        advance_ready=required > 0 and finished == required and approved >= PRACTICE_MINIMUM,
        history=history,
    )


@router.get("/me/bootcamp/impulse-level", response_model=ImpulseLevelView)
async def impulse_level(
    track: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    request: Request,
) -> ImpulseLevelView:
    return await _project(request, authenticated, track)


@router.post("/me/bootcamp/impulse-level/advance", response_model=ImpulseLevelView)
async def advance_impulse_level(
    track: str,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    request: Request,
) -> ImpulseLevelView:
    await _actor_track(request, authenticated, track)
    current = await _project(request, authenticated, track)
    if current.curriculum_state != "published":
        raise ApiError(
            code="IMPULSE_CURRICULUM_UNPUBLISHED",
            message="Программа следующего уровня ещё не опубликована.",
            status_code=409,
        )
    if not current.advance_ready:
        raise ApiError(
            code="IMPULSE_LEVEL_NOT_READY",
            message="Завершите курсы и получите проверенное практическое подтверждение.",
            status_code=409,
        )
    person = authenticated.actor.person_id
    async with request.app.state.database.session() as session:
        # One row per participant/role is locked for atomic, one-time award.
        await session.execute(
            text(
                "INSERT INTO impulse_role_levels (person_id,track_key,level,cycle_number) "
                "VALUES (:person,:track,0,1) ON CONFLICT (person_id,track_key) DO NOTHING"
            ),
            {"person": person, "track": track},
        )
        row = (
            (
                await session.execute(
                    text(
                        "SELECT level FROM impulse_role_levels "
                        "WHERE person_id=:person AND track_key=:track FOR UPDATE"
                    ),
                    {"person": person, "track": track},
                )
            )
            .mappings()
            .one()
        )
        if int(row["level"]) == 0:
            await session.execute(
                text(
                    "UPDATE impulse_role_levels "
                    "SET level=1, cycle_number=2, advanced_at=now(), "
                    "history=history || jsonb_build_array(jsonb_build_object("
                    "'from',0,'to',1,'policy_version',:version,"
                    "'completed_courses',:courses,'approved_practices',:practices,"
                    "'awarded_at',now())) "
                    "WHERE person_id=:person AND track_key=:track AND level=0"
                ),
                {
                    "person": person,
                    "track": track,
                    "version": POLICY_VERSION,
                    "courses": current.completed_courses,
                    "practices": current.approved_practices,
                },
            )
        # An overlapping request cannot award a second level or repeat proofs.
    return await _project(request, authenticated, track)
