"""Self-paced Impulse learning progress, distinct from verified provider enrollment.

Only the published eight-unit Impulse demo course family is eligible. Checking a
lesson records participation, not proof of skill. Practical-competency awards
remain exclusively on the verified provider/reviewer track.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session, csrf_session
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter(tags=["bootcamp"])
UNIT_COUNT = 8
ELIGIBLE_KEYS = frozenset(f"demo-course-{number}" for number in range(1, 13))


class ImpulseStudyView(BaseModel):
    course_key: str
    completed_units: int = Field(ge=0, le=8)
    total_units: int = 8
    certificate_id: UUID | None
    finished: bool


def _check_actor(authenticated: AuthenticatedSession, course_key: str) -> None:
    if authenticated.actor.active_role is not Role.PARTICIPANT or course_key not in ELIGIBLE_KEYS:
        raise ApiError(code="NOT_FOUND", message="Курс не найден.", status_code=404)


async def _view(request: Request, person_id: UUID, course_key: str) -> ImpulseStudyView:
    async with request.app.state.database.sessions() as session:
        row = (await session.execute(
            text("SELECT completed_units, certificate_id FROM impulse_course_progress "
                 "WHERE person_id = :person AND course_key = :course"),
            {"person": person_id, "course": course_key},
        )).mappings().one_or_none()
    return ImpulseStudyView(
        course_key=course_key, completed_units=int(row["completed_units"]) if row else 0,
        certificate_id=row["certificate_id"] if row else None,
        finished=bool(row and row["certificate_id"]),
    )


@router.get("/me/bootcamp/impulse-study/{course_key}", response_model=ImpulseStudyView)
async def get_impulse_study(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    request: Request,
) -> ImpulseStudyView:
    _check_actor(authenticated, course_key)
    return await _view(request, authenticated.actor.person_id, course_key)


@router.post("/me/bootcamp/impulse-study/{course_key}/lessons/{index}/complete", response_model=ImpulseStudyView)
async def complete_impulse_lesson(
    course_key: str, index: int,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    request: Request,
) -> ImpulseStudyView:
    _check_actor(authenticated, course_key)
    if index < 0 or index >= UNIT_COUNT:
        raise ApiError(code="INVALID_LESSON", message="Неверный номер урока.", status_code=422)
    person = authenticated.actor.person_id
    async with request.app.state.database.session() as session:
        await session.execute(
            text("INSERT INTO impulse_course_progress(person_id,course_key,completed_units,total_units) "
                 "VALUES (:person,:course,0,8) ON CONFLICT (person_id,course_key) DO NOTHING"),
            {"person": person, "course": course_key},
        )
        changed = (await session.execute(
            text("UPDATE impulse_course_progress SET completed_units = :next, updated_at = now() "
                 "WHERE person_id = :person AND course_key = :course AND completed_units = :current "
                 "RETURNING completed_units"),
            {"person": person, "course": course_key, "current": index, "next": index + 1},
        )).scalar_one_or_none()
        if changed is None:
            actual = (await session.execute(
                text("SELECT completed_units FROM impulse_course_progress "
                     "WHERE person_id = :person AND course_key = :course"),
                {"person": person, "course": course_key},
            )).scalar_one()
            if actual < index + 1:
                raise ApiError(code="LESSON_ORDER", message="Сначала завершите предыдущий урок.", status_code=409)
    return await _view(request, person, course_key)


@router.post("/me/bootcamp/impulse-study/{course_key}/finish", response_model=ImpulseStudyView)
async def finish_impulse_study(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    request: Request,
) -> ImpulseStudyView:
    _check_actor(authenticated, course_key)
    person = authenticated.actor.person_id
    async with request.app.state.database.session() as session:
        result = await session.execute(
            text("UPDATE impulse_course_progress "
                 "SET finished_at = now(), certificate_id = :certificate, updated_at = now() "
                 "WHERE person_id = :person AND course_key = :course "
                 "AND completed_units = 8 AND certificate_id IS NULL"),
            {"person": person, "course": course_key, "certificate": uuid4()},
        )
        if result.rowcount == 0:
            state = (await session.execute(
                text("SELECT completed_units,certificate_id FROM impulse_course_progress "
                     "WHERE person_id = :person AND course_key = :course"),
                {"person": person, "course": course_key},
            )).mappings().one_or_none()
            if not state or state["completed_units"] != 8:
                raise ApiError(code="COURSE_INCOMPLETE", message="Завершите все восемь уроков.", status_code=409)
    return await _view(request, person, course_key)
