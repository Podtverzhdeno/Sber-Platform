"""Server-owned advisory Agentic Coding matrix (OpenSpec AN-00/AN-01).

These targets reproduce the methodology *without* publishing a corporate
certification policy. The legacy basic/confident competency scale is separate.
A verified source must be explicitly injected; demo competency rows are not
translated into Agentic Coding levels. No direct user mutation endpoints exist.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

SOURCE_MAP_VERSION = "agentic-coding-source-map-2026-10-23"
SCALE_KEY = "agentic_coding_1_4"
SKILLS: tuple[tuple[str, str], ...] = (
    ("prompting", "Постановка задач агенту"),
    ("prompt_engineering", "Определение правил работы агента"),
    ("context_management", "Формирование контекста"),
    ("tools_mcp", "Разработка и интеграция инструментов (Tools/MCP)"),
    ("creating_skills", "Создание и применение навыков (Skills)"),
    ("agents_team", "Управление командой агентов / субагентов"),
)
SKILL_KEYS = frozenset(key for key, _ in SKILLS)
# Source: openspec/changes/impulse-ecosystem/docs/analytics-agentic-coding/
# role_targets.source_map.json; PDF §4.2–4.4. None is an omitted PDF target,
# NOT level zero. The order is exactly SKILLS.
ROLE_TARGETS: dict[str, tuple[int | None, ...]] = {
    "developer": (3, 4, 3, 2, 3, 2),
    "analyst": (3, None, 3, 2, 2, 2),
    "qa": (3, 2, 2, 2, 2, 2),
}
ROLE_LABELS: dict[str, str] = {
    "developer": "Разработчик",
    "analyst": "Аналитик",
    "qa": "Тестировщик",
}
CONFLICT_KEYS: dict[str, frozenset[str]] = {
    "developer": frozenset({"creating_skills"}),
    "analyst": frozenset({"prompt_engineering", "context_management"}),
    "qa": frozenset({"prompt_engineering"}),
}


class VerificationStatus(StrEnum):
    VERIFIED = "verified"
    REPORTED = "reported"
    REJECTED = "rejected"
    REVOKED = "revoked"


@dataclass(frozen=True, slots=True)
class QualifiedEvidence:
    """A normalized qualification from a separately authorized evidence owner.

    The consuming API is read-only. A user-submitted course or an unverified
    project is never qualified simply because it exists in a legacy ledger.
    """

    person_id: UUID
    role_key: str
    skill_key: str
    level: int
    framework_version: str
    status: VerificationStatus
    source_ref: str
    observed_at: datetime
    trusted: bool
    revoked_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.level not in (1, 2, 3, 4):
            raise ValueError("Agentic level must use its own ordinal 1–4 scale")
        if self.observed_at.tzinfo is None or self.observed_at.utcoffset() is None:
            raise ValueError("Observation must be timezone-aware")
        if not self.source_ref or not self.framework_version:
            raise ValueError("Qualification needs source and framework version")


@dataclass(frozen=True, slots=True)
class SkillPosition:
    key: str
    title: str
    target_level: int | None
    current_level: int | None
    evidence_count: int
    data_state: str
    unresolved_methodology: bool


@dataclass(frozen=True, slots=True)
class RoleProfile:
    role_key: str
    role_title: str
    profile_scope: str
    scale_key: str
    framework_version: str
    as_of: datetime
    skills: tuple[SkillPosition, ...]
    certification_state: str
    certification_reason: str
    known_evidence_count: int
    data_origin: str


def evaluate_profile(
    person_id: UUID,
    role_key: str,
    rows: tuple[QualifiedEvidence, ...] = (),
    *,
    as_of: datetime | None = None,
) -> RoleProfile:
    if role_key not in ROLE_TARGETS:
        raise ValueError("Unknown Agentic Coding role")
    current_time = as_of or datetime.now(UTC)
    if current_time.tzinfo is None or current_time.utcoffset() is None:
        raise ValueError("Snapshot date must be timezone-aware")
    current: dict[str, list[QualifiedEvidence]] = {key: [] for key in SKILL_KEYS}
    for row in rows:
        # Strict source, identity, role, freshness and verification boundaries.
        if row.person_id != person_id or row.role_key != role_key:
            continue
        if row.framework_version != SOURCE_MAP_VERSION or row.skill_key not in SKILL_KEYS:
            continue
        if row.status is not VerificationStatus.VERIFIED or not row.trusted:
            continue
        if row.revoked_at is not None or row.observed_at > current_time:
            continue
        current[row.skill_key].append(row)
    skills = tuple(
        SkillPosition(
            key=key,
            title=title,
            target_level=ROLE_TARGETS[role_key][index],
            current_level=max((e.level for e in current[key]), default=None),
            evidence_count=len(current[key]),
            data_state="verified" if current[key] else "not_connected",
            unresolved_methodology=key in CONFLICT_KEYS[role_key],
        )
        for index, (key, title) in enumerate(SKILLS)
    )
    return RoleProfile(
        role_key=role_key,
        role_title=ROLE_LABELS[role_key],
        profile_scope="impulse_learning",
        scale_key=SCALE_KEY,
        framework_version=SOURCE_MAP_VERSION,
        as_of=current_time,
        skills=skills,
        certification_state="not_evaluable",
        certification_reason=(
            "В корпоративной методологии есть неразрешённые разночтения; "
            "учебный профиль не является официальным сертификатом L1."
        ),
        known_evidence_count=sum(item.evidence_count for item in skills),
        data_origin="verified_evidence"
        if any(item.evidence_count for item in skills)
        else "not_connected",
    )


__all__ = [
    "ROLE_TARGETS",
    "SCALE_KEY",
    "SKILLS",
    "SOURCE_MAP_VERSION",
    "QualifiedEvidence",
    "RoleProfile",
    "SkillPosition",
    "VerificationStatus",
    "evaluate_profile",
]
