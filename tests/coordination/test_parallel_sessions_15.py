"""tests/coordination: массовая конкуренция — 15 параллельных сессий (task 26.2/26.3).

Каждая сессия — реальный python-процесс, как в настоящем workflow.
Детерминированные инварианты гонки (вне зависимости от того, кто первым успел):
- копия пары по одному task ID: ровно один победитель;
- эксклюзивная lane: ровно один владелец из трёх претендентов;
- parent/child write-scope: ровно один победитель;
- независимые scope: обе сессии получают claim;
- повторные попытки по уже занятым id: только CLAIM_CONFLICT (10);
- coordination-файлы остаются читаемыми; tasks.md не меняется;
- общий прогон воспроизводим на новом пустом root.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import pytest

from coordination import CliResult, make_root, run_parallel

CONFLICT_CODE = 10


def session_matrix() -> list[list[str]]:
    """15 сессий: 6 флагов победы и 9 гарантированных проигрышей."""
    return [
        # Группа A: две сессии оспаривают один task ID 9.3
        ["claim", "--task", "9.3", "--session", "w-01", "--scope", "messenger/layout"],
        ["claim", "--task", "9.3", "--session", "w-02", "--scope", "messenger/layout-alt"],
        # Группа B: две сессии оспаривают 9.4
        ["claim", "--task", "9.4", "--session", "w-03", "--scope", "analytics/module"],
        ["claim", "--task", "9.4", "--session", "w-04", "--scope", "analytics/module-alt"],
        # Группа C: эксклюзивная lane-x на три разных задачи со свободными scope
        [
            "claim",
            "--task",
            "9.5",
            "--session",
            "w-05",
            "--scope",
            "lane-work/a",
            "--lane",
            "lane-x",
        ],
        [
            "claim",
            "--task",
            "9.6",
            "--session",
            "w-06",
            "--scope",
            "lane-work/b",
            "--lane",
            "lane-x",
        ],
        [
            "claim",
            "--task",
            "9.7",
            "--session",
            "w-07",
            "--scope",
            "lane-work/c",
            "--lane",
            "lane-x",
        ],
        # Группа D: parent/child пересечение scope
        ["claim", "--task", "9.8", "--session", "w-08", "--scope", "nested/deep"],
        ["claim", "--task", "9.9", "--session", "w-09", "--scope", "nested/deep/child"],
        # Группы E/F: независимые успешные claims
        [
            "claim",
            "--task",
            "19.5",
            "--session",
            "w-10",
            "--scope",
            "railway-own",
            "--approval-gated",
        ],
        ["claim", "--task", "9.2", "--session", "w-11", "--scope", "independent/zone"],
        # Группа G: повторные попытки уже занятых задач — гарантированные проигрыши
        ["claim", "--task", "19.5", "--session", "w-12", "--scope", "railway-alt"],
        ["claim", "--task", "9.2", "--session", "w-13", "--scope", "independent/zone-alt"],
        [
            "claim",
            "--task",
            "9.10",
            "--session",
            "w-14",
            "--scope",
            "lane-work/z",
            "--lane",
            "lane-x",
        ],
        ["claim", "--task", "9.3", "--session", "w-15", "--scope", "messenger/other"],
    ]


RootFactory = Callable[[str], Path]


@pytest.fixture
def root_factory(tmp_path_factory: pytest.TempPathFactory) -> RootFactory:
    def factory(name: str) -> Path:
        return make_root(tmp_path_factory.mktemp(name) / "root")

    return factory


def _scopes_overlap(a: str, b: str) -> bool:
    a_parts, b_parts = a.strip("/").split("/"), b.strip("/").split("/")
    shorter, longer = (a_parts, b_parts) if len(a_parts) <= len(b_parts) else (b_parts, a_parts)
    return longer[: len(shorter)] == shorter


def _to_victory_map(results: list[CliResult]) -> dict[str, str]:
    winners: dict[str, str] = {}
    for result in results:
        if result.returncode == 0:
            fields = dict(
                part.split("=", 1) for part in result.stdout.strip().split() if "=" in part
            )
            winners[fields["task"]] = fields["session"]
    return winners


def _run_and_validate(root: Path) -> dict[str, str]:
    results = run_parallel(root, session_matrix())
    winners = _to_victory_map(results)
    losers = [result for result in results if result.returncode != 0]

    # Ровно шесть успешных claims, по одному на конфликтную группу
    assert len(winners) == 6, winners
    for result in losers:
        assert result.returncode == CONFLICT_CODE, (result.stdout, result.stderr)

    # Каждый претендентский bucket даёт ровно одного победителя по задачам и сессиям
    won_tasks = set(winners)
    won_sessions = set(winners.values())
    buckets: list[tuple[set[str], set[str]]] = [
        ({"9.3"}, {"w-01", "w-02", "w-15"}),
        ({"9.4"}, {"w-03", "w-04"}),
        ({"9.5", "9.6", "9.7", "9.10"}, {"w-05", "w-06", "w-07", "w-14"}),
        ({"9.8", "9.9"}, {"w-08", "w-09"}),
        ({"9.2"}, {"w-11", "w-13"}),
        ({"19.5"}, {"w-10", "w-12"}),
    ]
    for group_tasks, group_sessions in buckets:
        assert len(won_tasks & group_tasks) == 1, (won_tasks, winners)
        assert len(won_sessions & group_sessions) == 1, (won_sessions, winners)
        for task in won_tasks & group_tasks:
            assert winners[task] in group_sessions, winners

    claims_dir = root / ".agents" / "coordination" / "claims"
    status_files = sorted(claims_dir.glob("*.lock/status.json"))
    assert len(status_files) == 6, [path.name for path in status_files]

    scopes: dict[str, list[str]] = {}
    lanes: set[str] = set()
    for status_path in status_files:
        task = status_path.parent.name.removesuffix(".lock")
        payload = json.loads(status_path.read_text(encoding="utf-8"))
        assert payload["task_id"] == task
        assert payload["status"] in ("IN_PROGRESS", "WAITING_APPROVAL")
        assert payload["session_id"] == winners[task]
        scopes[task] = payload["write_scope"]
        if payload["lane"]:
            assert payload["lane"] not in lanes, "одновременный владелец эксклюзивной lane"
            lanes.add(payload["lane"])

    task_items = sorted(scopes)
    for i, task_a in enumerate(task_items):
        for task_b in task_items[i + 1 :]:
            for scope_a in scopes[task_a]:
                for scope_b in scopes[task_b]:
                    assert not _scopes_overlap(scope_a, scope_b), (
                        f"пересечение scope: {scope_a} ({task_a}) против {scope_b} ({task_b})"
                    )

    audit_file = root / ".agents" / "coordination" / "audit" / "audit.jsonl"
    if audit_file.exists():
        for line in audit_file.read_text(encoding="utf-8").splitlines():
            if line.strip():
                json.loads(line)

    tasks_md = (root / "openspec" / "changes" / "impulse-ecosystem" / "tasks.md").read_text(
        encoding="utf-8"
    )
    assert tasks_md.count("[x] ") == 1, "параллельные сессии не меняют tasks.md (нужен reviewer)"
    return winners


def test_fifteen_parallel_sessions_invariants(root_factory: RootFactory) -> None:
    _run_and_validate(root_factory("race-a"))


def test_fifteen_parallel_sessions_reproducible(root_factory: RootFactory) -> None:
    """Второй прогон на другом пустом root даёт те же инварианты."""
    first = _run_and_validate(root_factory("race-r1"))
    second = _run_and_validate(root_factory("race-r2"))

    # победители фиксированных независимых задач повторяются по сессионной структуре
    # winner внутри каждого bucket может отличаться между прогонами: инварианты
    # (ровно один из bucket, шесть победителей, целостность файлов) уже проверены
    assert len(first) == len(second) == 6

    payload = json.loads(_board_snapshot(root_factory("race-r3")))
    assert payload["no_safe_task"] is False
    assert len(payload["rows"]) == 11  # 9.1 + 9.2..9.10 + 19.5


def _board_snapshot(root: Path) -> str:
    from coordination import run_cli_process

    return run_cli_process(root, ["board", "--json"]).stdout
