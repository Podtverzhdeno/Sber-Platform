"""Versioned deadline-change discussion for an assigned project."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Final
from uuid import UUID, uuid4

from impulse.domain.work import AssignmentStatus

REASON_MAX: Final[int] = 1000
IMPACT_MAX: Final[int] = 1000
COMMENT_MAX: Final[int] = 1000

_CHANGEABLE_STATUSES: Final[frozenset[AssignmentStatus]] = frozenset(
    {
        AssignmentStatus.STAFFED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.SUBMITTED,
        AssignmentStatus.REVISION_REQUESTED,
        AssignmentStatus.DISPUTED,
    }
)


class DeadlineChangeStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    STALE = "stale"


class DeadlineChangeError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class DeadlineChangeRequest:
    id: UUID
    task_id: UUID
    requested_by: UUID
    addressee_id: UUID
    base_terms_version: int
    proposed_deadline_at: datetime
    reason: str
    impact: str
    status: DeadlineChangeStatus = DeadlineChangeStatus.PENDING
    decision_comment: str | None = None
    decided_at: datetime | None = None
    created_at: datetime | None = None


def validate_proposal(
    *,
    assignment_status: AssignmentStatus,
    base_terms_version: int,
    current_deadline_at: datetime | None,
    proposed_deadline_at: datetime,
    reason: str,
    impact: str,
) -> None:
    if assignment_status not in _CHANGEABLE_STATUSES:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_NOT_AVAILABLE",
            "Обсуждение срока доступно только в активной работе над проектом.",
        )
    if base_terms_version < 1:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_BASE_VERSION_REQUIRED",
            "Укажите версию условий, с которой согласуется запрос.",
        )
    if proposed_deadline_at.tzinfo is None or proposed_deadline_at.utcoffset() is None:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_TIMEZONE_REQUIRED",
            "Укажите предлагаемую дату со смещением часового пояса.",
        )
    if current_deadline_at is not None and proposed_deadline_at == current_deadline_at:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_UNCHANGED",
            "Предлагаемая дата совпадает с действующим дедлайном.",
        )
    if not reason.strip():
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_REASON_REQUIRED",
            "Опишите причину переноса срока.",
        )
    if len(reason.strip()) > REASON_MAX or len(impact.strip()) > IMPACT_MAX:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_TOO_LONG",
            "Причина или влияние превышают допустимую длину.",
        )


def decide_status(approve: bool) -> DeadlineChangeStatus:
    return DeadlineChangeStatus.APPROVED if approve else DeadlineChangeStatus.REJECTED


def transition_decision(status: DeadlineChangeStatus, approve: bool) -> DeadlineChangeStatus:
    if status is not DeadlineChangeStatus.PENDING:
        raise DeadlineChangeError(
            "INVALID_DEADLINE_CHANGE_TRANSITION",
            "Запрос уже получил решение.",
        )
    return decide_status(approve)


def normalized_comment(comment: str | None) -> str | None:
    if comment is None:
        return None
    trimmed = comment.strip()
    if len(trimmed) > COMMENT_MAX:
        raise DeadlineChangeError(
            "DEADLINE_CHANGE_COMMENT_TOO_LONG",
            "Комментарий превышает допустимую длину.",
        )
    return trimmed or None


def deadline_change_superseded(request: DeadlineChangeRequest, latest_version: int) -> bool:
    return (
        request.status is DeadlineChangeStatus.PENDING
        and latest_version > request.base_terms_version
    )


def effective_status(
    request: DeadlineChangeRequest, latest_terms_version: int
) -> DeadlineChangeStatus:
    if deadline_change_superseded(request, latest_terms_version):
        return DeadlineChangeStatus.STALE
    return request.status


def new_deadline_request(
    *,
    task_id: UUID,
    requested_by: UUID,
    addressee_id: UUID,
    base_terms_version: int,
    proposed_deadline_at: datetime,
    reason: str,
    impact: str,
    created_at: datetime | None = None,
) -> DeadlineChangeRequest:
    return DeadlineChangeRequest(
        id=uuid4(),
        task_id=task_id,
        requested_by=requested_by,
        addressee_id=addressee_id,
        base_terms_version=base_terms_version,
        proposed_deadline_at=proposed_deadline_at,
        reason=reason.strip(),
        impact=impact.strip(),
        created_at=created_at,
    )
