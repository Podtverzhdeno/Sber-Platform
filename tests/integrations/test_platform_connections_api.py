"""Catalog and lifecycle acceptance scenarios for platform connections (22.20)."""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from impulse.integrations.providers import (
    GIGAAGENT,
    GIGACOWORK,
    GITVERSE,
)
from impulse.integrations.service import ConnectionStatus

from .conftest import (
    PlatformFixture,
    completed_connection,
    connect_and_confirm,
)

PROJECT = uuid4()
OTHER_PROJECT = uuid4()


def catalog(client: TestClient, project_id: UUID) -> dict[str, list[dict[str, object]]]:
    response = client.get(f"/api/v1/projects/{project_id}/platforms")
    assert response.status_code == 200, response.text
    return response.json()


def card_for(payload: dict[str, list[dict[str, object]]], provider_key: str) -> dict[str, object]:
    matches = [item for item in payload["items"] if item["provider_key"] == provider_key]
    assert len(matches) == 1
    return matches[0]


def test_catalog_shows_enabled_providers_with_real_states(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    payload = catalog(client, PROJECT)
    keys = [item["provider_key"] for item in payload["items"]]
    assert keys == ["gigacode", "gitverse"]
    gigacode = card_for(payload, "gigacode")
    assert gigacode["title"] == "GigaCode"
    assert gigacode["purpose"] == (
        "ИИ-разработка кода проекта: ассистент, ревью и чат по репозиторию задания."
    )
    required_permissions = gigacode["required_permissions"]
    assert isinstance(required_permissions, list)
    assert "repo:read" in required_permissions
    assert gigacode["connection"] is None
    assert gigacode["repository_label"] == "Репозиторий участник/проект"

    view = connect_and_confirm(client, csrf, PROJECT)
    assert view["status"] == "connected"

    payload = catalog(client, PROJECT)
    gitverse = card_for(payload, GITVERSE.key)
    connection = gitverse["connection"]
    assert isinstance(connection, dict)
    assert connection["workspace_ref"] == "impulse-demo/navigator"
    assert connection["status"] == ConnectionStatus.CONNECTED.value
    assert connection["scopes"] == ["repo:read", "repo:commit:read"]
    assert gitverse["repository_label"] == GITVERSE.repository_label


def test_connect_gitverse_is_project_scoped_with_audit(platform: PlatformFixture) -> None:
    """Spec: связь привязана к project+assignment; другой проект repository не получает."""
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    platform.membership.add(OTHER_PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    view = connect_and_confirm(client, csrf, PROJECT)
    assert view["status"] == "connected"
    connection_id = UUID(str(view["id"]))

    events = asyncio.run(platform.store.audit_for(connection_id))
    actions = [event.action for event in events]
    assert "connect_started" in actions
    assert "connect_completed" in actions
    assert all(event.project_id == PROJECT for event in events)
    assert all(event.provider_key == GITVERSE.key for event in events)

    other = catalog(client, OTHER_PROJECT)
    assert card_for(other, GITVERSE.key)["connection"] is None
    connected = catalog(client, PROJECT)
    assert card_for(connected, GITVERSE.key)["connection"] is not None


def test_workspace_and_scope_validation_rejects_invalid_requests(
    platform: PlatformFixture,
) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    missing = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GITVERSE.key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert missing.status_code == 422
    assert missing.json()["code"] == "PLATFORM_WORKSPACE_REQUIRED"

    unknown_scope = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GITVERSE.key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator", "scopes": ["repo:delete"]},
    )
    assert unknown_scope.status_code == 422
    assert unknown_scope.json()["code"] == "PLATFORM_SCOPE_UNKNOWN"

    disabled = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GIGACOWORK.key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "room-demo"},
    )
    assert disabled.status_code == 404
    assert disabled.json()["code"] == "RESOURCE_NOT_FOUND"

    agent_console = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GIGAAGENT.key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert agent_console.status_code == 404


def test_deep_link_only_for_connected_platform(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    connection_id = completed_connection(client, csrf, PROJECT)
    link = client.get(f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/deep-link")
    assert link.status_code == 200
    assert link.json()["url"] == "https://gitverse.ru/impulse-demo/navigator"

    revoked = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/revoke",
        headers={"X-CSRF-Token": csrf},
    )
    assert revoked.status_code == 200

    after = client.get(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/deep-link"
    )
    assert after.status_code == 409
    assert after.json()["code"] == "PLATFORM_LINK_UNAVAILABLE"


def test_revoke_is_idempotent_and_stops_provider_access(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    connection_id = completed_connection(client, csrf, PROJECT)
    revoked = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/revoke",
        headers={"X-CSRF-Token": csrf},
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert len(platform.gateway.revoke_calls) == 1

    again = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/revoke",
        headers={"X-CSRF-Token": csrf},
    )
    assert again.status_code == 200
    assert again.json()["status"] == "revoked"
    assert len(platform.gateway.revoke_calls) == 1

    events = [
        event
        for event in asyncio.run(platform.store.audit_for(connection_id))
        if event.action == "revoked"
    ]
    assert len(events) == 1
    assert events[0].outcome == "provider_confirmed"

    payload = catalog(client, PROJECT)
    assert card_for(payload, GITVERSE.key)["connection"] is None


def test_reconnect_available_for_connected_platform(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")

    completed_connection(client, csrf, PROJECT)
    duplicate = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GITVERSE.key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "other/try"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "PLATFORM_ALREADY_CONNECTED"

    reconnect = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GITVERSE.key}/reconnect",
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert reconnect.status_code == 201
    challenge = reconnect.json()
    assert "authorization_url" in challenge
    assert challenge["state"]

    reconnect_completed = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/{GITVERSE.key}/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": challenge["state"],
            "code": "oauth_code_demo",
            "idempotency_key": "reconnect-demo",
        },
    )
    assert reconnect_completed.status_code == 200
    assert reconnect_completed.json()["status"] == "connected"


def test_non_member_receives_non_disclosing_404(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    platform.membership.add(OTHER_PROJECT, platform.person_ids["participant-maria"])
    stranger = TestClient(platform.app)
    login = stranger.post("/api/v1/auth/demo-login", json={"persona_key": "participant-maria"})
    assert login.status_code == 200

    leaked = stranger.get(f"/api/v1/projects/{PROJECT}/platforms")
    assert leaked.status_code == 404
    assert leaked.json()["code"] == "RESOURCE_NOT_FOUND"

    unknown = stranger.get(f"/api/v1/projects/{uuid4()}/platforms")
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "RESOURCE_NOT_FOUND"
