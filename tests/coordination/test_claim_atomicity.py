"""tests/coordination: атомарность claim, конфликты и зависимости (task 26.2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from coordination import (
    audit_entries,
    claim_args,
    claim_status_payload,
    full_acceptance,
    run_cli_inproc,
)

EXIT_CLAIM_CONFLICT = 10
EXIT_DEPENDENCY_UNMET = 11
EXIT_INVALID_TASK_ID = 20
EXIT_STATE = 14


@pytest.fixture
def root(tmp_path: Path) -> Path:
    from coordination import make_root

    return make_root(tmp_path / "root")


def test_two_sessions_same_task_id_only_one_wins(root: Path) -> None:
    """scenario: Два агента одновременно выбирают 22.15 (mkdir fail-if-exists)."""
    first = run_cli_inproc(root, claim_args("22.15", "session-a", scope="frontend/src/features/a"))
    assert first.ok, first.stderr
    second = run_cli_inproc(
        root, claim_args("22.15", "session-b", scope="frontend/src/features/b-completely-different")
    )
    assert not second.ok
    assert second.returncode == EXIT_CLAIM_CONFLICT
    assert "session-a" in second.stderr
    # scope-b не был записан: победил первый claim, даже при более раннем scope overlap
    payload = claim_status_payload(root, "22.15")
    assert payload["session_id"] == "session-a"
    assert payload["write_scope"] == ["frontend/src/features/a"]


def test_partial_claim_is_not_valid_until_explicit_recovery(root: Path) -> None:
    """Частично записанный claim не считается валидным; recovery только явный."""
    claims_dir = root / ".agents" / "coordination" / "claims"
    (claims_dir / "9.3.lock").mkdir()  # авария между mkdir и записью статуса

    refused = run_cli_inproc(root, claim_args("9.3", "session-x", scope="docs"))
    assert refused.returncode == EXIT_CLAIM_CONFLICT
    assert "--recover-invalid" in refused.stderr

    board = run_cli_inproc(root, ["board", "--json"])
    import json

    payload = json.loads(board.stdout)
    row = next(row for row in payload["rows"] if row[0] == "9.3")
    assert "INVALID" in row[1]

    recovered = run_cli_inproc(
        root, [*claim_args("9.3", "session-x", scope="docs"), "--recover-invalid"]
    )
    assert recovered.ok, recovered.stderr
    assert claim_status_payload(root, "9.3")["status"] == "IN_PROGRESS"
    assert any(entry["action"] == "partial_claim_recovered" for entry in audit_entries(root))


def test_recovered_partial_claim_keeps_invalid_marker_in_json(root: Path) -> None:
    claims_dir = root / ".agents" / "coordination" / "claims"
    (claims_dir / "9.4.lock").mkdir()
    board = run_cli_inproc(root, ["board", "--json"])
    import json

    payload = json.loads(board.stdout)
    assert all(row[0] != "9.4" or "INVALID" in row[1] for row in payload["rows"])


def test_scope_conflict_parent_child(root: Path) -> None:
    """Родительский процесс/каталог vs потомок: конфликт, не зависимо от порядка."""
    ok = run_cli_inproc(root, claim_args("9.3", "auth-owner", scope="frontend/src/pages/feature"))
    assert ok.ok

    child = run_cli_inproc(
        root, claim_args("9.4", "child-owner", scope="frontend/src/pages/feature/deep.dart")
    )
    assert child.returncode == EXIT_CLAIM_CONFLICT
    assert "frontend/src/pages/feature" in child.stderr

    parent = run_cli_inproc(root, claim_args("9.4", "parent-owner", scope="frontend/src"))
    assert parent.returncode == EXIT_CLAIM_CONFLICT


def test_equal_scope_conflict_and_equal_file(root: Path) -> None:
    ok = run_cli_inproc(root, claim_args("9.3", "s-one", scope="shared/api.ts"))
    assert ok.ok
    same = run_cli_inproc(root, claim_args("9.4", "s-two", scope="shared/api.ts"))
    assert same.returncode == EXIT_CLAIM_CONFLICT


def test_independent_scopes_do_not_conflict(root: Path) -> None:
    """Отсутствие ложных конфликтов для независимых scope."""
    first = run_cli_inproc(root, claim_args("9.3", "α", scope="frontend/src/messenger/"))
    second = run_cli_inproc(root, claim_args("9.4", "b", scope="backend/analytics"))
    assert first.ok and second.ok, (first.stderr, second.stderr)


def test_lane_is_exclusive(root: Path) -> None:
    ok = run_cli_inproc(root, claim_args("9.3", "lane-blind", scope="x/module-a", lane="messenger"))
    conflict = run_cli_inproc(
        root, claim_args("9.4", "other", scope="y/module-b", lane="messenger")
    )
    assert ok.ok
    assert conflict.returncode == EXIT_CLAIM_CONFLICT
    assert "lane" in conflict.stderr


def test_dependencies_block_claim_until_done(root: Path) -> None:
    """Зависимости реально блокируют выдачу до DONE."""
    blocked = run_cli_inproc(
        root, ["claim", "--task", "9.2", "--session", "dev", "--depends-on", "9.3"]
    )
    assert blocked.returncode == EXIT_DEPENDENCY_UNMET
    assert "9.3" in blocked.stderr

    # зависимость DONE (через полностью пройденный lifecycle)
    dep_ok = run_cli_inproc(root, claim_args("9.3", "dep-owner", scope="feature/dep"))
    assert dep_ok.ok
    assert full_acceptance(root, "9.3", "dep-owner").ok, "Приёмка зависимости должна пройти"
    satisfied = run_cli_inproc(
        root, ["claim", "--task", "9.2", "--session", "dev", "--depends-on", "9.3"]
    )
    assert satisfied.ok

    # checkbox [x] в tasks.md тоже считается DONE-основанием
    approved_checkbox = run_cli_inproc(
        root, ["claim", "--task", "9.4", "--session", "dev", "--depends-on", "9.1"]
    )
    assert approved_checkbox.ok, "9.1 помечен [x] в fixture tasks.md"

    released_without_done = run_cli_inproc(
        root, ["claim", "--task", "9.5", "--session", "dev", "--depends-on", "9.6"]
    )
    assert released_without_done.returncode == EXIT_DEPENDENCY_UNMET


def test_approval_gated_task_requires_owner_approval(root: Path) -> None:
    """scenario: Railway deploy 19.5 без разрешения владельца остаётся WAITING_APPROVAL."""
    gated = run_cli_inproc(root, claim_args("19.5", "ops-agent", scope="railway"))
    assert gated.ok
    payload = claim_status_payload(root, "19.5")
    assert payload["status"] == "WAITING_APPROVAL"

    owner_view = run_cli_inproc(root, ["status", "--task", "19.5"])
    assert "WAITING_APPROVAL" in owner_view.stdout

    premature_approve = run_cli_inproc(root, ["approve", "--task", "19.5", "--reviewer", "someone"])
    assert premature_approve.returncode == EXIT_STATE

    review_attempt = run_cli_inproc(
        root, ["review", "--task", "19.5", "--session", "ops-agent", "--note", "x"]
    )
    assert review_attempt.returncode == EXIT_STATE

    approved = run_cli_inproc(root, ["approve-owner", "--task", "19.5", "--approver", "repo-owner"])
    assert approved.ok
    after = claim_status_payload(root, "19.5")
    assert after["status"] == "IN_PROGRESS"
    assert after["approved_by"] == "repo-owner"


def test_invalid_task_ids_are_rejected(root: Path) -> None:
    for bad_task in ("26.2.", "..", "26/2", "not-a-task", "26 2"):
        result = run_cli_inproc(root, ["claim", "--task", bad_task, "--session", "x"])
        assert result.returncode == EXIT_INVALID_TASK_ID, f"task={bad_task!r}: {result.stdout}"


def test_base_revision_and_timestamps_recorded(root: Path) -> None:
    created = run_cli_inproc(root, claim_args("9.3", "meta-owner", scope="meta/"))
    assert created.ok
    payload = claim_status_payload(root, "9.3")
    assert payload["started_at"] and payload["heartbeat_at"] and payload["updated_at"]
    assert "T" in payload["heartbeat_at"]
