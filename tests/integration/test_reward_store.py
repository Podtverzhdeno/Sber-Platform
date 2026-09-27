"""PostgreSQL persistence for append-only 5+ review versions."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from impulse.application.reward import DEFAULT_REVIEW_RUBRIC
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.domain.reward import CriterionAssessment, Review5Plus, ReviewGrade
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.reward import review_5plus_versions
from impulse.infrastructure.reward_store import SqlRewardStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_review_versions_are_append_only_and_restore_human_signatures() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    store = SqlRewardStore(database)
    rubric = await store.rubric(DEFAULT_REVIEW_RUBRIC.rubric_id)
    assert rubric == DEFAULT_REVIEW_RUBRIC

    mentor_id = demo_id("mentor-elena")
    draft = Review5Plus.draft(
        review_id=uuid4(),
        contribution_id=demo_id("contribution:1:1"),
        contribution_version=1,
        rubric=DEFAULT_REVIEW_RUBRIC,
        grade=ReviewGrade.B,
        assessments=tuple(
            CriterionAssessment(
                criterion.key,
                f"Подтверждён факт: {criterion.title}.",
                (f"artifact:{criterion.key}",),
            )
            for criterion in DEFAULT_REVIEW_RUBRIC.criteria
        ),
        explanation="Оценка B подтверждена фактами принятого личного вклада.",
        draft_origin="ai_suggestion",
    )
    versions = (
        draft,
        draft.propose(),
        draft.propose().confirm(mentor_id),
        draft.propose()
        .confirm(mentor_id)
        .publish(
            mentor_id,
            contribution_accepted=True,
            authorship_conflict_open=False,
        ),
    )
    for version in versions:
        await store.add_review_version(version)

    restored = await store.review(draft.review_id)
    assert restored == versions[-1]
    async with database.sessions() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(review_5plus_versions)
            .where(review_5plus_versions.c.review_id == draft.review_id)
        )
    await database.close()
    assert count == 4
