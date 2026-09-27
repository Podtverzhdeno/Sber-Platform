"""PostgreSQL scenarios for immutable rating policy versions."""

import os
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import DBAPIError

from impulse.api.errors import ApiError
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.domain.recognition import (
    CohortRule,
    Credential,
    CredentialStatus,
    DiplomaThreshold,
    OfferEvidence,
    RatingPolicy,
    RatingSeason,
    ScoreEntry,
    ScoreSourceRule,
    TieBreaker,
    public_leaderboard,
    rebuild_standings,
)
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.models.identity import visibility_settings
from impulse.infrastructure.models.recognition import (
    credentials,
    offer_evidence,
    score_ledger,
    trophies,
)
from impulse.infrastructure.recognition_store import SqlRecognitionStore

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_policy_round_trip_and_season_binding() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    store = SqlRecognitionStore(database)
    season = RatingSeason(uuid4(), f"test-{uuid4().hex}", "Test season")
    await store.add_season(season)
    policy = RatingPolicy(
        uuid4(),
        season.season_id,
        1,
        CohortRule("python", "Python", "impulse-demo", ("python",), 2),
        (ScoreSourceRule("project", "project", Decimal("1.5"), Decimal("600")),),
        (TieBreaker.SUCCESSFUL_PROJECTS, TieBreaker.PERSON_ID),
        (DiplomaThreshold("gold", 1, 3, "I degree"),),
        14,
    )
    await store.add_policy(policy)
    opened = season.open(policy)
    await store.save_season(opened, season.version)

    assert await store.latest_policy(season.season_id) == policy
    assert await store.season(season.season_id) == opened

    members = await store.cohort_members(policy)
    assert members
    source_id = uuid4()
    original = ScoreEntry(
        uuid4(),
        season.season_id,
        members[0].person_id,
        "project",
        source_id,
        "project",
        Decimal("80"),
        datetime.now(UTC),
    )
    await store.add_score_entry(original)
    with pytest.raises(ApiError) as duplicate:
        await store.add_score_entry(
            ScoreEntry(
                uuid4(),
                season.season_id,
                members[0].person_id,
                "project",
                source_id,
                "project",
                Decimal("80"),
                datetime.now(UTC),
            )
        )
    assert duplicate.value.code == "DUPLICATE_SCORE_SOURCE"
    correction = ScoreEntry(
        uuid4(),
        season.season_id,
        members[0].person_id,
        "project",
        uuid4(),
        "project",
        Decimal("-10"),
        datetime.now(UTC),
        correction_of=original.entry_id,
        correction_reason="Verified correction.",
    )
    await store.add_score_entry(correction)
    restored_entries = await store.score_entries(season.season_id)
    rows = rebuild_standings(policy, members, restored_entries)
    first_projection = await store.replace_standings(season.season_id, rows)
    second_projection = await store.replace_standings(season.season_id, rows)

    async with database.sessions() as session:
        ledger_count = await session.scalar(
            select(func.count())
            .select_from(score_ledger)
            .where(score_ledger.c.season_id == season.season_id)
        )
    assert ledger_count == 2
    assert first_projection == second_projection
    assert first_projection[0].score == Decimal("105.0")
    async with database.session() as session:
        for scope in ("public_rating", "public_trophies", "public_profile"):
            await session.execute(
                insert(visibility_settings).values(
                    person_id=members[0].person_id,
                    scope=scope,
                    visible=True,
                    data_origin="demo_runtime",
                )
            )
        await session.execute(
            insert(trophies).values(
                person_id=members[0].person_id,
                participation_claim_id=demo_id("participation:alex:1"),
                trophy_type="winner",
                status="active",
                data_origin="demo_runtime",
            )
        )
    public_rows = public_leaderboard(await store.leaderboard_candidates(season.season_id))
    assert public_rows[0].person_id == members[0].person_id
    assert public_rows[0].trophies[0].trophy_type == "winner"
    assert public_rows[0].trophies[0].source_url.startswith("https://")
    assert public_rows[0].offers == ()

    verified_offer = OfferEvidence(
        uuid4(),
        members[0].person_id,
        "demo-organizer",
        f"offer-{uuid4().hex}",
        "Demo Hack",
        "https://example.test/offer-proof",
        "Personal offer confirmed by organizer.",
        datetime.now(UTC),
    )
    await store.add_offer_evidence(verified_offer)
    with_offer = public_leaderboard(await store.leaderboard_candidates(season.season_id))
    assert with_offer[0].offers[0].basis.startswith("Personal offer")
    await store.save_offer_evidence(verified_offer.revoke("Organizer correction."))
    after_revoke = public_leaderboard(await store.leaderboard_candidates(season.season_id))
    assert after_revoke[0].offers == ()

    async with database.session() as session:
        await session.execute(
            update(visibility_settings)
            .where(
                visibility_settings.c.person_id == members[0].person_id,
                visibility_settings.c.scope == "public_rating",
            )
            .values(visible=False)
        )
    hidden_rows = public_leaderboard(await store.leaderboard_candidates(season.season_id))
    assert hidden_rows[0].person_id is None
    assert hidden_rows[0].trophies == ()
    issued = Credential(
        uuid4(),
        "verify-integration",
        season.season_id,
        members[0].person_id,
        "Demo Holder",
        1,
        1,
        CredentialStatus.VALID,
        "I degree",
        "gold",
        1,
        Decimal("105"),
        1,
        "python",
        "Python",
        "Test season",
        "test-period",
        datetime.now(UTC),
        "checksum-v1",
    )
    await store.add_credential(issued)
    superseded = issued.supersede("Corrected standing.")
    replacement = Credential(
        uuid4(),
        "verify-integration-v2",
        season.season_id,
        members[0].person_id,
        "Demo Holder",
        2,
        1,
        CredentialStatus.VALID,
        "I degree",
        "gold",
        1,
        Decimal("105"),
        1,
        "python",
        "Python",
        "Test season",
        "test-period",
        datetime.now(UTC),
        "checksum-v2",
        supersedes_id=issued.credential_id,
    )
    await store.replace_credential(superseded, replacement)
    assert (
        await store.credential_by_verification("verify-integration")
    ).status is CredentialStatus.SUPERSEDED  # type: ignore[union-attr]
    revoked = replacement.revoke("Source revoked.")
    await store.save_credential(revoked)
    assert (await store.credential(replacement.credential_id)).status is CredentialStatus.REVOKED  # type: ignore[union-attr]
    async with database.session() as session:
        await session.execute(
            delete(credentials).where(credentials.c.season_id == season.season_id)
        )
        await session.execute(
            delete(offer_evidence).where(offer_evidence.c.id == verified_offer.evidence_id)
        )
    with pytest.raises(DBAPIError):
        async with database.session() as session:
            await session.execute(
                update(score_ledger)
                .where(score_ledger.c.id == original.entry_id)
                .values(points=Decimal("999"))
            )
    await database.close()
