"""PostgreSQL payout persistence and idempotency scenarios."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from impulse.application.reward import DEFAULT_REVIEW_RUBRIC
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.domain.reward import (
    AppealStatus,
    CriterionAssessment,
    PayoutClaim,
    PayoutStatus,
    Review5Plus,
    ReviewAppeal,
    ReviewGrade,
    SettlementAttempt,
    SettlementKind,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.reward import review_5plus_versions
from impulse.infrastructure.models.work import assignments
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
    assert restored is not None
    assert restored == versions[-1]
    now = datetime.now(UTC)
    appeal = ReviewAppeal(
        appeal_id=uuid4(),
        review_id=draft.review_id,
        disputed_review_version=restored.review_version,
        participant_id=demo_id("participant-alex"),
        reason="Участник просит повторно проверить факты.",
        opened_at=now,
        deadline_at=now + timedelta(days=14),
    )
    disputed = restored.dispute()
    await store.add_review_appeal(appeal, disputed)
    upheld = disputed.uphold(mentor_id)
    resolved = appeal.resolve(
        status=AppealStatus.UPHELD,
        human_id=mentor_id,
        reason="Исходная оценка подтверждена фактами.",
        resulting_review_version=upheld.review_version,
    )
    await store.resolve_review_appeal(
        resolved,
        upheld,
        expected_appeal_version=appeal.version,
        expected_review_version=disputed.review_version,
    )
    restored_after_appeal = await store.review(draft.review_id)
    assert restored_after_appeal == upheld
    assert (await store.appeal(appeal.appeal_id)) == resolved
    async with database.sessions() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(review_5plus_versions)
            .where(review_5plus_versions.c.review_id == draft.review_id)
        )
    await database.close()
    assert count == 6


@pytest.mark.asyncio
async def test_sql_payout_versioning_and_request_key_are_idempotent() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    async with database.sessions() as session:
        assignment_id = await session.scalar(select(assignments.c.id).limit(1))
    assert assignment_id is not None

    store = SqlRewardStore(database)
    claim = PayoutClaim(
        claim_id=uuid4(),
        assignment_id=assignment_id,
        contribution_version=91,
        terms_version=73,
        review_id=uuid4(),
        review_version=4,
        grade=ReviewGrade.B,
        amount=Decimal("15000.00"),
        currency="RUB",
        status=PayoutStatus.CALCULATED,
    )
    await store.add_payout_claim(claim)
    approved = claim.approve(uuid4())
    await store.save_payout_claim(approved, claim.version)
    paid = approved.send().settle(success=True)
    await store.save_payout_claim(paid, approved.version)

    attempt = SettlementAttempt(
        attempt_id=uuid4(),
        payout_claim_id=claim.claim_id,
        attempt_number=1,
        request_key=f"payment-{uuid4().hex}",
        kind=SettlementKind.PAYMENT,
        status=PayoutStatus.PAID,
        provider_reference="demo-paid",
    )
    first = await store.add_settlement_attempt(attempt)
    duplicate = await store.add_settlement_attempt(
        SettlementAttempt(
            attempt_id=uuid4(),
            payout_claim_id=claim.claim_id,
            attempt_number=2,
            request_key=attempt.request_key,
            kind=SettlementKind.PAYMENT,
            status=PayoutStatus.PAID,
            provider_reference="must-not-be-used",
        )
    )

    persisted = await store.payout_claim_by_id(claim.claim_id)
    assert persisted is not None
    assert persisted.status is PayoutStatus.PAID
    assert duplicate.attempt_id == first.attempt_id
    assert await store.next_settlement_attempt_number(claim.claim_id) == 2
    await database.close()
