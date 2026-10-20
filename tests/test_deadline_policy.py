"""Domain policy for versioned deadline-change discussion."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from impulse.domain.deadline import (
    DeadlineChangeError,
    DeadlineChangeRequest,
    DeadlineChangeStatus,
    deadline_change_superseded,
    effective_status,
    new_deadline_request,
    normalized_comment,
    transition_decision,
    validate_proposal,
)
from impulse.domain.work import AssignmentStatus


def example_request(**overrides: Any) -> DeadlineChangeRequest:
    values: dict[str, Any] = {
        "id": uuid4(),
        "task_id": uuid4(),
        "requested_by": uuid4(),
        "addressee_id": uuid4(),
        "base_terms_version": 2,
        "proposed_deadline_at": datetime(2026, 12, 1, 18, tzinfo=UTC),
        "reason": "Интеграция занимает больше времени.",
        "impact": "Сдвигается демо команды на неделю.",
        "status": DeadlineChangeStatus.PENDING,
        "decision_comment": None,
        "decided_at": None,
        "created_at": datetime(2026, 10, 20, 12, tzinfo=UTC),
    }
    values.update(overrides)
    return DeadlineChangeRequest(**values)


def proposal_context(**overrides: Any) -> dict[str, Any]:
    context: dict[str, Any] = {
        "assignment_status": AssignmentStatus.IN_PROGRESS,
        "base_terms_version": 2,
        "current_deadline_at": datetime(2026, 11, 1, 18, tzinfo=UTC),
        "proposed_deadline_at": datetime(2026, 11, 8, 18, tzinfo=UTC),
        "reason": "Нужна дополнительная неделя на интеграцию.",
        "impact": "Демо сдвигается на неделю.",
    }
    context.update(overrides)
    return context


def test_new_request_starts_pending_and_normalizes_text() -> None:
    request = new_deadline_request(
        task_id=uuid4(),
        requested_by=uuid4(),
        addressee_id=uuid4(),
        base_terms_version=3,
        proposed_deadline_at=datetime(2026, 12, 5, 18, tzinfo=UTC),
        reason="  Дополнительная проверка интеграции.  ",
        impact="   ",
        created_at=datetime(2026, 10, 20, 9, tzinfo=UTC),
    )
    assert request.status is DeadlineChangeStatus.PENDING
    assert request.reason == "Дополнительная проверка интеграции."
    assert request.impact == ""


def test_proposal_requires_reason_timezone_base_version_and_change() -> None:
    validate_proposal(**proposal_context())
    with pytest.raises(DeadlineChangeError):
        validate_proposal(**proposal_context(reason="   "))
    with pytest.raises(DeadlineChangeError):
        validate_proposal(**proposal_context(proposed_deadline_at=datetime(2026, 11, 8, 18)))
    with pytest.raises(DeadlineChangeError):
        validate_proposal(**proposal_context(base_terms_version=0))
    with pytest.raises(DeadlineChangeError):
        validate_proposal(
            **proposal_context(proposed_deadline_at=datetime(2026, 11, 1, 18, tzinfo=UTC))
        )


def test_proposal_rejected_for_terminal_assignment() -> None:
    for terminal in (AssignmentStatus.ACCEPTED, AssignmentStatus.CLOSED):
        with pytest.raises(DeadlineChangeError) as error:
            validate_proposal(**proposal_context(assignment_status=terminal))
        assert error.value.code == "DEADLINE_CHANGE_NOT_AVAILABLE"


def test_decision_transitions_only_from_pending() -> None:
    assert transition_decision(DeadlineChangeStatus.PENDING, True) is DeadlineChangeStatus.APPROVED
    assert transition_decision(DeadlineChangeStatus.PENDING, False) is DeadlineChangeStatus.REJECTED
    with pytest.raises(DeadlineChangeError) as approved_again:
        transition_decision(DeadlineChangeStatus.APPROVED, False)
    assert approved_again.value.code == "INVALID_DEADLINE_CHANGE_TRANSITION"
    with pytest.raises(DeadlineChangeError):
        transition_decision(DeadlineChangeStatus.REJECTED, True)


def test_pending_becomes_stale_once_terms_move_on() -> None:
    pending = example_request()
    assert deadline_change_superseded(pending, 3)
    assert effective_status(pending, 3) is DeadlineChangeStatus.STALE
    assert effective_status(pending, 2) is DeadlineChangeStatus.PENDING
    rejected = example_request(status=DeadlineChangeStatus.REJECTED)
    assert not deadline_change_superseded(rejected, 10)
    assert effective_status(rejected, 10) is DeadlineChangeStatus.REJECTED


def test_comment_normalizes_or_clears() -> None:
    assert normalized_comment("  Цель объяснена  ") == "Цель объяснена"
    assert normalized_comment(None) is None
    assert normalized_comment("   ") is None
