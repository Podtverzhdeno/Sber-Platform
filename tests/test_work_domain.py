"""R&D task brief and publication policy scenarios."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from impulse.domain.work import (
    AcceptanceDecision,
    ApplicationStatus,
    AssignmentStatus,
    ContributionStatus,
    SupportAssignment,
    SupportMode,
    TaskAggregate,
    TaskBrief,
    TaskPolicyError,
    TaskStatus,
    accept_application,
    decide_contribution,
    open_authorship_dispute,
    publication_issues,
    validate_personal_contribution,
)


def complete_brief(**overrides: object) -> TaskBrief:
    values: dict[str, object] = {
        "problem": "Проверить гипотезу поиска релевантных программ.",
        "deliverable": "Research document и работающий MVP.",
        "acceptance_criteria": ("Есть воспроизводимый сценарий", "Метрики описаны"),
        "deadline_at": datetime(2026, 11, 1, tzinfo=UTC),
        "data_constraints": "Только синтетические данные без ПДн.",
        "ip_terms": "Исключительные права передаются заказчику после приёмки.",
    }
    values.update(overrides)
    return TaskBrief(**values)  # type: ignore[arg-type]


@pytest.mark.spec("projects-tasks/Неполный бриф")
def test_publication_is_blocked_with_explicit_missing_criteria() -> None:
    task = TaskAggregate(uuid4(), uuid4(), complete_brief(acceptance_criteria=()))

    assert publication_issues(task.brief, None) == ("acceptance_criteria", "support")
    with pytest.raises(TaskPolicyError) as blocked:
        task.submit()
    assert blocked.value.code == "INCOMPLETE_TASK_BRIEF"
    assert blocked.value.missing_fields == ("acceptance_criteria",)


@pytest.mark.spec("operations/Без доступного ментора")
def test_optional_mentor_does_not_block_submission_but_support_blocks_publication() -> None:
    task = TaskAggregate(uuid4(), uuid4(), complete_brief(), nominated_mentor_id=None)
    moderated = task.submit().approve_moderation()
    assert moderated.status is TaskStatus.AWAITING_SUPPORT

    with pytest.raises(TaskPolicyError) as blocked:
        moderated.publish()
    assert blocked.value.code == "TASK_NOT_PUBLISHABLE"
    assert blocked.value.missing_fields == ("support",)

    published = moderated.assign_support(SupportAssignment(SupportMode.OPERATOR)).publish()
    assert published.status is TaskStatus.PUBLISHED


def test_naive_deadline_and_missing_data_ip_are_reported_together() -> None:
    task = TaskAggregate(
        uuid4(),
        uuid4(),
        complete_brief(
            deadline_at=datetime(2026, 11, 1),
            data_constraints="",
            ip_terms="",
        ),
    )
    assert publication_issues(task.brief, SupportAssignment(SupportMode.BUDDY)) == (
        "deadline_at_timezone",
        "data_constraints",
        "ip_terms",
    )


def test_application_acceptance_rejects_stale_version_and_full_task() -> None:
    with pytest.raises(TaskPolicyError) as stale:
        accept_application(
            ApplicationStatus.APPLIED,
            expected_version=1,
            actual_version=2,
            staffed_count=0,
            places=1,
        )
    assert stale.value.code == "STALE_APPLICATION"
    with pytest.raises(TaskPolicyError) as full:
        accept_application(
            ApplicationStatus.APPLIED,
            expected_version=2,
            actual_version=2,
            staffed_count=1,
            places=1,
        )
    assert full.value.code == "TASK_FULL"


@pytest.mark.spec("projects-tasks/Командный MVP")
def test_team_artifact_does_not_replace_personal_contribution_description() -> None:
    with pytest.raises(TaskPolicyError) as missing:
        validate_personal_contribution("Общий репозиторий")
    assert missing.value.code == "PERSONAL_CONTRIBUTION_REQUIRED"
    assert (
        validate_personal_contribution(
            "Я реализовал API поиска, написал тесты и измерил offline-метрику."
        )
        == "Я реализовал API поиска, написал тесты и измерил offline-метрику."
    )


@pytest.mark.spec("projects-tasks/Доработка и спор")
def test_revision_has_reason_deadline_owner_state_and_authorship_dispute_blocks_outcomes() -> None:
    with pytest.raises(TaskPolicyError) as no_deadline:
        decide_contribution(
            ContributionStatus.SUBMITTED,
            AcceptanceDecision.REVISION_REQUESTED,
            reason="Нужно дополнить результат.",
            deadline_at=None,
        )
    assert no_deadline.value.code == "REVISION_DEADLINE_REQUIRED"

    contribution_status, assignment_status = decide_contribution(
        ContributionStatus.SUBMITTED,
        AcceptanceDecision.REVISION_REQUESTED,
        reason="Нужно приложить воспроизводимый отчёт.",
        deadline_at=datetime(2026, 11, 10, tzinfo=UTC),
    )
    assert contribution_status is ContributionStatus.REVISION_REQUESTED
    assert assignment_status is AssignmentStatus.REVISION_REQUESTED

    disputed = open_authorship_dispute(
        ContributionStatus.ACCEPTED,
        reason="Другой участник заявил тот же личный вклад и требуется проверка фактов.",
        deadline_at=datetime(2026, 11, 12, tzinfo=UTC),
    )
    assert disputed is ContributionStatus.DISPUTED
