"""Server-authoritative start/continue commands for Bootcamp courses."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.domain.identity import ActorContext, Role


class LearningAction(StrEnum):
    START = "start"
    CONTINUE = "continue"


@dataclass(frozen=True, slots=True)
class CourseCommandState:
    course_key: str
    course_version: str
    accessible: bool
    prerequisite_keys: tuple[str, ...]
    verified_prerequisite_keys: frozenset[str]
    enrollment_id: UUID | None = None

    @property
    def missing_prerequisites(self) -> tuple[str, ...]:
        return tuple(
            key for key in self.prerequisite_keys if key not in self.verified_prerequisite_keys
        )


@dataclass(frozen=True, slots=True)
class LearningCommandResult:
    command_id: UUID
    person_id: UUID
    course_key: str
    course_version: str
    action: LearningAction
    enrollment_id: UUID
    replayed: bool = False


class CourseCommandStateReader(Protocol):
    async def command_state(
        self, person_id: UUID, course_key: str
    ) -> CourseCommandState | None: ...


class LearningCommandStore(Protocol):
    async def execute_once(
        self, idempotency_key: str, fingerprint: str, result: LearningCommandResult
    ) -> LearningCommandResult: ...


class MemoryLearningCommandStore:
    def __init__(self) -> None:
        self._rows: dict[str, tuple[str, LearningCommandResult]] = {}

    async def execute_once(
        self, idempotency_key: str, fingerprint: str, result: LearningCommandResult
    ) -> LearningCommandResult:
        existing = self._rows.get(idempotency_key)
        if existing is not None:
            previous_fingerprint, previous = existing
            if previous_fingerprint != fingerprint:
                raise ApiError(
                    code="IDEMPOTENCY_CONFLICT",
                    message="Ключ идемпотентности уже использован для другой команды.",
                    status_code=409,
                )
            return LearningCommandResult(
                command_id=previous.command_id,
                person_id=previous.person_id,
                course_key=previous.course_key,
                course_version=previous.course_version,
                action=previous.action,
                enrollment_id=previous.enrollment_id,
                replayed=True,
            )
        self._rows[idempotency_key] = (fingerprint, result)
        return result


class BootcampLearningCommandService:
    def __init__(self, state: CourseCommandStateReader, store: LearningCommandStore) -> None:
        self.state = state
        self.store = store

    async def execute(
        self,
        actor: ActorContext,
        *,
        course_key: str,
        course_version: str,
        action: LearningAction,
        idempotency_key: str,
    ) -> LearningCommandResult:
        if actor.active_role is not Role.PARTICIPANT:
            raise ApiError(code="NOT_FOUND", message="Курс не найден.", status_code=404)
        if not idempotency_key.strip():
            raise ApiError(
                code="IDEMPOTENCY_KEY_REQUIRED",
                message="Для команды требуется Idempotency-Key.",
                status_code=400,
            )
        current = await self.state.command_state(actor.person_id, course_key)
        if current is None:
            raise ApiError(code="NOT_FOUND", message="Курс не найден.", status_code=404)
        if current.course_version != course_version:
            raise ApiError(
                code="STALE_COURSE_VERSION",
                message="Версия курса изменилась. Обновите данные.",
                status_code=409,
            )
        if not current.accessible:
            raise ApiError(
                code="COURSE_UNAVAILABLE",
                message="Курс сейчас недоступен.",
                status_code=409,
            )
        if current.missing_prerequisites:
            raise ApiError(
                code="PREREQUISITE_NOT_MET",
                message="Сначала выполните обязательные предварительные условия.",
                status_code=409,
                field_errors={"prerequisite_keys": list(current.missing_prerequisites)},
            )
        if action is LearningAction.CONTINUE and current.enrollment_id is None:
            raise ApiError(
                code="ENROLLMENT_NOT_FOUND",
                message="Обучение ещё не начато.",
                status_code=409,
            )
        enrollment_id = current.enrollment_id or uuid4()
        fingerprint = ":".join(
            (str(actor.person_id), course_key, course_version, action.value)
        )
        result = LearningCommandResult(
            command_id=uuid4(),
            person_id=actor.person_id,
            course_key=course_key,
            course_version=course_version,
            action=action,
            enrollment_id=enrollment_id,
        )
        return await self.store.execute_once(idempotency_key, fingerprint, result)


__all__ = [
    "BootcampLearningCommandService",
    "CourseCommandState",
    "CourseCommandStateReader",
    "LearningAction",
    "LearningCommandResult",
    "LearningCommandStore",
    "MemoryLearningCommandStore",
]
