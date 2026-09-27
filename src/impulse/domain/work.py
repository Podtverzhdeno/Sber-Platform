"""R&D/MVP task aggregate and publication invariants."""
# ruff: noqa: RUF001

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


class ApplicationStatus(StrEnum):
    TERMS_ACCEPTED = "terms_accepted"
    APPLIED = "applied"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class AssignmentStatus(StrEnum):
    STAFFED = "staffed"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    REVISION_REQUESTED = "revision_requested"
    DISPUTED = "disputed"
    CLOSED = "closed"


class ContributionStatus(StrEnum):
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REVISION_REQUESTED = "revision_requested"
    DISPUTED = "disputed"


class AcceptanceDecision(StrEnum):
    ACCEPTED = "accepted"
    REVISION_REQUESTED = "revision_requested"


def accept_application(
    status: ApplicationStatus,
    *,
    expected_version: int,
    actual_version: int,
    staffed_count: int,
    places: int,
) -> ApplicationStatus:
    if expected_version != actual_version:
        raise TaskPolicyError("STALE_APPLICATION", "Заявка изменилась. Обновите список кандидатов.")
    if status is not ApplicationStatus.APPLIED:
        raise TaskPolicyError("INVALID_APPLICATION_TRANSITION", "Заявка не ожидает решения.")
    if staffed_count >= places:
        raise TaskPolicyError("TASK_FULL", "Все места задачи уже заняты.")
    return ApplicationStatus.ACCEPTED


def start_assignment(status: AssignmentStatus) -> AssignmentStatus:
    if status not in {AssignmentStatus.STAFFED, AssignmentStatus.REVISION_REQUESTED}:
        raise TaskPolicyError("INVALID_ASSIGNMENT_TRANSITION", "Назначение уже начато или закрыто.")
    return AssignmentStatus.IN_PROGRESS


def submit_assignment(status: AssignmentStatus) -> AssignmentStatus:
    if status is not AssignmentStatus.IN_PROGRESS:
        raise TaskPolicyError(
            "INVALID_ASSIGNMENT_TRANSITION",
            "Вклад можно отправить только по назначению в работе.",
        )
    return AssignmentStatus.SUBMITTED


def decide_contribution(
    status: ContributionStatus,
    decision: AcceptanceDecision,
    *,
    reason: str,
    deadline_at: datetime | None,
) -> tuple[ContributionStatus, AssignmentStatus]:
    if status is not ContributionStatus.SUBMITTED:
        raise TaskPolicyError(
            "CONTRIBUTION_NOT_REVIEWABLE",
            "Эта версия вклада уже обработана или временно заблокирована спором.",
        )
    normalized_reason = " ".join(reason.split())
    if len(normalized_reason) < 10:
        raise TaskPolicyError(
            "DECISION_REASON_REQUIRED",
            "Укажите содержательную причину решения.",
            missing_fields=("reason",),
        )
    if decision is AcceptanceDecision.REVISION_REQUESTED and deadline_at is None:
        raise TaskPolicyError(
            "REVISION_DEADLINE_REQUIRED",
            "Для доработки нужен срок.",
            missing_fields=("deadline_at",),
        )
    if decision is AcceptanceDecision.ACCEPTED:
        return ContributionStatus.ACCEPTED, AssignmentStatus.CLOSED
    return ContributionStatus.REVISION_REQUESTED, AssignmentStatus.REVISION_REQUESTED


def open_authorship_dispute(
    status: ContributionStatus, *, reason: str, deadline_at: datetime
) -> ContributionStatus:
    if status not in {ContributionStatus.SUBMITTED, ContributionStatus.ACCEPTED}:
        raise TaskPolicyError(
            "CONTRIBUTION_NOT_DISPUTABLE",
            "Для этой версии вклада спор уже открыт или требуется доработка.",
        )
    if len(" ".join(reason.split())) < 20:
        raise TaskPolicyError(
            "DISPUTE_REASON_REQUIRED",
            "Опишите конфликт авторства и приложите проверяемые факты.",
            missing_fields=("reason",),
        )
    if deadline_at.tzinfo is None or deadline_at.utcoffset() is None:
        raise TaskPolicyError(
            "DISPUTE_DEADLINE_REQUIRED",
            "Срок решения спора должен содержать часовой пояс.",
            missing_fields=("deadline_at",),
        )
    return ContributionStatus.DISPUTED


def validate_personal_contribution(summary: str) -> str:
    normalized = " ".join(summary.split())
    if len(normalized) < 20:
        raise TaskPolicyError(
            "PERSONAL_CONTRIBUTION_REQUIRED",
            "Опишите собственную работу и отделите её от командного результата.",
            missing_fields=("personal_summary",),
        )
    return normalized


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
