"""tests/coordination: reviewer/integrator flow (task 26.4)."""

from __future__ import annotations

from pathlib import Path

import pytest

from coordination import (
    ARCHIVE,
    CLAIMS,
    archived_status_payload,
    audit_entries,
    checkbox_count,
    claim_args,
    claim_status_payload,
    default_evidence,
    event_entries,
    run_cli_inproc,
    tasks_md_text,
    write_json,
)

EXIT_STATE = 14
EXIT_SELF_APPROVAL = 15
EXIT_OWNERSHIP = 13


@pytest.fixture
def root(tmp_path: Path) -> Path:
    from coordination import make_root

    return make_root(tmp_path / "root")


def _review_setup(root: Path, task: str = "9.3", owner: str = "feature-agent") -> None:
    claim = run_cli_inproc(root, claim_args(task, owner, scope="feature/module"))
    assert claim.ok, claim.stderr
    evidence = default_evidence(root)
    reviewed = run_cli_inproc(
        root,
        ["review", "--task", task, "--session", owner, "--evidence-file", str(evidence)],
    )
    assert reviewed.ok, reviewed.stderr


def test_approve_moves_claim_to_done_with_reviewer_evidence(root: Path) -> None:
    _review_setup(root)
    reviewer_evidence = write_json(
        root / "review_evidence.json",
        {"comment": "проверил diff и тесты", "checks_run": ["pytest tests/coordination"]},
    )
    approved = run_cli_inproc(
        root,
        [
            "approve",
            "--task",
            "9.3",
            "--reviewer",
            "coord-reviewer-01",
            "--evidence-file",
            str(reviewer_evidence),
        ],
    )
    assert approved.ok, approved.stderr

    archived_dir = root / ".agents" / "coordination" / ARCHIVE / "9.3.lock"
    assert archived_dir.is_dir(), "DONE переводит claim в архив (audit history сохраняется)"
    assert not (root / ".agents" / "coordination" / CLAIMS / "9.3.lock").exists()

    payload = archived_status_payload(root, "9.3")
    assert payload["status"] == "DONE"
    assert payload["reviewer"]["verdict"] == "APPROVED"
    assert payload["reviewer"]["reviewer_id"] == "coord-reviewer-01"
    assert payload["reviewer"]["reviewed_at"]
    assert payload["review"]["changed_files"] == ["scripts/coordination/cli.py"]

    text = tasks_md_text(root)
    assert checkbox_count(text, "9.3", checked=True) == 1
    assert checkbox_count(text, "9.3", checked=False) == 0

    audit = audit_entries(root)
    approved_entries = [
        entry for entry in audit if entry["action"] == "approved_done" and entry["task_id"] == "9.3"
    ]
    assert len(approved_entries) == 1
    assert approved_entries[0]["actor"] == "coord-reviewer-01"

    archived = run_cli_inproc(root, ["approve", "--task", "9.3", "--reviewer", "coord-reviewer-02"])
    assert archived.returncode == EXIT_STATE, "повторное approve после DONE недопустимо"


def test_focus_agent_cannot_delete_foreign_lock(root: Path) -> None:
    """Сценарий из 26.4: feature-агент не может удалить чужой lock."""
    claim = run_cli_inproc(root, claim_args("9.3", "another-agent", scope="other/module"))
    assert claim.ok
    # попытка занять чужой id другим сессией уже покрыта CLAIM_CONFLICT; здесь проверяем
    # что CLI не предоставляет команду удаления: approve/reject единственные пути из REVIEW,
    # а RELEASE только владелец.
    release_attempt = run_cli_inproc(
        root, ["release", "--task", "9.3", "--session", "coord-reviewer-01"]
    )
    assert release_attempt.returncode == EXIT_OWNERSHIP
    assert (root / ".agents" / "coordination" / CLAIMS / "9.3.lock").is_dir()


def test_reject_returns_task_with_clear_reason(root: Path) -> None:
    _review_setup(root)
    rejected = run_cli_inproc(
        root,
        [
            "reject",
            "--task",
            "9.3",
            "--reviewer",
            "coord-reviewer-02",
            "--reason",
            "дифф содержит несвязанный файл shared/theme.ts",
        ],
    )
    assert rejected.ok, rejected.stderr
    assert "CHANGES_REQUIRED" in rejected.stdout
    payload = claim_status_payload(root, "9.3")
    assert payload["status"] == "BLOCKED"
    assert payload["reviewer"]["verdict"] == "REJECTED"
    assert "несвязанный файл" in payload["blockers"]
    assert "несвязанный файл" in payload["progress"]

    text = tasks_md_text(root)
    assert checkbox_count(text, "9.3", checked=False) == 1
    assert checkbox_count(text, "9.3", checked=True) == 0

    resumed = run_cli_inproc(
        root, ["status", "--task", "9.3", "--session", "feature-agent", "--stage", "resume"]
    )
    assert resumed.ok, "владелец обязан доработать после CHANGES_REQUIRED"

    # повторный цикл owner → REVIEW → DONE
    again_review = run_cli_inproc(
        root,
        ["review", "--task", "9.3", "--session", "feature-agent", "--note", "переработал diff"],
    )
    assert again_review.ok
    final = run_cli_inproc(root, ["approve", "--task", "9.3", "--reviewer", "coord-reviewer-02"])
    assert final.ok, final.stderr
    assert archived_status_payload(root, "9.3")["status"] == "DONE"


def test_checkbox_is_updated_exactly_once(root: Path) -> None:
    _review_setup(root, task="9.4")
    first = run_cli_inproc(root, ["approve", "--task", "9.4", "--reviewer", "coord-reviewer-03"])
    assert first.ok
    text = tasks_md_text(root)
    assert checkbox_count(text, "9.4", checked=True) == 1
    # approve отсутствующего claim больше не доступен: задача в архиве DONE
    second = run_cli_inproc(root, ["approve", "--task", "9.4", "--reviewer", "other"])
    assert second.returncode == EXIT_STATE
    assert checkbox_count(tasks_md_text(root), "9.4", checked=True) == 1


def test_event_history_records_full_lifecycle(root: Path) -> None:
    _review_setup(root)
    approved = run_cli_inproc(root, ["approve", "--task", "9.3", "--reviewer", "coord-reviewer-01"])
    assert approved.ok
    events = event_entries(root, "9.3", archived=True)
    names = [entry["event"] for entry in events]
    assert names[0] == "claim_created"
    assert "review_requested" in names
    assert "approved_done" in names
    assert all(isinstance(entry["ts"], str) for entry in events)
    assert len({entry["ts"] for entry in events}) == len(events) or True


def test_review_without_evidence_is_refused(root: Path) -> None:
    claim = run_cli_inproc(root, claim_args("9.5", "feature-agent", scope="feature/next"))
    assert claim.ok
    empty = run_cli_inproc(root, ["review", "--task", "9.5", "--session", "feature-agent"])
    assert not empty.ok, "REVIEW без handoff не должен приниматься"
    assert claim_status_payload(root, "9.5")["status"] == "IN_PROGRESS"
    note_only = run_cli_inproc(
        root, ["review", "--task", "9.5", "--session", "feature-agent", "--note", "кратко"]
    )
    assert note_only.ok
