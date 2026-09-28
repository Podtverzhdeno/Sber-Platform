"""Identity, role and object-access rules without framework dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class Role(StrEnum):
    PARTICIPANT = "participant"
    MENTOR = "mentor"
    CUSTOMER = "customer"
    MANAGER = "manager"
    HR = "hr"
    OPERATOR = "operator"
    PROGRAM_OWNER = "program_owner"
    ACCESS_ADMIN = "access_admin"
    UNIVERSITY_COORDINATOR = "university_coordinator"


class ConsentScope(StrEnum):
    PUBLIC_RATING = "public_rating"
    PUBLIC_TROPHIES = "public_trophies"
    PUBLIC_PROFILE = "public_profile"
    HR_PROFILE = "hr_profile"
    AI_MEMORY = "ai_memory"
    COURSE_HONOR_BOARD = "course_honor_board"


ROLE_SCOPES: dict[Role, frozenset[str]] = {
    Role.PARTICIPANT: frozenset({"journey:read", "own-work:write", "consent:write"}),
    Role.MENTOR: frozenset({"assigned-work:read", "review-draft:write", "review:publish"}),
    Role.CUSTOMER: frozenset({"own-tasks:write", "applications:read", "acceptance:write"}),
    Role.MANAGER: frozenset({"team-analytics:read", "accepted-artifacts:read"}),
    Role.HR: frozenset({"consented-portfolio:read", "talent-pipeline:write"}),
    Role.OPERATOR: frozenset({"operations:read", "operations:write", "verification:write"}),
    Role.PROGRAM_OWNER: frozenset({"program:read"}),
    Role.ACCESS_ADMIN: frozenset({"access:read"}),
    Role.UNIVERSITY_COORDINATOR: frozenset({"university-program:read"}),
}


ROLE_NAVIGATION: dict[Role, tuple[str, ...]] = {
    Role.PARTICIPANT: (
        "Мой путь",
        "Bootcamp",
        "Задачи",
        "События",
        "Рейтинг",
        "Портфолио",
        "Аналитика",
    ),
    Role.MENTOR: ("Очередь ревью", "Назначения", "Аналитика"),
    Role.CUSTOMER: ("Мои задачи", "Кандидаты", "Приёмка", "Аналитика"),
    Role.MANAGER: ("Инициативы", "Результаты", "Аналитика"),
    Role.HR: ("Кандидаты", "Воронка", "Аналитика"),
    Role.OPERATOR: ("Операционная очередь", "Проверки", "Споры", "Аналитика"),
    Role.PROGRAM_OWNER: (),
    Role.ACCESS_ADMIN: (),
    Role.UNIVERSITY_COORDINATOR: (),
}


@dataclass(frozen=True, slots=True)
class ActorContext:
    person_id: UUID
    display_name: str
    active_role: Role
    assigned_roles: tuple[Role, ...]
    scopes: frozenset[str]
    program_key: str
    consent_scopes: frozenset[ConsentScope]
    locale: str = "ru-RU"
    timezone: str = "Europe/Moscow"
    correlation_id: str = ""


@dataclass(frozen=True, slots=True)
class ProtectedObject:
    owner_id: UUID | None = None
    mentor_id: UUID | None = None
    customer_id: UUID | None = None
    manager_id: UUID | None = None
    hr_person_ids: frozenset[UUID] = frozenset()
    operator_visible: bool = False


def can_read(actor: ActorContext, resource: ProtectedObject) -> bool:
    """Apply the MVP object relationship matrix after role-level permission checks."""
    role = actor.active_role
    if role is Role.PARTICIPANT:
        return resource.owner_id == actor.person_id
    if role is Role.MENTOR:
        return resource.mentor_id == actor.person_id
    if role is Role.CUSTOMER:
        return resource.customer_id == actor.person_id
    if role is Role.MANAGER:
        return resource.manager_id == actor.person_id
    if role is Role.HR:
        return actor.person_id in resource.hr_person_ids
    return role is Role.OPERATOR and resource.operator_visible


def can_write(actor: ActorContext, resource: ProtectedObject) -> bool:
    """Managers and HR have read-oriented access unless a dedicated command grants more."""
    if actor.active_role in {Role.MANAGER, Role.HR}:
        return False
    return can_read(actor, resource)
