"""Versioned competency frameworks and evidence-anchored level calculation.

A framework version freezes the skill list and, for every skill, the exact
evidence sources that may prove it. Level calculation is explainable: each
observed level points at the concrete evidence row it comes from, and rows
whose source is not allowed for that skill are reported as excluded instead
of silently raising the level.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class FrameworkDomain(StrEnum):
    COURSE = "course"
    ROLE = "role"
    PROJECT = "project"


LEVEL_RANK: dict[str, int] = {"базовый": 0, "уверенный": 1}
"""Ordinal order of level labels, lowest first."""

UNKNOWN_LEVEL = "не подтверждено"


@dataclass(frozen=True, slots=True)
class CompetencySkill:
    """One skill of a framework version plus its allowed evidence sources."""

    key: str
    title: str
    evidence_sources: tuple[tuple[str, str], ...] = ()
    """(source_kind, source_ref) pairs allowed to prove this skill."""


@dataclass(frozen=True, slots=True)
class FrameworkVersion:
    framework_key: str
    domain: FrameworkDomain
    version: int
    title: str
    created_at: datetime
    skills: tuple[CompetencySkill, ...]


@dataclass(frozen=True, slots=True)
class CompetencyEvidence:
    """One observed level anchored to an immutable source."""

    person_id: UUID
    competency_key: str
    source_kind: str
    source_ref: str
    level: str
    observed_at: datetime
    evidence_id: UUID | None = None

    def fingerprint(self) -> tuple[UUID, str, str, str]:
        return (self.person_id, self.competency_key, self.source_kind, self.source_ref)


@dataclass(frozen=True, slots=True)
class LevelAnchor:
    """Explainable chain entry: what evidence contributed and why."""

    row: CompetencyEvidence
    reason: str


@dataclass(frozen=True, slots=True)
class CompetencyLevelExplanation:
    skill: CompetencySkill
    level: str
    anchors: tuple[LevelAnchor, ...]
    excluded: tuple[LevelAnchor, ...]


def strongest_level(levels: list[str]) -> str | None:
    """Return the strongest observed level label or None when nothing observed."""
    ranked = [LEVEL_RANK[level] for level in levels if level in LEVEL_RANK]
    if not ranked:
        return None
    best = max(ranked)
    for label, rank in LEVEL_RANK.items():
        if rank == best:
            return label
    return None
