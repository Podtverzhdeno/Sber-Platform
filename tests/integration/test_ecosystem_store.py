"""PostgreSQL external evidence lifecycle and append-only correction tests."""
# ruff: noqa: RUF001

from __future__ import annotations

import os
from decimal import Decimal

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from impulse.application.ecosystem import EcosystemService
from impulse.application.identity import DemoAuthService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id, seed_demo
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.infrastructure.database import Database, async_database_url
from impulse.infrastructure.ecosystem_store import SqlEcosystemStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.models.ecosystem import participation_claims, provider_records
from impulse.infrastructure.models.recognition import credentials, score_ledger, seasons, trophies

pytestmark = pytest.mark.integration


def integration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return async_database_url(url)


@pytest.mark.asyncio
async def test_revoke_appends_score_and_credential_corrections_without_rewrite() -> None:
    database = Database(integration_url())
    await seed_demo(database)
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("ecosystem-integration-secret-long-enough"),
    )
    auth = DemoAuthService(
        SqlIdentityStore(database),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(
        settings,
        auth_service=auth,
        ecosystem_service=EcosystemService(SqlEcosystemStore(database)),
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        participant_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        )
        participant_csrf = participant_login.json()["csrf_token"]
        reported = await client.post(
            "/api/v1/me/events/demo-event-2/claims",
            json={"claim_type": "winner"},
            headers={"X-CSRF-Token": participant_csrf},
        )
        claim_id = reported.json()["id"]
        await client.post(
            f"/api/v1/me/event-claims/{claim_id}/submit",
            headers={"X-CSRF-Token": participant_csrf},
        )
        operator_login = await client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "operator-pavel"}
        )
        operator_csrf = operator_login.json()["csrf_token"]
        verified = await client.post(
            f"/api/v1/operations/event-claims/{claim_id}/decision",
            json={"status": "verified", "reason": "Проверено у организатора"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert verified.json()["trophy_created"] is True

        async with database.session() as session:
            season_id = await session.scalar(
                select(seasons.c.id).where(seasons.c.season_key == "demo-autumn-2026")
            )
            await session.execute(
                insert(score_ledger).values(
                    season_id=season_id,
                    person_id=demo_id("participant-alex"),
                    source_type="participation_claim",
                    source_id=claim_id,
                    rule_id="verified-external-win",
                    points=Decimal("40"),
                    data_origin="demo_runtime",
                )
            )
            await session.execute(
                insert(credentials).values(
                    season_id=season_id,
                    person_id=demo_id("participant-alex"),
                    verification_id="ecosystem-before-revoke",
                    credential_version=1,
                    status="issued",
                    data_origin="demo_runtime",
                    payload={"source_claim_ids": [claim_id]},
                )
            )

        revoked = await client.post(
            f"/api/v1/operations/event-claims/{claim_id}/decision",
            json={"status": "revoked", "reason": "Организатор исправил список"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert revoked.json()["status"] == "revoked"

        import_body = {
            "provider_id": "demo-organizer",
            "external_id": "external-participation-42",
            "person_external_key": "demo:participant-alex",
            "event_key": "demo-event-3",
            "claim_type": "participation",
        }
        first_import = await client.post(
            "/api/v1/operations/event-claims/import",
            json=import_body,
            headers={"X-CSRF-Token": operator_csrf},
        )
        second_import = await client.post(
            "/api/v1/operations/event-claims/import",
            json=import_body,
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert first_import.json()["id"] == second_import.json()["id"]

    async with database.sessions() as session:
        score_rows = (
            await session.execute(
                select(score_ledger.c.points, score_ledger.c.status)
                .where(score_ledger.c.source_id == claim_id)
                .order_by(score_ledger.c.created_at)
            )
        ).all()
        credential_rows = (
            await session.execute(
                select(credentials.c.credential_version, credentials.c.status)
                .where(
                    credentials.c.person_id == demo_id("participant-alex"),
                    credentials.c.verification_id.in_(
                        ["ecosystem-before-revoke", f"revoked-{claim_id.replace('-', '')}-2"]
                    ),
                )
                .order_by(credentials.c.credential_version)
            )
        ).all()
        trophy_status = await session.scalar(
            select(trophies.c.status).where(trophies.c.participation_claim_id == claim_id)
        )
        provider_count = int(
            await session.scalar(
                select(func.count())
                .select_from(provider_records)
                .where(
                    provider_records.c.provider_id == "demo-organizer",
                    provider_records.c.external_id == "external-participation-42",
                )
            )
            or 0
        )
        imported_claim_count = int(
            await session.scalar(
                select(func.count())
                .select_from(participation_claims)
                .where(participation_claims.c.id == first_import.json()["id"])
            )
            or 0
        )

    assert score_rows == [(Decimal("40.0000"), "active"), (Decimal("-40.0000"), "correction")]
    assert credential_rows == [(1, "issued"), (2, "revoked")]
    assert trophy_status == "revoked"
    assert provider_count == 1
    assert imported_claim_count == 1
    await database.close()
