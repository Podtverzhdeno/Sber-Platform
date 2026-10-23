from __future__ import annotations

from dataclasses import replace
from uuid import UUID, uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.bootcamp.commands import (
    BootcampLearningCommandService,
    CourseCommandState,
    LearningAction,
    MemoryLearningCommandStore,
)
from impulse.domain.identity import ActorContext, Role


class StateReader:
    def __init__(self, state: CourseCommandState | None) -> None:
        self.state = state

    async def command_state(self, person_id: UUID, course_key: str) -> CourseCommandState | None:
        return self.state if self.state is None or self.state.course_key == course_key else None


def actor(role: Role = Role.PARTICIPANT) -> ActorContext:
    return ActorContext(
        person_id=uuid4(),
        display_name="Test actor",
        active_role=role,
        assigned_roles=(role,),
        scopes=frozenset(),
        program_key="demo",
        consent_scopes=frozenset(),
    )


def state() -> CourseCommandState:
    return CourseCommandState(
        course_key="openspec-sdd",
        course_version="course-v2",
        accessible=True,
        prerequisite_keys=("intro",),
        verified_prerequisite_keys=frozenset({"intro"}),
    )


async def execute(current: CourseCommandState, **kwargs: object):
    service = BootcampLearningCommandService(StateReader(current), MemoryLearningCommandStore())
    return await service.execute(
        actor(),
        course_key="openspec-sdd",
        course_version=str(kwargs.get("course_version", "course-v2")),
        action=kwargs.get("action", LearningAction.START),  # type: ignore[arg-type]
        idempotency_key=str(kwargs.get("idempotency_key", "request-1")),
    )


async def test_start_rechecks_state_and_creates_enrollment() -> None:
    result = await execute(state())
    assert result.action is LearningAction.START
    assert result.course_version == "course-v2"


@pytest.mark.parametrize(
    ("current", "code"),
    [
        (replace(state(), accessible=False), "COURSE_UNAVAILABLE"),
        (replace(state(), verified_prerequisite_keys=frozenset()), "PREREQUISITE_NOT_MET"),
    ],
)
async def test_start_rejects_changed_access_or_prerequisite(
    current: CourseCommandState, code: str
) -> None:
    with pytest.raises(ApiError) as raised:
        await execute(current)
    assert raised.value.code == code


async def test_stale_version_is_rejected() -> None:
    with pytest.raises(ApiError) as raised:
        await execute(state(), course_version="course-v1")
    assert raised.value.code == "STALE_COURSE_VERSION"


async def test_continue_requires_existing_enrollment() -> None:
    with pytest.raises(ApiError) as raised:
        await execute(state(), action=LearningAction.CONTINUE)
    assert raised.value.code == "ENROLLMENT_NOT_FOUND"


async def test_repeated_command_returns_same_result() -> None:
    service = BootcampLearningCommandService(StateReader(state()), MemoryLearningCommandStore())
    person = actor()
    first = await service.execute(
        person,
        course_key="openspec-sdd",
        course_version="course-v2",
        action=LearningAction.START,
        idempotency_key="same",
    )
    replay = await service.execute(
        person,
        course_key="openspec-sdd",
        course_version="course-v2",
        action=LearningAction.START,
        idempotency_key="same",
    )
    assert replay.command_id == first.command_id
    assert replay.enrollment_id == first.enrollment_id
    assert replay.replayed is True


async def test_idempotency_key_cannot_be_reused_for_another_command() -> None:
    current = replace(state(), enrollment_id=uuid4())
    service = BootcampLearningCommandService(StateReader(current), MemoryLearningCommandStore())
    person = actor()
    await service.execute(
        person,
        course_key=current.course_key,
        course_version=current.course_version,
        action=LearningAction.START,
        idempotency_key="same",
    )
    with pytest.raises(ApiError) as raised:
        await service.execute(
            person,
            course_key=current.course_key,
            course_version=current.course_version,
            action=LearningAction.CONTINUE,
            idempotency_key="same",
        )
    assert raised.value.code == "IDEMPOTENCY_CONFLICT"


async def test_non_participant_gets_non_disclosing_not_found() -> None:
    service = BootcampLearningCommandService(StateReader(state()), MemoryLearningCommandStore())
    with pytest.raises(ApiError) as raised:
        await service.execute(
            actor(Role.MENTOR),
            course_key="openspec-sdd",
            course_version="course-v2",
            action=LearningAction.START,
            idempotency_key="foreign",
        )
    assert raised.value.status_code == 404
