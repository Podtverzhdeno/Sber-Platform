"""R&D task brief and publication policy scenarios."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from impulse.domain.work import (
    SupportAssignment,
    SupportMode,
    TaskAggregate,
    TaskBrief,
    TaskPolicyError,
    TaskStatus,
    publication_issues,
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
