"""Contract tests for independent, server-authoritative Impulse levels."""

from __future__ import annotations

from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from fastapi import Request

from impulse.api.errors import ApiError
from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp import impulse_levels
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.identity import ActorContext, Role


@pytest.mark.asyncio
async def test_l0_starts_without_fabricated_grade_and_needs_practical_review(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    person = uuid4()
    actor = ActorContext(
        person_id=person,
        display_name="Learner",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="test",
        consent_scopes=frozenset(),
    )

    async def attempts(_person: object) -> tuple[TrackAttempt, ...]:
        return (TrackAttempt("ai-security", 1, TrackStatus.ACTIVE),)

    async def stored(
        _request: object, _person: object, _track: str
    ) -> tuple[int, int, list[dict[str, object]]]:
        return 0, 1, []

    async def evidence(
        _request: object, _auth: object, _track: str, _level: int = 0
    ) -> tuple[int, int, int, tuple[str, ...]]:
        return 4, 4, 0, ("demo-course-1", "demo-course-2", "demo-course-3", "demo-course-4")

    monkeypatch.setattr(impulse_levels, "_saved", stored)
    monkeypatch.setattr(impulse_levels, "_evidence", evidence)
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                development_service=SimpleNamespace(store=SimpleNamespace(attempts=attempts))
            ),
        )
    )
    auth = SimpleNamespace(actor=actor)
    level = await impulse_levels.impulse_level(
        "ai-security", cast(AuthenticatedSession, auth), cast(Request, request)
    )
    assert level.level == 0
    assert level.cycle_number == 1
    assert level.completed_courses == 4
    assert level.approved_practices == 0
    assert not level.advance_ready

    async def approved(
        _request: object, _auth: object, _track: str, _level: int = 0
    ) -> tuple[int, int, int, tuple[str, ...]]:
        return 4, 4, 1, ("demo-course-1", "demo-course-2", "demo-course-3", "demo-course-4")

    monkeypatch.setattr(impulse_levels, "_evidence", approved)
    ready = await impulse_levels.impulse_level(
        "ai-security", cast(AuthenticatedSession, auth), cast(Request, request)
    )
    assert ready.advance_ready
    assert ready.level == 0  # reading readiness never grants an award


@pytest.mark.asyncio
async def test_l1_requires_new_curriculum_and_never_replays_older_courses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    person = uuid4()
    actor = ActorContext(
        person_id=person,
        display_name="Learner",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="test",
        consent_scopes=frozenset(),
    )

    async def attempts(_person: object) -> tuple[TrackAttempt, ...]:
        return (TrackAttempt("ai-security", 1, TrackStatus.ACTIVE),)

    async def stored(
        _request: object, _person: object, _track: str
    ) -> tuple[int, int, list[dict[str, object]]]:
        return 1, 2, [{"from": 0, "to": 1}]

    async def advanced_evidence(_request: object, _auth: object, _track: str, level: int = 0) -> tuple[int, int, int, tuple[str, ...]]:
        assert level == 1
        return 0, 2, 0, ("demo-course-13-ai-security", "demo-course-14-ai-security")
    monkeypatch.setattr(impulse_levels, "_evidence", advanced_evidence)
    monkeypatch.setattr(impulse_levels, "_saved", stored)
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                development_service=SimpleNamespace(store=SimpleNamespace(attempts=attempts))
            )
        )
    )
    auth = SimpleNamespace(actor=actor)
    state = await impulse_levels.impulse_level(
        "ai-security", cast(AuthenticatedSession, auth), cast(Request, request)
    )
    assert state.level == 1 and state.cycle_number == 2
    assert state.curriculum_state == "published"
    assert state.required_courses == 2
    assert not state.advance_ready
    assert state.completed_courses == 0
    with pytest.raises(ApiError):
        await impulse_levels.impulse_level(
            "ai-data", cast(AuthenticatedSession, auth), cast(Request, request)
        )


@pytest.mark.asyncio
async def test_each_cycle_requires_disjoint_role_specific_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Old awards and another role's certificates never count in a new cycle."""
    async def courses() -> tuple[SimpleNamespace, ...]:
        return tuple(
            [SimpleNamespace(key="demo-course-1", track_keys=("ai-security",)),
             SimpleNamespace(key="demo-course-2", track_keys=("ai-security",))]
            + [SimpleNamespace(
                key=f"demo-course-{number}-{track}", track_keys=(track,)
            ) for number in (13, 14, 15, 16) for track in ("ai-security", "ai-data")]
        )
    saved = {
        "demo-course-1": SimpleNamespace(finished=True, practical_certificate_id="old-practice"),
        "demo-course-2": SimpleNamespace(finished=True, practical_certificate_id=None),
        "demo-course-13-ai-security": SimpleNamespace(finished=True, practical_certificate_id="new-practice"),
        "demo-course-14-ai-security": SimpleNamespace(finished=True, practical_certificate_id=None),
        "demo-course-15-ai-security": SimpleNamespace(finished=True, practical_certificate_id=None),
        "demo-course-16-ai-security": SimpleNamespace(finished=False, practical_certificate_id=None),
        "demo-course-13-ai-data": SimpleNamespace(finished=True, practical_certificate_id="other-role"),
    }
    async def summary(*_args: object) -> SimpleNamespace:
        return SimpleNamespace(
            courses=[SimpleNamespace(course_key=key, **vars(record)) for key, record in saved.items()]
        )
    monkeypatch.setattr(impulse_levels, "impulse_study_summary", summary)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        development_service=SimpleNamespace(store=SimpleNamespace(courses=courses))
    )))
    auth = SimpleNamespace(actor=SimpleNamespace(person_id=uuid4()))
    for level, expected in [
        (0, (2, 2, 1)),
        (1, (2, 2, 1)),
        (2, (1, 2, 0)),
        (3, (0, 0, 0)),
    ]:
        finished, total, approved, keys = await impulse_levels._evidence(
            cast(Request, request), cast(AuthenticatedSession, auth), "ai-security", level
        )
        assert (finished, total, approved) == expected
        assert all("ai-data" not in key for key in keys)
        if level > 0:
            assert all(key not in {"demo-course-1", "demo-course-2"} for key in keys)


@pytest.mark.asyncio
async def test_l1_l2_l3_projection_requires_new_certs_and_stops_at_l3(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    person = uuid4()
    actor = ActorContext(
        person_id=person, display_name="Learner", active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,), scopes=frozenset(),
        program_key="test", consent_scopes=frozenset(),
    )
    async def attempts(_person: object) -> tuple[TrackAttempt, ...]:
        return (TrackAttempt("ai-security", 1, TrackStatus.ACTIVE),)
    state = {"level": 1}
    async def stored(_request: object, _person: object, _track: str) -> tuple[int, int, list[dict[str, object]]]:
        level = state["level"]
        return level, level + 1, []
    async def evidence(
        _request: object, _auth: object, _track: str, level: int = 0
    ) -> tuple[int, int, int, tuple[str, ...]]:
        assert level in (1, 2)
        keys = tuple(f"demo-course-{n}-ai-security" for n in ((13,14) if level==1 else (15,16)))
        return 2, 2, 1, keys
    monkeypatch.setattr(impulse_levels, "_saved", stored)
    monkeypatch.setattr(impulse_levels, "_evidence", evidence)
    request = cast(Request, SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        development_service=SimpleNamespace(store=SimpleNamespace(attempts=attempts))
    ))))
    auth = cast(AuthenticatedSession, SimpleNamespace(actor=actor))
    for level in (1,2):
        state["level"] = level
        result = await impulse_levels.impulse_level("ai-security", auth, request)
        assert result.level == level and result.cycle_number == level+1
        assert result.required_courses == 2 and result.completed_courses == 2
        assert result.approved_practices == 1 and result.advance_ready
        assert len(result.required_course_keys) == 2
    state["level"] = 3
    result = await impulse_levels.impulse_level("ai-security", auth, request)
    assert result.level == 3 and result.cycle_number == 4
    assert result.max_level == 3 and not result.advance_ready
    assert not result.required_course_keys
