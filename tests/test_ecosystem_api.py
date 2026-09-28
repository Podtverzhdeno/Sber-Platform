"""Event catalog and participation claim API contracts."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.ecosystem import EcosystemService, MemoryEcosystemStore
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client_and_store() -> tuple[TestClient, MemoryEcosystemStore]:
    personas = demo_personas()
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("ecosystem-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(personas),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryEcosystemStore(people={f"demo:{item.key}": item.person_id for item in personas})
    app = create_app(
        settings,
        auth_service=auth,
        ecosystem_service=EcosystemService(store),
    )
    return TestClient(app), store


def login(client: TestClient, persona_key: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_catalog_filters_cursor_and_source_freshness() -> None:
    client, _store = client_and_store()
    with client:
        login(client, "participant-alex")
        page = client.get(
            "/api/v1/ecosystem/events",
            params={"track": "python", "status": "open", "limit": 1},
        )
        assert page.status_code == 200
        body = page.json()
        assert len(body["items"]) == 1
        assert body["has_more"] is True
        assert body["next_cursor"]
        event = body["items"][0]
        assert event["source_url"].startswith("https://")
        assert event["source_checked_at"].endswith("Z")
        assert "python" in event["track_keys"]
        assert event["recommendation_reason"]

        next_page = client.get(
            "/api/v1/ecosystem/events",
            params={
                "track": "python",
                "status": "open",
                "limit": 1,
                "cursor": body["next_cursor"],
            },
        )
        assert next_page.json()["items"][0]["key"] != event["key"]


def test_report_submit_verify_and_revoke_claim() -> None:
    client, store = client_and_store()
    with client:
        participant_csrf = login(client, "participant-alex")
        reported = client.post(
            "/api/v1/me/events/mayaki-2026/claims",
            json={"claim_type": "winner"},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert reported.status_code == 200
        assert reported.json()["status"] == "reported"
        assert reported.json()["trophy_created"] is False
        assert reported.json()["evidence_state"] == "provisional"
        claim_id = reported.json()["id"]

        awaiting = client.post(
            f"/api/v1/me/event-claims/{claim_id}/submit",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert awaiting.json()["status"] == "awaiting_verification"
        assert awaiting.json()["trophy_created"] is False
        assert awaiting.json()["evidence_state"] == "provisional"

        operator_csrf = login(client, "operator-pavel")
        verified = client.post(
            f"/api/v1/operations/event-claims/{claim_id}/decision",
            json={"status": "verified", "reason": "Источник подтверждён"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert verified.json()["trophy_created"] is True
        assert verified.json()["evidence_state"] == "verified"
        assert len(store.trophies) == 1

        revoked = client.post(
            f"/api/v1/operations/event-claims/{claim_id}/decision",
            json={"status": "revoked", "reason": "Источник исправил список"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert revoked.json()["status"] == "revoked"
        assert revoked.json()["trophy_created"] is False
        assert revoked.json()["evidence_state"] == "invalid"
        assert not store.trophies
