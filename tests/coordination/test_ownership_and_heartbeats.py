"""tests/coordination: права владельца claim и heartbeat (task 26.2/26.4)."""

from __future__ import annotations

from pathlib import Path

import pytest

from coordination import (
    audit_entries,
    claim_args,
    claim_status_payload,
    run_cli_inproc,
)

EXIT_OWNERSHIP = 13
EXIT_SELF_APPROVAL = 15
EXIT_STATE = 14
EXIT_CLAIM_CONFLICT = 10


@pytest.fixture
def root(tmp_path: Path) -> Path:
    from coordination import make_root

    return make_root(tmp_path / "root")


def _claim(root: Path, task: str, session: str, scope: str) -> None:
    result = run_cli_inproc(root, claim_args(task, session, scope=scope))
    assert result.ok, result.stderr


def test_heartbeat_only_owner(root: Path) -> None:
    _claim(root, "9.3", "owner-ses", "scope/a")
    other = run_cli_inproc(root, ["heartbeat", "--task", "9.3", "--session", "intruder"])
    assert other.returncode == EXIT_OWNERSHIP
    assert "intruder" in other.stderr
    heartbeat = run_cli_inproc(root, ["heartbeat", "--task", "9.3", "--session", "owner-ses"])
    assert heartbeat.ok
    payload = claim_status_payload(root, "9.3")
    assert payload["heartbeat_at"] >= payload["started_at"]
    audit = audit_entries(root)
    assert audit[-1]["action"] == "heartbeat"


def test_status_changes_only_owner(root: Path) -> None:
    _claim(root, "9.3", "owner-ses", "scope/a")
    for cmd in (
        [
            "status",
            "--task",
            "9.3",
            "--session",
            "intruder",
            "--stage",
            "block",
            "--reason",
            "попытка чужая",
        ],
        ["status", "--task", "9.3", "--session", "intruder", "--stage", "resume"],
        ["release", "--task", "9.3", "--session", "intruder"],
    ):
        result = run_cli_inproc(root, cmd)
        assert result.returncode == EXIT_OWNERSHIP, (cmd, result.stdout, result.stderr)
    assert claim_status_payload(root, "9.3")["status"] == "IN_PROGRESS"


def test_block_resume_idempotent_by_owner(root: Path) -> None:
    _claim(root, "9.3", "owner-ses", "scope/a")
    blocked = run_cli_inproc(
        root,
        [
            "status",
            "--task",
            "9.3",
            "--session",
            "owner-ses",
            "--stage",
            "block",
            "--reason",
            "ждём инструмент",
        ],
    )
    assert blocked.ok
    blocked_again = run_cli_inproc(
        root,
        [
            "status",
            "--task",
            "9.3",
            "--session",
            "owner-ses",
            "--stage",
            "block",
            "--reason",
            "повторный block",
        ],
    )
    assert not blocked_again.ok
    assert claim_status_payload(root, "9.3")["status"] == "BLOCKED"

    resumed = run_cli_inproc(
        root, ["status", "--task", "9.3", "--session", "owner-ses", "--stage", "resume"]
    )
    assert resumed.ok
    resumed_again = run_cli_inproc(
        root, ["status", "--task", "9.3", "--session", "owner-ses", "--stage", "resume"]
    )
    assert not resumed_again.ok
    payload = claim_status_payload(root, "9.3")
    assert payload["status"] == "IN_PROGRESS" and payload["blockers"] == "none"


def test_stale_claim_is_never_taken_over_automatically(root: Path) -> None:
    """Heartbeat просрочен: другой агент не удаляет и не переписывает claim."""
    import json
    from datetime import UTC, datetime, timedelta

    _claim(root, "9.3", "stale-owner", "scope/stale")
    status_path = root / ".agents" / "coordination" / "claims" / "9.3.lock" / "status.json"
    payload = json.loads(status_path.read_text(encoding="utf-8"))
    payload["heartbeat_at"] = (datetime.now(UTC) - timedelta(hours=5)).isoformat()
    status_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    board = run_cli_inproc(root, ["board"])
    assert "STALE_CANDIDATE" in board.stdout

    takeover = run_cli_inproc(root, claim_args("9.3", "opportunistic", scope="scope/other"))
    assert takeover.returncode == EXIT_CLAIM_CONFLICT
    assert "stale-owner" in takeover.stderr
    assert claim_status_payload(root, "9.3")["session_id"] == "stale-owner"

    rewritten = run_cli_inproc(
        root, [*claim_args("9.3", "opportunistic", scope="scope/stale"), "--recover-invalid"]
    )
    assert rewritten.returncode == EXIT_CLAIM_CONFLICT, (
        "recover-invalid не должен восстанавливать валидный stale claim"
    )
    assert claim_status_payload(root, "9.3")["status"] == "IN_PROGRESS"


def test_release_by_owner_archives_without_checkbox(root: Path) -> None:
    _claim(root, "9.3", "owner-ses", "scope/a")
    other_release = run_cli_inproc(root, ["release", "--task", "9.3", "--session", "intruder"])
    assert other_release.returncode == EXIT_OWNERSHIP

    released = run_cli_inproc(root, ["release", "--task", "9.3", "--session", "owner-ses"])
    assert released.ok
    assert (root / ".agents" / "coordination" / "archive" / "9.3.lock").is_dir()
    assert not (root / ".agents" / "coordination" / "claims" / "9.3.lock").exists()

    from coordination import checkbox_count, tasks_md_text

    text = tasks_md_text(root)
    assert checkbox_count(text, "9.3", checked=False) == 1, "release не должен менять tasks.md"
    assert checkbox_count(text, "9.3", checked=True) == 0

    fresh_claim = run_cli_inproc(root, claim_args("9.3", "next-session", scope="scope/a"))
    assert fresh_claim.ok, "RELEASED освобождает task id для повторного захвата"


def test_feature_agent_cannot_self_approve(root: Path) -> None:
    _claim(root, "9.3", "feature-agent", "scope/a")
    put_review = run_cli_inproc(
        root, ["review", "--task", "9.3", "--session", "feature-agent", "--note", "готово"]
    )
    assert put_review.ok
    self_approve = run_cli_inproc(root, ["approve", "--task", "9.3", "--reviewer", "feature-agent"])
    assert self_approve.returncode == EXIT_SELF_APPROVAL
    assert claim_status_payload(root, "9.3")["status"] == "REVIEW"


def test_feature_agent_cannot_close_foreign_review(root: Path) -> None:
    _claim(root, "9.3", "first-agent", "scope/a")
    put_review = run_cli_inproc(
        root, ["review", "--task", "9.3", "--session", "first-agent", "--note", "готово"]
    )
    assert put_review.ok
    foreign_reject = run_cli_inproc(
        root, ["reject", "--task", "9.3", "--reviewer", "first-agent", "--reason", "сам"]
    )
    assert foreign_reject.returncode == EXIT_SELF_APPROVAL
    assert claim_status_payload(root, "9.3")["status"] == "REVIEW"


def test_done_requires_review_stage(root: Path) -> None:
    _claim(root, "9.3", "feature-agent", "scope/a")
    skip = run_cli_inproc(root, ["approve", "--task", "9.3", "--reviewer", "review-x"])
    assert skip.returncode == EXIT_STATE
    assert "REVIEW" in skip.stderr
    assert claim_status_payload(root, "9.3")["status"] == "IN_PROGRESS"
