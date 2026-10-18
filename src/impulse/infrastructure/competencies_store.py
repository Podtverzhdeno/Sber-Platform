"""PostgreSQL stores for versioned competency frameworks and evidence."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from impulse.application.competencies import EvidenceStore, FrameworkStore
from impulse.domain.competencies import (
    CompetencyEvidence,
    CompetencySkill,
    FrameworkDomain,
    FrameworkVersion,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.competencies import (
    competency_definitions,
    competency_evidence,
    competency_models,
)


class SqlFrameworkStore(FrameworkStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def version(self, framework_key: str, framework_version: int) -> FrameworkVersion | None:
        versions = await self.versions(framework_key)
        return next((item for item in versions if item.version == framework_version), None)

    async def current_version(self, framework_key: str) -> FrameworkVersion | None:
        versions = await self.versions(framework_key)
        return max(versions, key=lambda item: item.version, default=None)

    async def versions(self, framework_key: str | None = None) -> tuple[FrameworkVersion, ...]:
        query = select(competency_models).order_by(
            competency_models.c.framework_key, competency_models.c.framework_version
        )
        if framework_key is not None:
            query = query.where(competency_models.c.framework_key == framework_key)
        async with self.database.sessions() as session:
            model_rows = (await session.execute(query)).all()
            result: list[FrameworkVersion] = []
            for model in model_rows:
                definitions = (
                    await session.execute(
                        select(competency_definitions)
                        .where(competency_definitions.c.model_id == model.id)
                        .order_by(competency_definitions.c.competency_key)
                    )
                ).all()
                result.append(
                    FrameworkVersion(
                        model.framework_key,
                        FrameworkDomain(model.domain),
                        model.framework_version,
                        model.title,
                        model.created_at,
                        tuple(
                            CompetencySkill(
                                row.competency_key,
                                row.title,
                                tuple(
                                    tuple(item) for item in row.payload.get("evidence_sources", [])
                                ),
                            )
                            for row in definitions
                        ),
                    )
                )
            return tuple(result)

    async def publish(self, version: FrameworkVersion) -> FrameworkVersion:
        from uuid import uuid4

        model_id = uuid4()
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(competency_models).values(
                    id=model_id,
                    framework_key=version.framework_key,
                    domain=version.domain.value,
                    framework_version=version.version,
                    title=version.title,
                    created_at=version.created_at,
                )
            )
            for skill in version.skills:
                await session.execute(
                    postgres_insert(competency_definitions).values(
                        id=uuid4(),
                        model_id=model_id,
                        competency_key=skill.key,
                        title=skill.title,
                        payload={
                            "evidence_sources": [list(item) for item in skill.evidence_sources]
                        },
                    )
                )
        return version


class SqlCompetencyEvidenceStore(EvidenceStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    async def evidence_for_person(self, person_id: UUID) -> tuple[CompetencyEvidence, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(competency_evidence)
                    .where(competency_evidence.c.person_id == person_id)
                    .order_by(competency_evidence.c.created_at)
                )
            ).all()
            return tuple(
                CompetencyEvidence(
                    row.person_id,
                    row.competency_key,
                    row.source_kind,
                    row.source_ref,
                    row.level,
                    row.created_at,
                    row.id,
                )
                for row in rows
            )

    async def add_evidence(self, evidence: CompetencyEvidence) -> CompetencyEvidence:
        from uuid import uuid4

        evidence_id = evidence.evidence_id or uuid4()
        async with self.database.session() as session:
            await session.execute(
                postgres_insert(competency_evidence)
                .values(
                    id=evidence_id,
                    person_id=evidence.person_id,
                    competency_key=evidence.competency_key,
                    source_kind=evidence.source_kind,
                    source_ref=evidence.source_ref,
                    level=evidence.level,
                    created_at=evidence.observed_at,
                    data_origin="demo_runtime",
                )
                .on_conflict_do_update(
                    index_elements=[
                        "person_id",
                        "competency_key",
                        "source_kind",
                        "source_ref",
                    ],
                    set_={
                        "level": evidence.level,
                        "version": competency_evidence.c.version + 1,
                    },
                )
            )
        return CompetencyEvidence(
            evidence.person_id,
            evidence.competency_key,
            evidence.source_kind,
            evidence.source_ref,
            evidence.level,
            evidence.observed_at,
            evidence_id,
        )
