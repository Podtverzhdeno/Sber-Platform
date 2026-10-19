"""Out-of-process и in-process запуск coordination CLI в изолированном каталоге.

Импорт под именем ``coordination`` (pytest prepend tests/ в sys.path).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

REPO_ROOT = Path(__file__).resolve().parents[2]

TASKS_TEMPLATE = """# Tasks (test fixture)

- [x] 9.1 выполненная задача-зависимость
- [ ] 9.2 зависимая задача
- [ ] 9.3 независимая задача
- [ ] 9.4 независимая задача
- [ ] 9.5 независимая задача
- [ ] 9.6 независимая задача
- [ ] 9.7 независимая задача
- [ ] 9.8 независимая задача
- [ ] 9.9 независимая задача
- [ ] 9.10 независимая задача
- [ ] 19.5 deployment gate task
"""

CLAIMS = "claims"
ARCHIVE = "archive"


@dataclass
class CliResult:
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0


def make_root(root: Path) -> Path:
    """Изолированный корень с coordination-структурой и tasks.md."""
    tasks_dir = root / "openspec" / "changes" / "impulse-ecosystem"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    (root / ".agents" / "coordination" / CLAIMS).mkdir(parents=True, exist_ok=True)
    (root / "openspec" / "changes" / "impulse-ecosystem" / "tasks.md").write_text(
        TASKS_TEMPLATE, encoding="utf-8", newline="\n"
    )
    return root


def run_cli_inproc(root: Path, args: Iterable[str]):
    """In-process вызов main(); используется для последовательных сценариев."""
    argv = ["--root", str(root), *args]
    return CliResult(*_capture_main(argv))


def _capture_main(argv: list[str]) -> tuple[int, str, str]:
    import contextlib
    import io

    from scripts.coordination.cli import main

    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(argv)
    return code, out.getvalue(), err.getvalue()


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def run_cli_process(root: Path, args: Iterable[str]) -> CliResult:
    """Реальный subprocess: точная модель параллельных агентских сессий."""
    argv = [sys.executable, "-m", "scripts.coordination.cli", "--root", str(root), *args]
    completed = subprocess.run(  # noqa: S603 - аргументы контролируются тестом
        argv,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=_subprocess_env(),
        timeout=120,
        check=False,
    )
    return CliResult(completed.returncode, completed.stdout, completed.stderr)


def run_parallel(
    root: Path, batches: Iterable[Iterable[str]], max_workers: int = 16
) -> list[CliResult]:
    """Параллельный запуск нескольких сессий реальными процессами."""
    argument_batches = [list(batch) for batch in batches]
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(run_cli_process, root, batch) for batch in argument_batches]
        return [future.result() for future in futures]


def claim_args(
    task: str, session: str, *, scope: str | None = None, lane: str | None = None
) -> list[str]:
    args = ["claim", "--task", task, "--session", session]
    if scope is not None:
        args += ["--scope", scope]
    if lane is not None:
        args += ["--lane", lane]
    return args


def write_json(path: Path, payload: dict[str, Any]) -> Path:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    return path


def claim_status_payload(root: Path, task: str) -> dict[str, Any]:
    data = (root / ".agents" / "coordination" / CLAIMS / f"{task}.lock" / "status.json").read_text(
        encoding="utf-8"
    )
    return json.loads(data)


def archived_status_payload(root: Path, task: str) -> dict[str, Any]:
    data = (root / ".agents" / "coordination" / ARCHIVE / f"{task}.lock" / "status.json").read_text(
        encoding="utf-8"
    )
    return json.loads(data)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    lines: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            value = json.loads(line)
            if isinstance(value, dict):
                lines.append(cast("dict[str, Any]", value))
    return lines


def audit_entries(root: Path) -> list[dict[str, Any]]:
    return _read_jsonl(root / ".agents" / "coordination" / "audit" / "audit.jsonl")


def event_entries(root: Path, task: str, *, archived: bool = False) -> list[dict[str, Any]]:
    base = root / ".agents" / "coordination" / (ARCHIVE if archived else CLAIMS)
    return _read_jsonl(base / f"{task}.lock" / "events.jsonl")


def tasks_md_text(root: Path) -> str:
    return (root / "openspec" / "changes" / "impulse-ecosystem" / "tasks.md").read_text(
        encoding="utf-8"
    )


def checkbox_count(text: str, task: str, checked: bool) -> int:
    marker = f"[{'x' if checked else ' '}] {task}"
    return sum(
        1 for line in text.splitlines() if marker in line and line.strip().startswith(("-", "*"))
    )


def default_evidence(root: Path, name: str = "evidence.json") -> Path:
    return write_json(
        root / name,
        {
            "changed_files": ["scripts/coordination/cli.py"],
            "commands_run": ["uv run pytest tests/coordination -q"],
            "passed": ["tests/coordination"],
            "failed_or_not_run": [],
            "migrations": "none",
            "risks": "none",
            "next_safe_step": "none",
        },
    )


def full_acceptance(
    root: Path, task: str, owner_session: str, reviewer: str = "reviewer-independent"
) -> CliResult:
    """Штатный путь: владелец ставит REVIEW, независимый reviewer делает DONE."""
    reviewed = run_cli_inproc(
        root, ["review", "--task", task, "--session", owner_session, "--note", "готово"]
    )
    assert reviewed.ok, reviewed.stderr
    approved = run_cli_inproc(root, ["approve", "--task", task, "--reviewer", reviewer])
    return approved
