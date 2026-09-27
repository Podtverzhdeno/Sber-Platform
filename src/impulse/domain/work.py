"""R&D/MVP task aggregate and publication invariants."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class TaskStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    AWAITING_SUPPORT = "awaiting_support"
    READY_TO_PUBLISH = "ready_to_publish"
    PUBLISHED = "published"


class SupportMode(StrEnum):
    MENTOR = "mentor"
    BUDDY = "buddy"
    OPERATOR = "operator"


@dataclass(frozen=True, slots=True)
class TaskBrief:
    problem: str = ""
    deliverable: str = ""
    acceptance_criteria: tuple[str, ...] = ()
    deadline_at: datetime | None = None
    data_constraints: str = ""
    ip_terms: str = ""


@dataclass(frozen=True, slots=True)
class SupportAssignment:
    mode: SupportMode
    assignee_id: UUID | None = None


class TaskPolicyError(ValueError):
    def __init__(self, code: str, message: str, *, missing_fields: tuple[str, ...] = ()) -> None:
        self.code = code
        self.missing_fields = missing_fields
        super().__init__(message)


def brief_issues(brief: TaskBrief) -> tuple[str, ...]:
    missing: list[str] = []
    if not brief.problem.strip():
        missing.append("problem")
    if not brief.deliverable.strip():
        missing.append("deliverable")
    if not any(item.strip() for item in brief.acceptance_criteria):
        missing.append("acceptance_criteria")
    if brief.deadline_at is None:
        missing.append("deadline_at")
    elif brief.deadline_at.tzinfo is None or brief.deadline_at.utcoffset() is None:
        missing.append("deadline_at_timezone")
    if not brief.data_constraints.strip():
        missing.append("data_constraints")
    if not brief.ip_terms.strip():
        missing.append("ip_terms")
    return tuple(missing)


def publication_issues(brief: TaskBrief, support: SupportAssignment | None) -> tuple[str, ...]:
    missing = list(brief_issues(brief))
    if support is None:
        missing.append("support")
    return tuple(missing)


@dataclass(frozen=True, slots=True)
class TaskAggregate:
    task_id: UUID
    customer_id: UUID
    brief: TaskBrief
    status: TaskStatus = TaskStatus.DRAFT
    nominated_mentor_id: UUID | None = None
    support: SupportAssignment | None = None

    def submit(self) -> TaskAggregate:
        if self.status is not TaskStatus.DRAFT:
            raise TaskPolicyError("INVALID_TASK_TRANSITION", "Черновик уже отправлен.")
        missing = brief_issues(self.brief)
        if missing:
            raise TaskPolicyError(
                "INCOMPLETE_TASK_BRIEF",
                "Заполните обязательные поля брифа.",
                missing_fields=missing,
            )
        return replace(self, status=TaskStatus.SUBMITTED)

    def approve_moderation(self) -> TaskAggregate:
        if self.status is not TaskStatus.SUBMITTED:
            raise TaskPolicyError("INVALID_TASK_TRANSITION", "Задача не ожидает модерацию.")
        return replace(
            self,
            status=(
                TaskStatus.READY_TO_PUBLISH
                if self.support is not None
                else TaskStatus.AWAITING_SUPPORT
            ),
        )

    def assign_support(self, support: SupportAssignment) -> TaskAggregate:
        if self.status not in {
            TaskStatus.SUBMITTED,
            TaskStatus.AWAITING_SUPPORT,
            TaskStatus.READY_TO_PUBLISH,
        }:
            raise TaskPolicyError(
                "INVALID_TASK_TRANSITION", "Сопровождение нельзя назначить на этом этапе."
            )
        next_status = (
            TaskStatus.READY_TO_PUBLISH
            if self.status in {TaskStatus.AWAITING_SUPPORT, TaskStatus.READY_TO_PUBLISH}
            else self.status
        )
        return replace(self, support=support, status=next_status)

    def publish(self) -> TaskAggregate:
        missing = publication_issues(self.brief, self.support)
        if missing:
            raise TaskPolicyError(
                "TASK_NOT_PUBLISHABLE",
                "Публикация заблокирована: бриф или сопровождение не готовы.",
                missing_fields=missing,
            )
        if self.status is not TaskStatus.READY_TO_PUBLISH:
            raise TaskPolicyError("INVALID_TASK_TRANSITION", "Задача не прошла модерацию.")
        return replace(self, status=TaskStatus.PUBLISHED)
