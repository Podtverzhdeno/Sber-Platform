"""Authoritative Impulse *learning* levels, independent of career grades.

Each enrolled role starts at L0. Three published cycles lead to L3:
L0 → L1 (foundation), L1 → L2 (architecture / evaluation),
L2 → L3 (operations / orchestration). All require separate course certificates
and independently reviewed practical evidence. Old cycle or other role credits
never substitute for the current requirements.
"""

from __future__ import annotations

import json
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
POLICY_VERSION = 2
PRACTICE_MINIMUM = 1
MAX_LEVEL = 3
ADVANCED_CYCLES = {1: (13, 14), 2: (15, 16)}


def _empty_history() -> list[dict[str, object]]:
    return []


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
    history: list[dict[str, object]] = Field(default_factory=_empty_history)
    policy_version: int = POLICY_VERSION
    max_level: int = MAX_LEVEL
    required_course_keys: list[str] = Field(default_factory=list)


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
    request: Request, authenticated: AuthenticatedSession, track_key: str, level: int = 0
) -> tuple[int, int, int, tuple[str, ...]]:
    courses = await request.app.state.development_service.store.courses()
    # Every cycle uses disjoint DB course keys. This prevents replay of an old
    # certificate (including one awarded for the same role at L0).
    if level == 0:
        keys = tuple(sorted(
            course.key for course in courses
            if track_key in course.track_keys and course.key in ELIGIBLE_KEYS
            and course.key.count("-") == 2  # demo-course-1 through demo-course-12
        ))
    else:
        required = {f"demo-course-{index}-{track_key}" for index in ADVANCED_CYCLES.get(level, ())}
        keys = tuple(sorted(
            course.key for course in courses if course.key in required
            and track_key in course.track_keys
        ))
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
    # L3 is the attained program ceiling, not a fabricated L4 curriculum.
    if level >= MAX_LEVEL:
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
    finished, required, approved, keys = await _evidence(request, authenticated, track_key, level)
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
        required_course_keys=list(keys),
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
    # L3 is the maximum published level. Reads never advance progress.
    if current.level >= MAX_LEVEL:
        return current
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
        # Stale or overlapping requests cannot award a second level from the
        # same evidence snapshot. A client must re-read the new curriculum first.
        if int(row["level"]) == current.level and current.advance_ready:
            await session.execute(
                text(
                    "UPDATE impulse_role_levels "
                    "SET level=:next, cycle_number=:cycle, advanced_at=now(), "
                    "policy_version=:version, "
                    "history=history || jsonb_build_array(jsonb_build_object("
                    "'from',:old,'to',:next,'policy_version',:version,"
                    "'completed_courses',:courses,'approved_practices',:practices,"
                    "'course_keys',CAST(:course_keys AS jsonb),'awarded_at',now())) "
                    "WHERE person_id=:person AND track_key=:track AND level=:old"
                ),
                {
                    "person": person,
                    "track": track,
                    "old": current.level,
                    "next": current.level + 1,
                    "cycle": current.level + 2,
                    "version": POLICY_VERSION,
                    "courses": current.completed_courses,
                    "practices": current.approved_practices,
                    "course_keys": json.dumps(current.required_course_keys),
                },
            )
        # A repeated POST is idempotent for the already awarded level.
    return await _project(request, authenticated, track)
