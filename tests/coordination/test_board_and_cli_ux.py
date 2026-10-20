"""tests/coordination: read-only board, CLI UX и NO_SAFE_TASK (tasks 26.2/26.3)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from coordination import (
    checkbox_count,
    claim_args,
    full_acceptance,
    run_cli_inproc,
    tasks_md_text,
)

EXIT_NO_SAFE_TASK = 16
EXIT_CLAIM_CONFLICT = 10
EXIT_STATE = 14


@pytest.fixture
def root(tmp_path: Path) -> Path:
    from coordination import make_root

    return make_root(tmp_path / "root")


def test_board_survives_non_numeric_claim_directory(root: Path) -> None:
    """Реальный кейс: посторонний *.lock-каталог не ломает board и сортировку."""
    weird = root / ".agents" / "coordination" / "claims" / "parallel-runtime-v2.lock"
    weird.mkdir()
    (weird / "status.md").write_text(
        "# Claim parallel-runtime-v2\n\n- session_id: other-session\n- status: IN_PROGRESS\n",
        encoding="utf-8",
    )
    assert run_cli_inproc(root, claim_args("9.3", "session-z", scope="feature/z")).ok
    board = run_cli_inproc(root, ["board"])
    assert board.ok, board.stderr
    assert "9.3" in board.stdout and "parallel-runtime-v2" in board.stdout
    payload = json.loads(run_cli_inproc(root, ["board", "--json"]).stdout)
    rows = {row[0]: row for row in payload["rows"]}
    assert rows["parallel-runtime-v2"][1] == "IN_PROGRESS"
    assert rows["9.3"][2] == "session-z"


def test_legacy_review_claim_with_handoff_can_be_approved(root: Path) -> None:
    claim_dir = root / ".agents" / "coordination" / "claims" / "9.3.lock"
    claim_dir.mkdir()
    (claim_dir / "status.md").write_text(
        "# Claim 9.3\n\n"
        "- session_id: legacy-worker\n"
        "- status: REVIEW (frontend scope)\n"
        "- write_scope:\n"
        "  - feature/legacy\n"
        "\n## Owner feedback handoff\n\n"
        "- changed_files:\n"
        "  - feature/legacy.py\n"
        "- passed:\n"
        "  - targeted tests\n",
        encoding="utf-8",
    )

    approved = run_cli_inproc(
        root,
        ["approve", "--task", "9.3", "--reviewer", "independent-reviewer"],
    )

    assert approved.ok, approved.stderr
    assert checkbox_count(tasks_md_text(root), "9.3", checked=True) == 1


def test_migrate_legacy_review_preserves_source_and_requires_separate_approval(
    root: Path,
) -> None:
    claim_dir = root / ".agents" / "coordination" / "claims" / "9.4.lock"
    claim_dir.mkdir()
    source = (
        b"# Claim 9.4\n\n"
        b"- session_id: legacy-worker\n"
        b"- status: REVIEW\n"
        b"- verification:\n"
        b"  - targeted tests\n"
        b"- progress: DONE\n"
    )
    (claim_dir / "status.md").write_bytes(source)
    evidence = root / "legacy-evidence.json"
    evidence.write_text(
        json.dumps(
            {
                "changed_files": ["feature/legacy.py"],
                "commands_run": ["pytest targeted"],
                "passed": ["targeted tests"],
                "failed_or_not_run": [],
                "risks": [],
                "next_safe_step": "independent approval",
            }
        ),
        encoding="utf-8",
    )

    migrated = run_cli_inproc(
        root,
        [
            "migrate-legacy-review",
            "--task",
            "9.4",
            "--actor",
            "migration-operator",
            "--evidence-file",
            str(evidence),
        ],
    )

    assert migrated.ok, migrated.stderr
    payload = json.loads((claim_dir / "status.json").read_text(encoding="utf-8"))
    assert payload["status"] == "REVIEW"
    assert payload["session_id"] == "legacy-worker"
    assert payload["review"]["changed_files"] == ["feature/legacy.py"]
    assert (
        payload["review"]["legacy_migration"]["source_sha256"] == hashlib.sha256(source).hexdigest()
    )
    assert (claim_dir / "legacy-status.md").read_bytes() == source
    assert checkbox_count(tasks_md_text(root), "9.4", checked=False) == 1

    approved = run_cli_inproc(
        root,
        ["approve", "--task", "9.4", "--reviewer", "independent-reviewer"],
    )
    assert approved.ok, approved.stderr
    assert checkbox_count(tasks_md_text(root), "9.4", checked=True) == 1


def test_board_lists_statuses_owners_dependencies_heartbeat(root: Path) -> None:
    ready = run_cli_inproc(
        root, claim_args("9.3", "session-alpha", scope="feature/approach", lane="messenger")
    )
    assert ready.ok
    board = run_cli_inproc(root, ["board"])
    assert board.ok
    out = board.stdout
    for fragment in ("9.1", "9.3", "IN_PROGRESS", "session-alpha", "messenger", "READY", "checked"):
        assert fragment in out, out
    assert "9.3" in out and "session-alpha" in out
    assert "0m" in out and "hb-age" in out


def test_board_json_is_valid_machine_readable(root: Path) -> None:
    claim = run_cli_inproc(root, claim_args("9.3", "session-json", scope="feature/json"))
    assert claim.ok
    board = run_cli_inproc(root, ["board", "--json"])
    assert board.ok
    payload = json.loads(board.stdout)
    required_keys = {"columns", "rows", "conflicts", "available_tasks", "no_safe_task", "scope"}
    assert required_keys == required_keys & set(payload)
    rows = {entry[0]: entry for entry in payload["rows"]}
    row = rows["9.3"]
    assert row[1] == "IN_PROGRESS"
    assert row[2] == "session-json"
    assert rows["9.1"][1] == "DONE" and rows["9.1"][6] == "[x]"


def test_board_does_not_modify_anything(root: Path) -> None:
    claim = run_cli_inproc(root, claim_args("9.3", "session-snap", scope="module/x"))
    assert claim.ok
    snapshots: dict[Path, bytes] = {}
    iteration = [root / "openspec" / "changes" / "impulse-ecosystem" / "tasks.md"]
    coordination = root / ".agents" / "coordination"
    iteration.append(coordination / "claims" / "9.3.lock" / "status.md")
    iteration.append(coordination / "claims" / "9.3.lock" / "status.json")
    for path in iteration:
        snapshots[path] = path.read_bytes()
    before = {path: path.stat().st_mtime for path in iteration}

    assert run_cli_inproc(root, ["board"]).ok
    assert run_cli_inproc(root, ["board", "--json"]).ok
    assert run_cli_inproc(root, ["board", "--json", "--scope", "unoccupied/zone"]).ok

    for path in iteration:
        assert path.read_bytes() == snapshots[path], "board не должен изменять файлы"
        assert path.stat().st_mtime == before[path], "board не должен перезаписывать файлы"
    text = tasks_md_text(root)
    assert checkbox_count(text, "9.3", checked=False) == 1


def test_board_no_safe_task_for_claimed_scope(root: Path) -> None:
    first = run_cli_inproc(root, claim_args("9.3", "a", scope="module/shared-files"))
    assert first.ok
    result = run_cli_inproc(root, ["board", "--scope", "module/shared-files"])
    assert result.returncode == EXIT_NO_SAFE_TASK
    result_json = run_cli_inproc(root, ["board", "--json", "--scope", "module/shared-files"])
    payload = json.loads(result_json.stdout)
    assert payload["no_safe_task"] is True
    assert not payload["available_tasks"]
    assert {row[0] for row in payload["rows"]} >= {"9.3"}


def test_board_reports_no_safe_task_when_nothing_ready(root: Path) -> None:
    for task in ("9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "9.10", "9.2", "19.5"):
        # каждая задача получает собственный независимый scope
        assert run_cli_inproc(root, claim_args(task, f"sess-{task}", scope=f"isolated/{task}")).ok
    dense = run_cli_inproc(root, ["board", "--scope", "isolated"])
    assert dense.returncode == EXIT_NO_SAFE_TASK
    payload = json.loads(run_cli_inproc(root, ["board", "--json", "--scope", "isolated"]).stdout)
    assert payload["available_tasks"] == []
    assert payload["no_safe_task"] is True
    row_map = {row[0]: row for row in payload["rows"]}
    for task, row in row_map.items():
        if task.startswith(("9.", "19.")) and task != "9.1":  # 9.1 уже [x] в fixture
            assert row[1] in ("IN_PROGRESS", "WAITING_APPROVAL"), (task, row)


def test_board_after_acceptance_shows_done(root: Path) -> None:
    assert run_cli_inproc(root, claim_args("9.3", "worker", scope="own/module")).ok
    assert full_acceptance(root, "9.3", "worker").ok
    payload = json.loads(run_cli_inproc(root, ["board", "--json"]).stdout)
    row_map = {row[0]: row for row in payload["rows"]}
    assert row_map["9.3"][1] in ("DONE",), row_map["9.3"]
    assert row_map["9.3"][6] == "[x]"
    assert row_map["9.3"][2] == "-"


def test_cli_help_outlines_all_commands(root: Path) -> None:
    help_result = run_cli_inproc(root, [])
    assert help_result.ok and help_result.returncode == 0
    for command in (
        "claim",
        "heartbeat",
        "status",
        "approve",
        "reject",
        "review",
        "migrate-legacy-review",
        "release",
        "board",
    ):
        assert command in help_result.stdout
    assert "CLAIM_CONFLICT" in help_result.stdout, "коды ошибок объясняются в help"
    assert "NO_SAFE_TASK" in help_result.stdout


def test_invalid_arguments_exit_with_usage_and_nonzero(root: Path) -> None:
    from coordination import run_cli_process

    usage_cases: list[tuple[list[str], int]] = [
        (["claim"], 2),
        (["claim", "--task"], 2),
        (["claim", "--task", "9.3"], 2),
        (["heartbeat", "--task", "9.3"], 2),
        (["unknown-command"], 2),
        (["approve"], 2),
        (["reject", "--task", "9.3", "--reviewer", "x"], 2),
        (["review", "--task", "9.3", "--session", "y"], 21),  # claim ещё не создан
    ]
    for args, expected_code in usage_cases:
        result = run_cli_process(root, args)
        assert result.returncode == expected_code, (args, result.returncode, result.stderr)
        if expected_code == 2:
            assert "usage" in result.stderr.lower() or "invalid" in result.stderr.lower(), (
                args,
                result.stderr,
            )


def test_error_messages_are_meaningful(root: Path) -> None:
    conflict = run_cli_inproc(root, claim_args("9.3", "first", scope="module/a"))
    assert conflict.ok
    dup = run_cli_inproc(root, claim_args("9.3", "second", scope="module/other"))
    assert dup.returncode == EXIT_CLAIM_CONFLICT
    assert "CLAIM_CONFLICT" in dup.stderr and "9.3" in dup.stderr and "first" in dup.stderr

    bad_id = run_cli_inproc(root, ["heartbeat", "--task", "no-such-task", "--session", "x"])
    assert bad_id.returncode == 20 and "INVALID_TASK_ID" in bad_id.stderr

    unknown_heartbeat = run_cli_inproc(root, ["heartbeat", "--task", "9.9", "--session", "x"])
    assert unknown_heartbeat.returncode == EXIT_STATE or unknown_heartbeat.returncode == 21


def test_claim_options_are_recorded(root: Path) -> None:
    claim = run_cli_inproc(
        root,
        [
            *claim_args("9.3", "rich-session", scope="rich/module/"),
            "--depends-on",
            "9.1",
            "--verification",
            "uv run pytest tests/coordination -q",
            "--progress",
            "старт",
            "--shared-files",
            "openspec/changes/impulse-ecosystem/tasks.md",
        ],
    )
    assert claim.ok
    payload = json.loads(
        (root / ".agents" / "coordination" / "claims" / "9.3.lock" / "status.json").read_text(
            encoding="utf-8"
        )
    )
    assert payload["write_scope"] == ["rich/module"]
    assert payload["depends_on"] == ["9.1"]
    assert payload["verification"] == ["uv run pytest tests/coordination -q"]
    assert payload["shared_files"] == ["openspec/changes/impulse-ecosystem/tasks.md"]
