"""Coordination CLI: атомарные claims, планировщик, board и reviewer flow.

Реализация tasks 26.2–26.4 по спецификации
``openspec/changes/impulse-ecosystem/specs/agent-work-coordination/spec.md``.

Запуск: ``python -m scripts.coordination.cli <команда> ...``.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

TASK_ID_RE = re.compile(r"^\d+(?:\.\d+)+$")
CHECKBOX_RE = re.compile(
    r"^(?P<indent>[ \t]*)[-*][ \t]*\[(?P<mark>[ xX])\][ \t]*(?P<tid>\d+(?:\.\d+)+)(?P<rest>.*)$"
)

ACTIVE_STATUSES = ("IN_PROGRESS", "BLOCKED", "REVIEW", "WAITING_APPROVAL")
TERMINAL_STATUSES = ("DONE", "RELEASED")

COORD_DIR = Path(".agents") / "coordination"
CLAIMS_DIRNAME = "claims"
ARCHIVE_DIRNAME = "archive"
AUDIT_DIRNAME = "audit"
SCHEDULER_LOCK_NAME = ".scheduler.lock"
STATUS_JSON = "status.json"
STATUS_MD = "status.md"
EVENTS_LOG = "events.jsonl"
TASKS_FILE_DEFAULT = Path("openspec") / "changes" / "impulse-ecosystem" / "tasks.md"
STALE_HEARTBEAT_MINUTES_DEFAULT = 90
# Owner approval gates из spec.md agent-work-coordination (сценарий про task 19.5)
# и таблицы lanes в parallel-agent-workflow.md (deployment: Railway).
# Прямая перечислительность вместо эвристик по тексту tasks.md; другие задачи
# помечаются явным --approval-gated при claim.
DEFAULT_APPROVAL_GATED_TASKS = frozenset({"19.5"})

EXIT_OK = 0
EXIT_TASK_ID = 20
EXIT_CLAIM_CONFLICT = 10
EXIT_DEPENDENCY_UNMET = 11
EXIT_APPROVAL_REQUIRED = 12
EXIT_OWNERSHIP = 13
EXIT_STATE = 14
EXIT_SELF_APPROVAL = 15
EXIT_NO_SAFE_TASK = 16
EXIT_STORAGE = 21


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


class CoordinationError(Exception):
    """Ошибка CLI с устойчивым exit code."""

    exit_code = 1
    code_name = "COORDINATION_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class TaskIdError(CoordinationError):
    exit_code = EXIT_TASK_ID
    code_name = "INVALID_TASK_ID"


class ClaimConflictError(CoordinationError):
    exit_code = EXIT_CLAIM_CONFLICT
    code_name = "CLAIM_CONFLICT"


class InvalidClaimError(CoordinationError):
    exit_code = EXIT_CLAIM_CONFLICT
    code_name = "INVALID_CLAIM"


class DependencyError(CoordinationError):
    exit_code = EXIT_DEPENDENCY_UNMET
    code_name = "DEPENDENCY_NOT_SATISFIED"


class ApprovalRequiredError(CoordinationError):
    exit_code = EXIT_APPROVAL_REQUIRED
    code_name = "OWNER_APPROVAL_REQUIRED"


class OwnershipError(CoordinationError):
    exit_code = EXIT_OWNERSHIP
    code_name = "NOT_CLAIM_OWNER"


class StateError(CoordinationError):
    exit_code = EXIT_STATE
    code_name = "INVALID_STATE_TRANSITION"


class SelfApprovalError(CoordinationError):
    exit_code = EXIT_SELF_APPROVAL
    code_name = "SELF_APPROVAL_FORBIDDEN"


class NoSafeTaskError(CoordinationError):
    exit_code = EXIT_NO_SAFE_TASK
    code_name = "NO_SAFE_TASK"


class StorageError(CoordinationError):
    exit_code = EXIT_STORAGE
    code_name = "STORAGE_ERROR"


# ---------------------------------------------------------------------------
# Кросс-платформенная advisory-блокировка планировщика


class SchedulerLock:
    """Advisory-блокировка вокруг многошаговых операций над board.

    Windows: ``msvcrt.locking``; POSIX: ``fcntl.flock``. ОС снимает блокировку
    при аварии процесса, поэтому stale lock не остаётся навечно.
    """

    def __init__(self, path: Path, timeout_seconds: float = 10.0) -> None:
        self.path = path
        self.timeout_seconds = timeout_seconds
        self._fd: int | None = None

    def _try_acquire(self, fd: int) -> None:
        try:
            import msvcrt

            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        except ImportError:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]

    def _unlock(self, fd: int) -> None:
        try:
            import msvcrt

            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        except ImportError:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_UN)  # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]

    def __enter__(self) -> SchedulerLock:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        deadline = time.monotonic() + self.timeout_seconds
        fd = -1
        while True:
            fd = os.open(str(self.path), os.O_RDWR | os.O_CREAT)
            try:
                self._try_acquire(fd)
                self._fd = fd
                return self
            except OSError:
                os.close(fd)
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Не удалось захватить {self.path}") from None
                time.sleep(0.02)

    def __exit__(self, *exc_info: object) -> None:
        if self._fd is None:
            return
        try:
            self._unlock(self._fd)
        finally:
            os.close(self._fd)
            self._fd = None


# ---------------------------------------------------------------------------
# Модель claim


def _string_list(raw: object) -> list[str]:
    """Список строк; нестроковые элементы приводятся к str, не-списки дают []."""
    if not isinstance(raw, list):
        return []
    return [str(item) for item in cast("list[Any]", raw)]


@dataclass
class ClaimState:
    task_id: str
    session_id: str
    status: str = "IN_PROGRESS"
    started_at: str = ""
    heartbeat_at: str = ""
    updated_at: str = ""
    base_revision: str = ""
    depends_on: list[str] = field(default_factory=list[str])
    lane: str | None = None
    write_scope: list[str] = field(default_factory=list[str])
    shared_files: list[str] = field(default_factory=list[str])
    approval_gated: bool = False
    approved_by: str | None = None
    verification: list[str] = field(default_factory=list[str])
    progress: str = "claim создан, изменения ещё не начаты"
    blockers: str = "none"
    review: dict[str, Any] | None = None
    reviewer: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "session_id": self.session_id,
            "status": self.status,
            "started_at": self.started_at,
            "heartbeat_at": self.heartbeat_at,
            "updated_at": self.updated_at,
            "base_revision": self.base_revision,
            "depends_on": self.depends_on,
            "lane": self.lane,
            "write_scope": self.write_scope,
            "shared_files": self.shared_files,
            "approval_gated": self.approval_gated,
            "approved_by": self.approved_by,
            "verification": self.verification,
            "progress": self.progress,
            "blockers": self.blockers,
            "review": self.review,
            "reviewer": self.reviewer,
        }


@dataclass
class ClaimOptions:
    task_id: str
    session_id: str
    write_scope: list[str] = field(default_factory=list[str])
    depends_on: list[str] = field(default_factory=list[str])
    lane: str | None = None
    shared_files: list[str] = field(default_factory=list[str])
    approval_gated: bool = False
    verification: list[str] = field(default_factory=list[str])
    base_revision: str = ""
    progress: str = ""
    recover_invalid: bool = False


def _parse_json_object(path: Path) -> dict[str, Any] | None:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict):
        return cast("dict[str, Any]", data)
    return None


_STATUS_MD_LIST_FIELDS = {
    "depends_on": "depends_on",
    "write_scope": "write_scope",
    "shared_files": "shared_files",
    "verification": "verification",
}
_STATUS_MD_SCALAR_FIELDS = {
    "session_id",
    "status",
    "started_at",
    "heartbeat_at",
    "base_revision",
    "lane",
    "approved_by",
    "progress",
    "blockers",
}


def _status_md_as_dict(path: Path, task_id: str) -> dict[str, Any] | None:
    """Разбор ручного status.md (формата status-template.md) в claim-данные."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    fields: dict[str, Any] = {"task_id": task_id}
    current_list: str | None = None
    recognized = False
    for line in text.splitlines():
        if line.strip().startswith("#"):
            current_list = None
            continue
        bullet = re.match(r"^\s+[-*]\s+(.+)$", line)
        if bullet is not None and current_list is not None:
            value = bullet.group(1).strip()
            if value and value not in ("none", "(не объявлен)"):
                fields[current_list].append(value)
            continue
        item = re.match(r"^-\s+([a-zA-Z_]+):\s*(.*)$", line)
        if item is None:
            continue
        key, value = item.group(1), item.group(2).strip()
        if key in _STATUS_MD_SCALAR_FIELDS and value:
            if key == "lane" and value in ("none", "-"):
                fields["lane"] = None
            else:
                fields[key] = value
            recognized = True
            current_list = None
        elif key in _STATUS_MD_LIST_FIELDS:
            fields[_STATUS_MD_LIST_FIELDS[key]] = []
            current_list = _STATUS_MD_LIST_FIELDS[key]
            recognized = True
    if not recognized or "session_id" not in fields or "status" not in fields:
        return None
    list_keys = set(_STATUS_MD_LIST_FIELDS.values())
    for key in list_keys:
        fields.setdefault(key, [])
    return fields


def _parse_status_md(path: Path, task_id: str) -> ClaimState | None:
    data = _status_md_as_dict(path, task_id)
    if data is None:
        return None
    try:
        return CoordinationStore.dict_to_claim(data)
    except TaskIdError:
        return None


def _status_md_status(path: Path) -> str | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    for line in text.splitlines():
        match = re.match(r"^-\s+status:\s*(\S+)", line)
        if match is not None:
            return match.group(1).strip("()`")
    return None


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.parent / f".tmp-{uuid.uuid4().hex}"
    tmp_path.write_text(text, encoding="utf-8", newline="")
    os.replace(tmp_path, path)


def _append_line(path: Path, entry: dict[str, Any]) -> None:
    line = json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8", newline="") as handle:
        handle.write(line)


def _status_markdown(claim: ClaimState) -> str:
    lines = [
        f"# Claim {claim.task_id}",
        "",
        f"- session_id: {claim.session_id}",
        f"- status: {claim.status}",
        f"- started_at: {claim.started_at}",
        f"- heartbeat_at: {claim.heartbeat_at}",
        f"- base_revision: {claim.base_revision}",
        "- depends_on:",
        *(f"  - {item}" for item in (claim.depends_on or ["none"])),
        "- write_scope:",
        *(f"  - {item}" for item in (claim.write_scope or ["(не объявлен)"])),
        f"- shared_files: {', '.join(claim.shared_files) if claim.shared_files else 'none'}",
        f"- lane: {claim.lane or 'none'}",
        f"- approval_gated: {str(claim.approval_gated).lower()}",
        f"- approved_by: {claim.approved_by or 'none'}",
        "- verification:",
        *(f"  - {item}" for item in (claim.verification or ["none"])),
        f"- progress: {claim.progress}",
        f"- blockers: {claim.blockers}",
        "",
        "## Handoff",
        "",
    ]
    if claim.review:
        lines += ["```json", json.dumps(claim.review, ensure_ascii=False, indent=2), "```"]
    else:
        lines += [
            "- changed_files: []",
            "- commands_run: []",
            "- passed: []",
            "- failed_or_not_run: []",
            "- migrations: none",
            "- risks: none",
            "- next_safe_step: none",
        ]
    if claim.reviewer:
        lines += [
            "",
            "## Reviewer evidence",
            "",
            "```json",
            json.dumps(claim.reviewer, ensure_ascii=False, indent=2),
            "```",
        ]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Нормализация scope


def normalize_scope(raw: str) -> str:
    text = raw.strip().replace("\\", "/")
    if text.startswith("/") or text.startswith("~") or (len(text) > 1 and text[1] == ":"):
        raise TaskIdError(f"Scope должен быть относительным путём без диска: {raw}")
    parts = [part for part in text.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise TaskIdError(f"Некорректный путь scope: {raw}")
    return "/".join(parts)


def scopes_overlap(first: str, second: str) -> bool:
    one = first.strip("/")
    other = second.strip("/")
    if not one or not other or one == other:
        return True
    a_parts = one.split("/")
    b_parts = other.split("/")
    shorter, longer = (a_parts, b_parts) if len(a_parts) <= len(b_parts) else (b_parts, a_parts)
    return longer[: len(shorter)] == shorter


# ---------------------------------------------------------------------------
# Store


class CoordinationStore:
    def __init__(self, root: Path, tasks_file: Path | None = None) -> None:
        self.root = root
        self.coord_dir = root / COORD_DIR
        self.claims_dir = self.coord_dir / CLAIMS_DIRNAME
        self.archive_dir = self.coord_dir / ARCHIVE_DIRNAME
        self.audit_file = self.coord_dir / AUDIT_DIRNAME / "audit.jsonl"
        self.scheduler_lock_path = self.coord_dir / SCHEDULER_LOCK_NAME
        self.tasks_file = tasks_file or (root / TASKS_FILE_DEFAULT)

    def ensure_layout(self) -> None:
        self.claims_dir.mkdir(parents=True, exist_ok=True)

    def claim_dir(self, task_id: str, *, archived: bool = False) -> Path:
        base = self.archive_dir if archived else self.claims_dir
        return base / f"{task_id}.lock"

    def scheduler_lock(self) -> SchedulerLock:
        return SchedulerLock(self.scheduler_lock_path)

    @staticmethod
    def validate_task_id(task_id: str) -> None:
        if not task_id or not TASK_ID_RE.fullmatch(task_id.strip()):
            raise TaskIdError(
                f"INVALID_TASK_ID: некорректный task ID {task_id!r} — "
                f"ожидается числовая схема вида 26.2"
            )

    # -- аудит и события ------------------------------------------------------

    def audit(
        self, action: str, task_id: str, actor: str, detail: dict[str, Any] | None = None
    ) -> None:
        entry: dict[str, Any] = {
            "ts": iso(utc_now()),
            "action": action,
            "task_id": task_id,
            "actor": actor,
        }
        if detail:
            entry["detail"] = detail
        _append_line(self.audit_file, entry)

    def _append_event(
        self, claim: ClaimState, event: str, detail: dict[str, Any] | None = None
    ) -> None:
        entry: dict[str, Any] = {
            "ts": iso(utc_now()),
            "event": event,
            "task_id": claim.task_id,
            "session_id": claim.session_id,
            "status": claim.status,
        }
        if detail:
            entry["detail"] = detail
        _append_line(self.claim_dir(claim.task_id) / EVENTS_LOG, entry)

    # -- чтение -----------------------------------------------------------------

    def read_tasks(self) -> dict[str, bool]:
        try:
            text = self.tasks_file.read_text(encoding="utf-8")
        except (FileNotFoundError, NotADirectoryError):
            return {}
        result: dict[str, bool] = {}
        for line in text.splitlines():
            match = CHECKBOX_RE.match(line)
            if match is None:
                continue
            result[match.group("tid")] = match.group("mark").lower() == "x"
        return result

    def archived_status(self, task_id: str) -> str | None:
        data = _parse_json_object(self.claim_dir(task_id, archived=True) / STATUS_JSON)
        if data is not None and isinstance(data.get("status"), str):
            return str(data["status"])
        return _status_md_status(self.claim_dir(task_id, archived=True) / STATUS_MD)

    def done_task_ids(self) -> set[str]:
        done: set[str] = set()
        if self.archive_dir.is_dir():
            for path in sorted(self.archive_dir.glob("*.lock")):
                data = _parse_json_object(path / STATUS_JSON)
                if data and data.get("status") == "DONE":
                    done.add(path.name.removesuffix(".lock"))
        for task_id, checked in self.read_tasks().items():
            if checked:
                done.add(task_id)
        return done

    @staticmethod
    def dict_to_claim(data: dict[str, Any]) -> ClaimState:
        missing = [
            key
            for key in ("task_id", "session_id", "status")
            if not isinstance(data.get(key), str) or not str(data.get(key))
        ]
        if missing:
            raise TaskIdError(f"В status.json отсутствуют поля: {', '.join(missing)}")
        claim = ClaimState(
            task_id=str(data["task_id"]),
            session_id=str(data["session_id"]),
            status=str(data["status"]),
            started_at=str(data.get("started_at", "")),
            heartbeat_at=str(data.get("heartbeat_at", "")),
            updated_at=str(data.get("updated_at", "")),
            base_revision=str(data.get("base_revision", "")),
            depends_on=_string_list(data.get("depends_on")),
            lane=data.get("lane") if isinstance(data.get("lane"), str) else None,
            write_scope=_string_list(data.get("write_scope")),
            shared_files=_string_list(data.get("shared_files")),
            approval_gated=bool(data.get("approval_gated", False)),
            approved_by=(
                data.get("approved_by") if isinstance(data.get("approved_by"), str) else None
            ),
            verification=_string_list(data.get("verification")),
            progress=str(data.get("progress", "")) or "claim создан",
            blockers=str(data.get("blockers", "none")),
        )
        if isinstance(data.get("review"), dict):
            claim.review = data["review"]
        if isinstance(data.get("reviewer"), dict):
            claim.reviewer = data["reviewer"]
        return claim

    def active_claims(self) -> dict[str, ClaimState]:
        claims: dict[str, ClaimState] = {}
        if not self.claims_dir.is_dir():
            return claims
        for path in sorted(self.claims_dir.glob("*.lock")):
            task_id = path.name.removesuffix(".lock")
            data = _parse_json_object(path / STATUS_JSON)
            if data is not None:
                try:
                    claim = self.dict_to_claim(data)
                except TaskIdError:
                    claims[task_id] = ClaimState(task_id=task_id, session_id="", status="INVALID")
                else:
                    # каталог обязан совпадать собственным task ID внутри статуса
                    if claim.task_id == task_id:
                        claims[task_id] = claim
                    else:
                        claims[task_id] = ClaimState(
                            task_id=task_id, session_id="", status="INVALID"
                        )
                continue
            manual = _parse_status_md(path / STATUS_MD, task_id)
            claims[task_id] = manual or ClaimState(task_id=task_id, session_id="", status="INVALID")
        return claims

    def read_claim(self, task_id: str) -> ClaimState:
        self.validate_task_id(task_id)
        claim = self.active_claims().get(task_id)
        if claim is None:
            archived = self.archived_status(task_id)
            if archived is None:
                archived = _status_md_status(self.claim_dir(task_id, archived=True) / STATUS_MD)
            if archived is not None:
                raise StateError(
                    f"claim {task_id} уже в терминальном статусе {archived} (archive); "
                    f"повторное действие не требуется"
                )
            if self.claim_dir(task_id).is_dir():
                raise InvalidClaimError(
                    f"каталог claims/{task_id}.lock существует без распознаваемого статуса "
                    f"(частично записанный claim не считается валидным)"
                )
            raise StorageError(f"claim {task_id} не существует (см. board)")
        if claim.status == "INVALID":
            raise InvalidClaimError(
                f"claim {task_id} частично записан (статус отсутствует или нечитаем)"
            )
        return claim

    # -- запись -----------------------------------------------------------------

    def persist(
        self,
        claim: ClaimState,
        action: str,
        actor: str,
        detail: dict[str, Any] | None = None,
        *,
        to_audit: bool = True,
    ) -> None:
        claim.updated_at = iso(utc_now())
        directory = self.claim_dir(claim.task_id)
        _atomic_write(
            directory / STATUS_JSON, json.dumps(claim.to_dict(), ensure_ascii=False, indent=2)
        )
        _atomic_write(directory / STATUS_MD, _status_markdown(claim))
        if to_audit:
            self.audit(action, claim.task_id, actor, detail)

    def create_claim(self, options: ClaimOptions) -> ClaimState:
        task_id = options.task_id.strip()
        self.validate_task_id(task_id)
        options.task_id = task_id
        scopes = [normalize_scope(item) for item in options.write_scope]
        dependencies = self._validated_dependencies(options.depends_on)
        approval_recovered = False
        with self.scheduler_lock():
            self.ensure_layout()
            approval_gated = options.approval_gated or task_id in DEFAULT_APPROVAL_GATED_TASKS
            existing_dir = self.claim_dir(task_id)
            if existing_dir.exists():
                existing_data = _parse_json_object(existing_dir / STATUS_JSON)
                if existing_data is None:
                    existing_data = _status_md_as_dict(existing_dir / STATUS_MD, task_id)
                if existing_data is None:
                    if not options.recover_invalid:
                        raise InvalidClaimError(
                            f"каталог claims/{task_id}.lock существует, но "
                            f"распознаваемого статуса нет — частично записанный "
                            f"claim не считается валидным. Явное восстановление: "
                            f"claim --task {task_id} --recover-invalid ..."
                        )
                    self.audit(
                        "partial_claim_recovered",
                        task_id,
                        options.session_id,
                        {
                            "reason": (
                                "status.json/status.md отсутствовали или были "
                                "повреждены при создании"
                            )
                        },
                    )
                    approval_recovered = True
                else:
                    previous = self.dict_to_claim(existing_data)
                    raise ClaimConflictError(
                        f"задача {task_id} уже занята сессией {previous.session_id} "
                        f"(status={previous.status}); перечитайте board и выберите другую задачу"
                    )

            current = self.active_claims()
            for other_id, other in current.items():
                if other_id == task_id or other.status == "INVALID":
                    continue
                if (
                    options.lane is not None
                    and other.lane is not None
                    and other.lane == options.lane
                ):
                    raise ClaimConflictError(
                        f"lane «{options.lane}» у claim {other_id} "
                        f"(сессия {other.session_id}, status={other.status})"
                    )
                for mine in scopes:
                    for theirs in other.write_scope:
                        if scopes_overlap(mine, theirs):
                            raise ClaimConflictError(
                                f"write-scope «{mine}» пересекается с «{theirs}» "
                                f"активного claim {other_id} "
                                f"(сессия {other.session_id}, status={other.status})"
                            )

            done_ids = self.done_task_ids()
            missing = [dep for dep in dependencies if dep not in done_ids]
            if missing:
                raise DependencyError(f"зависимости без DONE: {', '.join(sorted(missing))}")

            initial_status = "WAITING_APPROVAL" if approval_gated else "IN_PROGRESS"
            now = iso(utc_now())
            claim = ClaimState(
                task_id=task_id,
                session_id=options.session_id,
                status=initial_status,
                started_at=now,
                heartbeat_at=now,
                updated_at=now,
                base_revision=options.base_revision,
                depends_on=dependencies,
                lane=options.lane,
                write_scope=scopes,
                shared_files=options.shared_files,
                approval_gated=approval_gated,
                verification=options.verification,
                progress=options.progress or "claim создан, изменения ещё не начаты",
            )
            self.claims_dir.mkdir(parents=True, exist_ok=True)
            target = self.claim_dir(task_id)
            try:
                target.mkdir()
            except FileExistsError as exc:
                if not approval_recovered:
                    raise ClaimConflictError(
                        f"CLAIM_CONFLICT: {task_id} уже захвачена другой сессией"
                    ) from exc
            _atomic_write(
                target / STATUS_JSON, json.dumps(claim.to_dict(), ensure_ascii=False, indent=2)
            )
            _atomic_write(target / STATUS_MD, _status_markdown(claim))
            self.audit(
                "claim_created",
                task_id,
                options.session_id,
                {"status": initial_status, "scope": scopes},
            )
            self._append_event(claim, "claim_created", {"approval_gated": approval_gated})
            return claim

    def _validated_dependencies(self, raw: list[str]) -> list[str]:
        result: list[str] = []
        for dep in raw:
            self.validate_task_id(dep)
            if dep not in result:
                result.append(dep)
        return result

    # -- переходы -----------------------------------------------------------------

    def _require_owner(self, claim: ClaimState, session_id: str, action: str) -> None:
        if session_id != claim.session_id:
            raise OwnershipError(
                f"действие «{action}» доступно только владельцу claim "
                f"({claim.task_id}, сессия {claim.session_id}); передана {session_id}"
            )

    def heartbeat(self, task_id: str, session_id: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._require_owner(claim, session_id, "heartbeat")
        claim.heartbeat_at = iso(utc_now())
        self.persist(claim, "heartbeat", session_id)
        self._append_event(claim, "heartbeat")
        return claim

    def block(self, task_id: str, session_id: str, reason: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._require_owner(claim, session_id, "block")
        self._ensure_transition(claim, "BLOCKED", ("IN_PROGRESS",))
        previous = claim.status
        claim.status = "BLOCKED"
        claim.blockers = reason or "block без указанной причины"
        claim.progress = f"заблокирована: {claim.blockers}"
        self.persist(claim, "blocked", session_id, {"from_status": previous})
        self._append_event(claim, "blocked", {"from_status": previous, "reason": claim.blockers})
        return claim

    def resume(self, task_id: str, session_id: str, note: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._require_owner(claim, session_id, "resume")
        self._ensure_transition(claim, "IN_PROGRESS", ("BLOCKED",))
        previous = claim.status
        claim.status = "IN_PROGRESS"
        claim.blockers = "none"
        claim.heartbeat_at = iso(utc_now())
        if note:
            claim.progress = note
        self.persist(claim, "resumed", session_id, {"from_status": previous})
        self._append_event(claim, "resumed", {"from_status": previous})
        return claim

    def review(
        self, task_id: str, session_id: str, evidence: dict[str, Any], note: str
    ) -> ClaimState:
        claim = self.read_claim(task_id)
        self._require_owner(claim, session_id, "review")
        self._ensure_transition(claim, "REVIEW", ("IN_PROGRESS", "BLOCKED"))
        previous = claim.status
        review_data: dict[str, Any] = dict(claim.review or {})
        if evidence:
            review_data.update(evidence)
        if note:
            review_data["note"] = note
        if not review_data:
            raise StateError(
                "переход в REVIEW требует handoff/evidence (--evidence-file или --note)"
            )
        claim.status = "REVIEW"
        claim.heartbeat_at = iso(utc_now())
        claim.review = review_data
        self.persist(claim, "review_requested", session_id, {"from_status": previous})
        self._append_event(claim, "review_requested", {"from_status": previous})
        return claim

    def approve_owner(self, task_id: str, approver: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._ensure_transition(claim, "IN_PROGRESS", ("WAITING_APPROVAL",))
        previous = claim.status
        claim.status = "IN_PROGRESS"
        claim.approved_by = approver
        self.persist(claim, "owner_approved", approver, {"from_status": previous})
        self._append_event(claim, "owner_approved", {"from_status": previous, "approver": approver})
        return claim

    def release(self, task_id: str, session_id: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._require_owner(claim, session_id, "release")
        self._ensure_transition(claim, "RELEASED", ACTIVE_STATUSES)
        previous = claim.status
        claim.status = "RELEASED"
        self._archive_claim(claim)
        self.audit("released", task_id, session_id, {"from_status": previous})
        return claim

    def reject(self, task_id: str, reviewer_id: str, reason: str) -> ClaimState:
        claim = self.read_claim(task_id)
        self._ensure_transition(claim, "BLOCKED", ("REVIEW",))
        if reviewer_id == claim.session_id:
            raise SelfApprovalError(
                f"сессия {reviewer_id} владеет claim {task_id}; "
                f"вернуть задачу на доработку должен независимый reviewer"
            )
        reviewer_entry: dict[str, Any] = dict(claim.reviewer or {})
        reviewer_entry.update(
            {
                "verdict": "REJECTED",
                "reviewer_id": reviewer_id,
                "reviewed_at": iso(utc_now()),
                "reason": reason,
            }
        )
        claim.reviewer = reviewer_entry
        claim.status = "BLOCKED"
        claim.heartbeat_at = iso(utc_now())
        claim.progress = f"REVIEW отклонён reviewer {reviewer_id}: {reason}"
        claim.blockers = f"reviewer вернул задачу: {reason}"
        self.persist(
            claim, "review_rejected", reviewer_id, {"from_status": "REVIEW", "reason": reason}
        )
        self._append_event(claim, "review_rejected", {"from_status": "REVIEW", "reason": reason})
        return claim

    def approve(
        self, task_id: str, reviewer_id: str, evidence: dict[str, Any], tasks: TaskBoard
    ) -> ClaimState:
        claim = self.read_claim(task_id)
        self._ensure_transition(claim, "DONE", ("REVIEW",))
        if claim.session_id == reviewer_id:
            raise SelfApprovalError(
                f"сессия {reviewer_id} владеет claim {task_id}; "
                f"задачу может одобрить только независимый reviewer"
            )
        if not claim.review:
            raise StateError(f"claim {task_id} в REVIEW без handoff/evidence — approve отклонён")
        previous = claim.status
        reviewer_entry: dict[str, Any] = dict(claim.reviewer or {})
        reviewer_entry.update(
            {"verdict": "APPROVED", "reviewer_id": reviewer_id, "reviewed_at": iso(utc_now())}
        )
        if evidence:
            reviewer_entry.update(evidence)
        claim.reviewer = reviewer_entry
        claim.status = "DONE"
        self.persist(claim, "approved_done", reviewer_id, {"from_status": previous}, to_audit=False)
        self._append_event(
            claim, "approved_done", {"from_status": previous, "reviewer_id": reviewer_id}
        )
        checkbox_updated = tasks.mark_done(task_id)
        self._archive_claim(claim)
        self.audit(
            "approved_done",
            task_id,
            reviewer_id,
            {"from_status": previous, "tasks_md_checkbox_updated": checkbox_updated},
        )
        return claim

    def _ensure_transition(
        self, claim: ClaimState, to_status: str, expected_from: tuple[str, ...]
    ) -> None:
        if claim.status not in expected_from:
            raise StateError(
                f"переход {claim.status} → {to_status} недопустим "
                f"(ожидается один из: {', '.join(expected_from)})"
            )

    def _archive_claim(self, claim: ClaimState) -> None:
        source = self.claim_dir(claim.task_id)
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        target = self.claim_dir(claim.task_id, archived=True)
        if target.exists():
            raise StorageError(
                f"archive/{claim.task_id}.lock уже существует — аудит-история была бы перезаписана"
            )
        os.replace(source, target)


# ---------------------------------------------------------------------------
# tasks.md: единичное обновление checkbox


class TaskBoard:
    def __init__(self, store: CoordinationStore) -> None:
        self.store = store

    def mark_done(self, task_id: str) -> bool:
        self.store.validate_task_id(task_id)
        text = self.store.tasks_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        updated: list[str] = []
        replaced = False
        found = False
        for line in lines:
            match = CHECKBOX_RE.match(line)
            if match and match.group("tid") == task_id:
                found = True
                if match.group("mark").lower() == "x":
                    updated.append(line)
                else:
                    replaced = True
                    updated.append(line.replace(f"[{match.group('mark')}]", "[x]", 1))
            else:
                updated.append(line)
        if found and replaced:
            body = "\n".join(updated)
            if text.endswith("\n") and not body.endswith("\n"):
                body += "\n"
            _atomic_write(self.store.tasks_file, body)
        return replaced


# ---------------------------------------------------------------------------
# Board


def _task_sort_key(task_id: str) -> tuple[tuple[int, int | str], ...]:
    """Числовые сегменты (26.2) сортируются численно, прочие метки — после них."""
    parts: list[tuple[int, int | str]] = []
    for piece in task_id.split("."):
        if piece.isdigit():
            parts.append((0, int(piece)))
        else:
            parts.append((1, piece))
    return tuple(parts)


@dataclass
class BoardRow:
    task_id: str
    status: str
    owner: str
    lane: str | None
    heartbeat_age_minutes: int | None
    depends_on: list[str]
    checkbox: bool | None
    stale: bool
    invalid_reason: str | None = None

    def as_row(self) -> list[str]:
        age = "no-info" if self.heartbeat_age_minutes is None else f"{self.heartbeat_age_minutes}m"
        deps = ",".join(self.depends_on) if self.depends_on else "-"
        if self.checkbox is True:
            checkbox = "[x]"
        elif self.checkbox is False:
            checkbox = "[ ]"
        else:
            checkbox = "?"
        status = self.status
        if self.stale:
            status += " STALE_CANDIDATE"
        if self.invalid_reason:
            status += f" ({self.invalid_reason})"
        return [self.task_id, status, self.owner or "-", self.lane or "-", age, deps, checkbox]


BOARD_COLUMNS = ("task", "status", "owner", "lane", "hb-age", "depends", "checked")


def _invalid_reason(task_id: str) -> str:
    if not TASK_ID_RE.fullmatch(task_id):
        return "нестандартный каталог claim"
    return "частично записанный claim"


def build_board(store: CoordinationStore, stale_minutes: int) -> list[BoardRow]:
    rows: list[BoardRow] = []
    claims = store.active_claims()
    checkboxes = store.read_tasks()
    now = utc_now()

    for task_id, claim in claims.items():
        if claim.status == "INVALID":
            rows.append(
                BoardRow(
                    task_id=task_id,
                    status="INVALID",
                    owner="",
                    lane=None,
                    heartbeat_age_minutes=None,
                    depends_on=[],
                    checkbox=checkboxes.get(task_id),
                    stale=False,
                    invalid_reason=_invalid_reason(task_id),
                )
            )
            continue
        age: int | None = None
        stale = False
        if claim.heartbeat_at:
            try:
                hb = datetime.fromisoformat(claim.heartbeat_at)
                age = max(0, int((now - hb).total_seconds() // 60))
                stale = age > stale_minutes
            except ValueError:
                age = None
        rows.append(
            BoardRow(
                task_id=task_id,
                status=claim.status,
                owner=claim.session_id,
                lane=claim.lane,
                heartbeat_age_minutes=age,
                depends_on=claim.depends_on,
                checkbox=checkboxes.get(task_id),
                stale=stale,
            )
        )

    for task_id, checked in checkboxes.items():
        if task_id in claims:
            continue
        rows.append(
            BoardRow(
                task_id=task_id,
                status="DONE" if checked else "READY",
                owner="",
                lane=None,
                heartbeat_age_minutes=None,
                depends_on=[],
                checkbox=checked,
                stale=False,
            )
        )
    rows.sort(key=lambda row: _task_sort_key(row.task_id))
    return rows


def _claim_scopes(store: CoordinationStore, task_id: str) -> list[str]:
    claim = store.active_claims().get(task_id)
    if claim is not None and claim.status != "INVALID":
        return claim.write_scope
    for path in [store.claim_dir(task_id), store.claim_dir(task_id, archived=True)]:
        data = _parse_json_object(path / STATUS_JSON)
        if data:
            return _string_list(data.get("write_scope"))
    return []


def board_payload(
    store: CoordinationStore, stale_minutes: int, scope: str | None
) -> dict[str, Any]:
    rows = build_board(store, stale_minutes)
    conflicts: list[dict[str, Any]] = []
    normalized_scope = normalize_scope(scope) if scope else None
    if normalized_scope is not None:
        for row in rows:
            if row.status in TERMINAL_STATUSES or row.status == "READY" or row.status == "INVALID":
                continue
            claim_scopes = _claim_scopes(store, row.task_id)
            if any(scopes_overlap(normalized_scope, other) for other in claim_scopes):
                conflicts.append(
                    {
                        "task_id": row.task_id,
                        "status": row.status,
                        "owner": row.owner,
                        "write_scope": claim_scopes,
                    }
                )
    ready_candidates = [row.task_id for row in rows if row.status == "READY"]
    # Занятый запрошенный scope недоступен для любого нового claim, поэтому
    # безопасной работы в нём нет даже при наличии свободных задач в других scope.
    candidates: list[str] = ready_candidates
    if normalized_scope is not None and conflicts:
        candidates = []
    return {
        "columns": list(BOARD_COLUMNS),
        "rows": [row.as_row() for row in rows],
        "scope": normalized_scope,
        "conflicts": conflicts,
        "available_tasks": candidates,
        "no_safe_task": normalized_scope is not None and not candidates,
    }


def render_board(store: CoordinationStore, stale_minutes: int, scope: str | None) -> str:
    rows = build_board(store, stale_minutes)
    widths = [
        max(len(col), *(len(row.as_row()[i]) for row in rows)) if rows else len(col)
        for i, col in enumerate(BOARD_COLUMNS)
    ]
    header = " | ".join(col.ljust(widths[i]) for i, col in enumerate(BOARD_COLUMNS))
    separator = "-|-".join("-" * width for width in widths)
    body_lines = [
        " | ".join(cell.ljust(widths[i]) for i, cell in enumerate(row.as_row())) for row in rows
    ]
    output = "\n".join([header, separator, *body_lines])
    if scope:
        conflicts = board_payload(store, stale_minutes, scope)["conflicts"]
        output += "\n" + "\n".join(
            [
                "",
                f"scope: {normalize_scope(scope)}",
                *(
                    f"BLOCKED_BY_SCOPE task={c['task_id']} status={c['status']} owner={c['owner']}"
                    for c in conflicts
                ),
            ]
        )
    return output + "\n"


# ---------------------------------------------------------------------------
# Команды CLI


def _add_location_args(sub: argparse.ArgumentParser) -> None:
    sub.add_argument(
        "--root",
        default=argparse.SUPPRESS,
        help="корневой каталог, внутри которого живёт .agents/coordination (по умолчанию текущий)",
    )
    sub.add_argument(
        "--tasks-file",
        default=argparse.SUPPRESS,
        help="путь до tasks.md (по умолчанию <root>/openspec/changes/impulse-ecosystem/tasks.md)",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.coordination.cli",
        description=(
            "Координация параллельных агентских сессий:\n"
            "  атомарные claims (fail-if-exists), scheduler lock, read-only board,\n"
            "  heartbeat и reviewer flow с независимой приёмкой.\n"
            "Статусы claim: IN_PROGRESS, BLOCKED, REVIEW, DONE, RELEASED, WAITING_APPROVAL."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exit codes: 10 CLAIM_CONFLICT | 11 DEPENDENCY_NOT_SATISFIED | "
            "12 OWNER_APPROVAL_REQUIRED | 13 NOT_CLAIM_OWNER | "
            "14 INVALID_STATE_TRANSITION | 15 SELF_APPROVAL_FORBIDDEN | "
            "16 NO_SAFE_TASK | 20 INVALID_TASK_ID | 21 STORAGE_ERROR"
        ),
    )
    parser.add_argument(
        "--root",
        default=".",
        help="корневой каталог репозитория; --root действует и до команды, и после неё",
    )
    parser.add_argument("--tasks-file", default=None)
    subparsers = parser.add_subparsers(dest="command", metavar="<команда>")

    claim_p = subparsers.add_parser(
        "claim",
        help="атомарно захватить задачу (mkdir fail-if-exists для claims/<id>.lock)",
    )
    claim_p.add_argument("--task", required=True, help="task ID как в tasks.md, например 26.2")
    claim_p.add_argument("--session", required=True, help="уникальный session_id сессии")
    claim_p.add_argument(
        "--scope",
        action="append",
        default=[],
        help="относительный write-scope; повторите флаг для нескольких областей",
    )
    claim_p.add_argument(
        "--depends-on",
        action="append",
        default=[],
        metavar="TASK",
        help="зависимость от DONE-задачи",
    )
    claim_p.add_argument("--lane", default=None, help="эксклюзивная lane для конфликтной области")
    claim_p.add_argument(
        "--shared-files", action="append", default=[], help="известные shared-файлы (повторяемо)"
    )
    claim_p.add_argument(
        "--approval-gated",
        action="store_true",
        help="создать claim со статусом WAITING_APPROVAL (Railway/secrets gate)",
    )
    claim_p.add_argument(
        "--verification", action="append", default=[], help="план проверок (повторяемо)"
    )
    claim_p.add_argument("--progress", default="", help="начальный progress note")
    claim_p.add_argument(
        "--recover-invalid",
        action="store_true",
        help="явное восстановление частично записанного claim (аудируется)",
    )

    hb_p = subparsers.add_parser("heartbeat", help="обновить heartbeat claim (только владелец)")
    hb_p.add_argument("--task", required=True)
    hb_p.add_argument("--session", required=True)

    status_p = subparsers.add_parser(
        "status", help="показать claim либо перевести его: --stage block|resume"
    )
    status_p.add_argument("--task", required=True)
    status_p.add_argument("--session", default=None)
    status_p.add_argument("--stage", default=None, choices=("block", "resume"))
    status_p.add_argument("--reason", default="", help="причина block/resume")

    ao_p = subparsers.add_parser(
        "approve-owner", help="WAITING_APPROVAL -> IN_PROGRESS решением владельца"
    )
    ao_p.add_argument("--task", required=True)
    ao_p.add_argument("--approver", required=True)

    release_p = subparsers.add_parser(
        "release", help="IN_PROGRESS/BLOCKED -> RELEASED (архив claim)"
    )
    release_p.add_argument("--task", required=True)
    release_p.add_argument("--session", required=True)

    review_p = subparsers.add_parser(
        "review", help="IN_PROGRESS/BLOCKED -> REVIEW с handoff evidence"
    )
    review_p.add_argument("--task", required=True)
    review_p.add_argument("--session", required=True)
    review_p.add_argument("--note", default="", help="краткий handoff note")
    review_p.add_argument(
        "--evidence-file",
        default=None,
        help="JSON с changed_files/commands_run/passed/failed_or_not_run/risks/next_safe_step",
    )

    approve_p = subparsers.add_parser("approve", help="REVIEW -> DONE; только независимый reviewer")
    approve_p.add_argument("--task", required=True)
    approve_p.add_argument("--reviewer", required=True)
    approve_p.add_argument("--evidence-file", default=None)

    reject_p = subparsers.add_parser(
        "reject", help="REVIEW -> BLOCKED с причиной (CHANGES_REQUIRED)"
    )
    reject_p.add_argument("--task", required=True)
    reject_p.add_argument("--reviewer", required=True)
    reject_p.add_argument("--reason", required=True)

    board_p = subparsers.add_parser(
        "board", help="read-only board: статусы, владельцы, heartbeat, зависимости"
    )
    board_p.add_argument("--scope", default=None, help="оценить NO_SAFE_TASK для write-scope")
    board_p.add_argument("--json", action="store_true", help="машиночитаемый JSON-вывод")
    board_p.add_argument("--stale-minutes", type=int, default=STALE_HEARTBEAT_MINUTES_DEFAULT)

    for sub in subparsers.choices.values():
        _add_location_args(sub)
    return parser


def _load_evidence_file(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    data = _parse_json_object(Path(path))
    if data is None:
        raise StateError(f"evidence-file {path} не содержит валидного JSON-объекта")
    return data


def _cmd_claim(args: argparse.Namespace, store: CoordinationStore) -> int:
    options = ClaimOptions(
        task_id=args.task,
        session_id=args.session,
        write_scope=list(args.scope),
        depends_on=list(args.depends_on),
        lane=args.lane,
        shared_files=list(args.shared_files),
        approval_gated=args.approval_gated,
        verification=list(args.verification),
        progress=args.progress,
        recover_invalid=args.recover_invalid,
    )
    claim = store.create_claim(options)
    scope_text = ",".join(claim.write_scope) if claim.write_scope else "-"
    print(
        f"OK CLAIM_CREATED task={claim.task_id} session={claim.session_id} "
        f"status={claim.status} scope={scope_text}"
    )
    return EXIT_OK


def _cmd_heartbeat(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.heartbeat(args.task, args.session)
    print(f"OK HEARTBEAT task={claim.task_id} heartbeat_at={claim.heartbeat_at}")
    return EXIT_OK


def _cmd_status(args: argparse.Namespace, store: CoordinationStore) -> int:
    if args.stage is None:
        claim = store.read_claim(args.task)
        print(
            f"OK CLAIM_STATUS task={claim.task_id} status={claim.status} owner={claim.session_id} "
            f"heartbeat_at={claim.heartbeat_at} blockers={claim.blockers}"
        )
        return EXIT_OK
    if args.stage == "block":
        claim = store.block(args.task, args.session or "", args.reason)
    else:
        claim = store.resume(args.task, args.session or "", args.reason)
    print(f"OK STATUS_UPDATED task={claim.task_id} status={claim.status} blockers={claim.blockers}")
    return EXIT_OK


def _cmd_approve_owner(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.approve_owner(args.task, args.approver)
    print(
        f"OK OWNER_APPROVED task={claim.task_id} status={claim.status} "
        f"approved_by={claim.approved_by}"
    )
    return EXIT_OK


def _cmd_release(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.release(args.task, args.session)
    print(f"OK RELEASED task={claim.task_id} archive=archive/{claim.task_id}.lock")
    return EXIT_OK


def _cmd_review(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.review(
        args.task, args.session, _load_evidence_file(args.evidence_file), args.note
    )
    print(
        f"OK REVIEW_REQUESTED task={claim.task_id} status={claim.status} owner={claim.session_id}"
    )
    return EXIT_OK


def _cmd_approve(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.approve(
        args.task, args.reviewer, _load_evidence_file(args.evidence_file), TaskBoard(store)
    )
    print(
        f"OK APPROVED task={claim.task_id} reviewer={args.reviewer} "
        f"status=DONE archive=archive/{claim.task_id}.lock"
    )
    return EXIT_OK


def _cmd_reject(args: argparse.Namespace, store: CoordinationStore) -> int:
    claim = store.reject(args.task, args.reviewer, args.reason)
    print(f"OK CHANGES_REQUIRED task={claim.task_id} status={claim.status} reason={claim.blockers}")
    return EXIT_OK


def _cmd_board(args: argparse.Namespace, store: CoordinationStore) -> int:
    payload = board_payload(store, args.stale_minutes, args.scope)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(render_board(store, args.stale_minutes, args.scope).rstrip())
    if payload["no_safe_task"]:
        print("NO_SAFE_TASK", file=sys.stderr)
        return EXIT_NO_SAFE_TASK
    return EXIT_OK


def _dispatch(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    tasks_file = Path(args.tasks_file).resolve() if args.tasks_file else None
    store = CoordinationStore(root, tasks_file)
    handlers = {
        "claim": _cmd_claim,
        "heartbeat": _cmd_heartbeat,
        "status": _cmd_status,
        "approve-owner": _cmd_approve_owner,
        "release": _cmd_release,
        "review": _cmd_review,
        "approve": _cmd_approve,
        "reject": _cmd_reject,
        "board": _cmd_board,
    }
    handler = handlers[args.command]
    return handler(args, store)


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            with contextlib.suppress(ValueError):
                stream.reconfigure(encoding="utf-8", errors="replace")
    parser = _build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return EXIT_OK
    try:
        return _dispatch(args)
    except CoordinationError as error:
        print(f"{error.code_name}: {error.message}", file=sys.stderr)
        return error.exit_code
    except OSError as error:
        print(f"STORAGE_ERROR: {error}", file=sys.stderr)
        return EXIT_STORAGE


if __name__ == "__main__":
    sys.exit(main())
