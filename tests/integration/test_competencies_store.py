"""PostgreSQL scenarios for versioned competency frameworks and evidence."""

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select

from impulse.application.competencies import CompetencyService
from impulse.bootstrap.demo_seed import demo_id
from impulse.domain.competencies import CompetencySkill, FrameworkDomain, FrameworkVersion
from impulse.infrastructure.competencies_store import (
    SqlCompetencyEvidenceStore,
    SqlFrameworkStore,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.competencies import competency_evidence

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


def database() -> Database:
    return Database(integration_url())


def demo_framework(version: int) -> FrameworkVersion:
    return FrameworkVersion(
        f"test:framework-{uuid4().hex[:8]}",
        FrameworkDomain.PROJECT,
        version,
        "Тестовый фреймворк",
        datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
        (
            CompetencySkill(
                "delivery",
                "Доставка результата",
                (("project", "semantic-search-rd"),),
            ),
        ),
    )


@pytest.mark.asyncio
async def test_framework_and_evidence_round_trip() -> None:
    database_url = integration_url()
    db = Database(database_url)
    paint = CompetencyService(SqlFrameworkStore(db), SqlCompetencyEvidenceStore(db))
    person = demo_id("participant-alex")
    try:
        published = await paint.publish_framework(demo_framework(1))
        stored = await paint.frameworks.version(published.framework_key, 1)
        assert stored is not None and stored.framework_key == published.framework_key
        assert stored.skills[0].evidence_sources == (("project", "semantic-search-rd"),)

        await paint.record_source_transition(
            person,
            "delivery",
            source_kind="project",
            source_ref="semantic-search-rd",
            level="уверенный",
        )
        rows = await SqlCompetencyEvidenceStore(db).evidence_for_person(person)
        assert any(row.competency_key == "delivery" for row in rows)
        assert rows[-1].evidence_id is not None

        async with db.sessions() as session:
            total = (
                await session.execute(
                    select(func.count())
                    .select_from(competency_evidence)
                    .where(competency_evidence.c.person_id == person)
                )
            ).scalar_one()
            assert total >= 1
    finally:
        async with db.session() as session:
            await session.execute(
                delete(competency_evidence).where(competency_evidence.c.person_id == person)
            )
            await db.close()


@pytest.mark.asyncio
async def test_evidence_upsert_updates_level_in_place() -> None:
    db = Database(integration_url())
    paint = CompetencyService(SqlFrameworkStore(db), SqlCompetencyEvidenceStore(db))
    person = demo_id("participant-maria")
    try:
        first = await paint.record_source_transition(
            person, "delivery", source_kind="project", source_ref="case-alpha", level="базовый"
        )
        second = await paint.record_source_transition(
            person, "delivery", source_kind="project", source_ref="case-alpha", level="уверенный"
        )
        rows = await SqlCompetencyEvidenceStore(db).evidence_for_person(person)
        matching = [row for row in rows if row.source_ref == "case-alpha"]
        assert len(matching) == 1
        assert matching[0].level == "уверенный"
        assert matching[0].evidence_id == first.evidence_id
        assert second.level == "уверенный"
    finally:
        async with db.session() as session:
            await session.execute(
                delete(competency_evidence).where(competency_evidence.c.person_id == person)
            )
            await db.close()
