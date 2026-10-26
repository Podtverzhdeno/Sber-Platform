"""PostgreSQL regression: L0→L1→L2→L3 requires fresh, role-bound verified evidence."""

from __future__ import annotations

import os
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from fastapi import Request
from sqlalchemy import text

from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp import impulse_levels
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.identity import ActorContext, Role
from impulse.infrastructure.database import Database


@pytest.mark.asyncio
async def test_real_database_three_cycles_never_replay_certificates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Requires migrated PostgreSQL TEST_DATABASE_URL")
    database = Database(url)
    person = uuid4()
    actor = ActorContext(
        person_id=person,
        display_name="Cycle learner",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="test",
        consent_scopes=frozenset(),
    )

    async def attempts(_person: object) -> tuple[TrackAttempt, ...]:
        return (TrackAttempt("python", 1, TrackStatus.ACTIVE),)

    async def courses() -> tuple[SimpleNamespace, ...]:
        return tuple(
            [SimpleNamespace(key=f"demo-course-{i}", track_keys=("python",)) for i in (1, 2)]
            + [
                SimpleNamespace(key=f"demo-course-{i}-python", track_keys=("python",))
                for i in (13, 14, 15, 16)
            ]
            + [SimpleNamespace(key="demo-course-13-data", track_keys=("data",))]
        )

    async def summary(_auth: object, _request: object) -> SimpleNamespace:
        async with database.sessions() as session:
            rows = (
                (
                    await session.execute(
                        text(
                            "SELECT p.course_key, p.certificate_id, s.practical_certificate_id, "
                            "s.status AS practice_status "
                            "FROM impulse_course_progress p "
                            "LEFT JOIN impulse_practical_submissions s "
                            "ON s.person_id=p.person_id AND s.course_key=p.course_key "
                            "WHERE p.person_id=:person"
                        ),
                        {"person": person},
                    )
                )
                .mappings()
                .all()
            )
        return SimpleNamespace(
            courses=[
                SimpleNamespace(
                    course_key=row["course_key"],
                    finished=row["certificate_id"] is not None,
                    practical_certificate_id=row["practical_certificate_id"],
                    practice_status=row["practice_status"],
                )
                for row in rows
            ]
        )

    monkeypatch.setattr(impulse_levels, "impulse_study_summary", summary)
    request = cast(
        Request,
        SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=database,
                    development_service=SimpleNamespace(
                        store=SimpleNamespace(attempts=attempts, courses=courses)
                    ),
                )
            )
        ),
    )
    auth = cast(AuthenticatedSession, SimpleNamespace(actor=actor))
    async with database.session() as session:
        await session.execute(
            text(
                "INSERT INTO persons(id,display_name,external_key) "
                "VALUES (:id,'Cycle learner',:key)"
            ),
            {"id": person, "key": str(person)},
        )

    async def grant(keys: tuple[str, ...], practice_key: str) -> None:
        async with database.session() as session:
            for key in keys:
                await session.execute(
                    text(
                        "INSERT INTO impulse_course_progress "
                        "(person_id,course_key,completed_units,total_units, "
                        "certificate_id,finished_at) "
                        "VALUES (:person,:key,8,8,:certificate,now())"
                    ),
                    {"person": person, "key": key, "certificate": uuid4()},
                )
            await session.execute(
                text(
                    "INSERT INTO impulse_practical_submissions "
                    "(person_id,course_key,description,status,practical_certificate_id) "
                    "VALUES (:person,:key,:description,'approved',:certificate)"
                ),
                {
                    "person": person,
                    "key": practice_key,
                    "description": "Reviewed independent artifact for current role and level." * 2,
                    "certificate": uuid4(),
                },
            )

    try:
        state = await impulse_levels.impulse_level("python", auth, request)
        assert (state.level, state.cycle_number) == (0, 1)
        assert not state.advance_ready
        await grant(("demo-course-1", "demo-course-2"), "demo-course-1")
        state = await impulse_levels.impulse_level("python", auth, request)
        assert state.advance_ready
        state = await impulse_levels.advance_impulse_level("python", auth, request)
        assert (state.level, state.cycle_number, state.completed_courses) == (1, 2, 0)
        assert not state.advance_ready
        assert len(state.required_course_keys) == 2

        await grant(("demo-course-13-python", "demo-course-14-python"), "demo-course-13-python")
        state = await impulse_levels.impulse_level("python", auth, request)
        assert (
            state.advance_ready and state.approved_practices == 1 and state.credited_practices == 1
        )
        state = await impulse_levels.advance_impulse_level("python", auth, request)
        assert (state.level, state.completed_courses) == (2, 0)
        assert not state.advance_ready

        await grant(("demo-course-15-python", "demo-course-16-python"), "demo-course-15-python")
        state = await impulse_levels.advance_impulse_level("python", auth, request)
        assert state.level == 3 and state.cycle_number == 4
        assert len(state.history) == 3
        assert not state.advance_ready and not state.required_course_keys
        assert state.required_practices == 0  # terminal L3 has no phantom L4 assignment
        repeat = await impulse_levels.advance_impulse_level("python", auth, request)
        assert repeat.level == 3 and len(repeat.history) == 3
        async with database.sessions() as session:
            row = (
                await session.execute(
                    text(
                        "SELECT level,cycle_number FROM impulse_role_levels "
                        "WHERE person_id=:person AND track_key='python'"
                    ),
                    {"person": person},
                )
            ).one()
        assert tuple(row) == (3, 4)
    finally:
        await database.close()
