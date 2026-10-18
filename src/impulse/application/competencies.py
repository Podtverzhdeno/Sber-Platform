"""Competency framework registry, evidence store and explainable level reports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from impulse.domain.competencies import (
    LEVEL_RANK,
    UNKNOWN_LEVEL,
    CompetencyEvidence,
    CompetencySkill,
    FrameworkDomain,
    FrameworkVersion,
    LevelAnchor,
    strongest_level,
)


class FrameworkStore(Protocol):
    async def version(
        self, framework_key: str, framework_version: int
    ) -> FrameworkVersion | None: ...

    async def current_version(self, framework_key: str) -> FrameworkVersion | None: ...

    async def versions(self, framework_key: str | None = None) -> tuple[FrameworkVersion, ...]: ...

    async def publish(self, version: FrameworkVersion) -> FrameworkVersion: ...


class EvidenceStore(Protocol):
    async def evidence_for_person(self, person_id: UUID) -> tuple[CompetencyEvidence, ...]: ...

    async def add_evidence(self, evidence: CompetencyEvidence) -> CompetencyEvidence: ...


@dataclass(frozen=True, slots=True)
class SkillReport:
    skill: CompetencySkill
    level: str
    anchors: tuple[LevelAnchor, ...]
    excluded: tuple[LevelAnchor, ...]

    def explanation(self) -> str:
        if not self.anchors:
            return "Нет подтверждённого опыта: указанные источники не наблюдались."
        parts = [
            f"{anchor.row.source_kind} {anchor.row.source_ref} · {anchor.row.level}"
            for anchor in self.anchors
        ]
        return f"Уровень {self.level} сложился из {len(self.anchors)} источников: " + "; ".join(
            parts
        )


@dataclass(frozen=True, slots=True)
class FrameworkReport:
    framework_key: str
    domain: str
    version: int
    title: str
    skills: tuple[SkillReport, ...]
    created_at: datetime


class MemoryFrameworkStore:
    """In-memory registry keeping every published version immutable."""

    def __init__(self) -> None:
        self._versions: dict[str, dict[int, FrameworkVersion]] = {}

    async def version(self, framework_key: str, framework_version: int) -> FrameworkVersion | None:
        return self._versions.get(framework_key, {}).get(framework_version)

    async def current_version(self, framework_key: str) -> FrameworkVersion | None:
        if framework_key not in self._versions:
            return None
        revision = max(self._versions[framework_key])
        return self._versions[framework_key][revision]

    async def versions(self, framework_key: str | None = None) -> tuple[FrameworkVersion, ...]:
        if framework_key is not None:
            return tuple(self._versions.get(framework_key, {}).values())
        collected = [item for keyed in self._versions.values() for item in keyed.values()]
        return tuple(collected)

    async def publish(self, version: FrameworkVersion) -> FrameworkVersion:
        stored = self._versions.setdefault(version.framework_key, {})
        if version.version in stored:
            raise ValueError(
                f"Framework version {version.framework_key} v{version.version} already published"
            )
        stored[version.version] = version
        return version


class MemoryCompetencyEvidenceStore:
    """In-memory evidence log with fingerprint-level dedupe."""

    def __init__(self) -> None:
        self._rows: dict[tuple[UUID, str, str, str], CompetencyEvidence] = {}

    async def evidence_for_person(self, person_id: UUID) -> tuple[CompetencyEvidence, ...]:
        rows = [row for key, row in self._rows.items() if key[0] == person_id]
        return tuple(sorted(rows, key=lambda row: row.observed_at))

    async def add_evidence(self, evidence: CompetencyEvidence) -> CompetencyEvidence:
        fingerprint = evidence.fingerprint()
        stored = self._rows.get(fingerprint)
        if stored is not None and stored.level == evidence.level:
            return stored
        if evidence.evidence_id is None and stored is None:
            row = CompetencyEvidence(
                person_id=evidence.person_id,
                competency_key=evidence.competency_key,
                source_kind=evidence.source_kind,
                source_ref=evidence.source_ref,
                level=evidence.level,
                observed_at=evidence.observed_at,
                evidence_id=uuid4(),
            )
        elif stored is None:
            row = evidence
        else:
            row = CompetencyEvidence(
                person_id=evidence.person_id,
                competency_key=evidence.competency_key,
                source_kind=evidence.source_kind,
                source_ref=evidence.source_ref,
                level=evidence.level,
                observed_at=evidence.observed_at,
                evidence_id=stored.evidence_id,
            )
        self._rows[fingerprint] = row
        return row


def _allows(row: CompetencyEvidence, skill: CompetencySkill) -> bool:
    for source_kind, source_ref in skill.evidence_sources:
        if row.source_kind != source_kind:
            continue
        if source_ref.endswith("*"):
            if row.source_ref.startswith(source_ref[:-1]):
                return True
        elif row.source_ref == source_ref:
            return True
    return False


def _rank(level: str) -> int:
    return LEVEL_RANK.get(level, -1)


def explain_skill(skill: CompetencySkill, rows: tuple[CompetencyEvidence, ...]) -> SkillReport:
    anchors: list[LevelAnchor] = []
    excluded: list[LevelAnchor] = []
    for row in rows:
        if row.competency_key != skill.key:
            continue
        if _allows(row, skill):
            anchors.append(LevelAnchor(row=row, reason="Подтверждённый источник"))
        else:
            excluded.append(
                LevelAnchor(
                    row=row,
                    reason="Источник не привязан к компетенции в этой версии фреймворка",
                )
            )
    level = strongest_level([anchor.row.level for anchor in anchors]) or UNKNOWN_LEVEL
    return SkillReport(
        skill=skill,
        level=level,
        anchors=tuple(sorted(anchors, key=lambda item: -_rank(item.row.level))),
        excluded=tuple(excluded),
    )


class CompetencyService:
    """Versioned frameworks plus explainable person level reports."""

    def __init__(self, frameworks: FrameworkStore, evidence: EvidenceStore) -> None:
        self.frameworks = frameworks
        self.evidence = evidence

    async def publish_framework(self, version: FrameworkVersion) -> FrameworkVersion:
        if not version.skills:
            raise ValueError("Framework version needs at least one skill")
        keys = [skill.key for skill in version.skills]
        if len(set(keys)) != len(keys):
            raise ValueError("Framework skill keys must be unique")
        stored = await self.frameworks.version(version.framework_key, version.version)
        if stored is not None:
            return stored
        return await self.frameworks.publish(version)

    async def record_evidence(self, row: CompetencyEvidence) -> CompetencyEvidence:
        return await self.evidence.add_evidence(row)

    async def framework_report(
        self, person_id: UUID, framework_key: str, *, version_number: int | None = None
    ) -> FrameworkReport | None:
        if version_number is None:
            version = await self.frameworks.current_version(framework_key)
        else:
            version = await self.frameworks.version(framework_key, version_number)
        if version is None:
            return None
        rows = await self.evidence.evidence_for_person(person_id)
        skills = tuple(explain_skill(skill, rows) for skill in version.skills)
        return FrameworkReport(
            framework_key=version.framework_key,
            domain=version.domain.value,
            version=version.version,
            title=version.title,
            skills=skills,
            created_at=version.created_at,
        )

    async def person_reports(self, person_id: UUID) -> tuple[FrameworkReport, ...]:
        reports: list[FrameworkReport] = []
        keys = sorted({version.framework_key for version in await self.frameworks.versions()})
        for key in keys:
            report = await self.framework_report(person_id, key)
            if report is not None:
                reports.append(report)
        return tuple(reports)

    async def record_source_transition(
        self,
        person_id: UUID,
        competency_key: str,
        *,
        source_kind: str,
        source_ref: str,
        level: str,
        observed_at: datetime | None = None,
    ) -> CompetencyEvidence:
        """Anchor one observed level to a domain source, dedup-safe."""
        return await self.record_evidence(
            CompetencyEvidence(
                person_id=person_id,
                competency_key=competency_key,
                source_kind=source_kind,
                source_ref=source_ref,
                level=level,
                observed_at=observed_at or datetime.now(UTC),
            )
        )


async def install_demo_competencies(service: CompetencyService, person_id: UUID) -> None:
    """Install a deterministic course, role and project model for the demo participant."""
    created_at = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    frameworks = (
        FrameworkVersion(
            "course:openspec-sdd",
            FrameworkDomain.COURSE,
            1,
            "OpenSpec и SDD",
            created_at,
            (
                CompetencySkill("specification", "Спецификация", (("course", "openspec-sdd"),)),
                CompetencySkill("delivery", "Доставка результата", (("course", "openspec-sdd"),)),
            ),
        ),
        FrameworkVersion(
            "role:product-engineer",
            FrameworkDomain.ROLE,
            1,
            "Продуктовый инженер",
            created_at,
            (
                CompetencySkill("specification", "Спецификация", (("course", "openspec-sdd"),)),
                CompetencySkill(
                    "delivery", "Доставка результата", (("project", "semantic-search-rd"),)
                ),
            ),
        ),
        FrameworkVersion(
            "project:semantic-search-rd",
            FrameworkDomain.PROJECT,
            1,
            "Семантический поиск",
            created_at,
            (
                CompetencySkill(
                    "delivery", "Доставка результата", (("project", "semantic-search-rd"),)
                ),
            ),
        ),
    )
    for framework in frameworks:
        if await service.frameworks.current_version(framework.framework_key) is None:
            await service.publish_framework(framework)
    for row in (
        CompetencyEvidence(
            person_id, "specification", "course", "openspec-sdd", "уверенный", created_at
        ),
        CompetencyEvidence(
            person_id,
            "delivery",
            "course",
            "openspec-sdd",
            "уверенный",
            created_at,
        ),
        CompetencyEvidence(
            person_id,
            "delivery",
            "project",
            "semantic-search-rd",
            "базовый",
            created_at,
        ),
    ):
        await service.record_evidence(row)
