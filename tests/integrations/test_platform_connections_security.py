"""Security scenarios: IDOR, CSRF/OAuth state, redaction, expiry, outage (22.20)."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from impulse.integrations.service import (
    ConnectionStatus,
    CredentialRejectedError,
    ProviderOutageError,
    SealedVault,
)

from .conftest import (
    ALEX,
    MARIA,
    SECRET_ACCESS_TOKEN,
    SECRET_REFRESH_TOKEN,
    build_app,
    completed_connection,
    login,
)

PROJECT = uuid4()
OTHER_PROJECT = uuid4()


def test_csrf_required_for_connect_and_callback() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")

    no_csrf = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    assert no_csrf.status_code == 403
    assert no_csrf.json()["code"] == "CSRF_INVALID"

    challenge = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    assert challenge.status_code == 201
    callback_without_csrf = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        json={
            "state": challenge.json()["state"],
            "code": "oauth_code_demo",
            "idempotency_key": "csrf-check",
        },
    )
    assert callback_without_csrf.status_code == 403


def test_oauth_state_is_one_time_and_replay_rejected() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")

    challenge = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    state = challenge.json()["state"]

    forged = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": "forged-state-value",
            "code": "oauth_code_demo",
            "idempotency_key": "forged-1",
        },
    )
    assert forged.status_code == 400
    assert forged.json()["code"] == "PLATFORM_STATE_INVALID"

    first = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": state,
            "code": "oauth_code_demo",
            "idempotency_key": "callback-1",
        },
    )
    assert first.status_code == 200

    replay = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": state,
            "code": "oauth_code_demo",
            "idempotency_key": "callback-2",
        },
    )
    assert replay.status_code == 400
    assert replay.json()["code"] == "PLATFORM_STATE_INVALID"

    same_key_replay = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": state,
            "code": "oauth_code_demo",
            "idempotency_key": "callback-1",
        },
    )
    assert same_key_replay.status_code == 200  # тот же key → тот же результат
    assert same_key_replay.json()["id"] == first.json()["id"]
    assert len(fixture.gateway.exchange_calls) == 1


def test_idempotent_callback_returns_single_connection_without_extend() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")

    first = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    state = first.json()["state"]
    payload = {"state": state, "code": "oauth_code_demo", "idempotency_key": "one-key"}

    connected = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json=payload,
    )
    assert connected.status_code == 200
    connection_id = connected.json()["id"]

    repeat = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json=payload,
    )
    assert repeat.status_code == 200
    assert repeat.json()["id"] == connection_id

    events = fixture.store._audit.get(UUID(connection_id), ())
    completed = [event for event in events if event.action == "connect_completed"]
    assert len(completed) == 1
    assert len(fixture.gateway.exchange_calls) == 1


def test_foreign_connection_id_is_non_disclosing_404() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    fixture.membership.add(OTHER_PROJECT, MARIA)
    alex = TestClient(fixture.app)
    alex_csrf = login(alex, "participant-alex")
    connection_id = completed_connection(alex, alex_csrf, PROJECT)

    maria = TestClient(fixture.app)
    login(maria, "participant-maria")

    stranger = TestClient(fixture.app)
    stranger_csrf = login(stranger, "customer-roman")

    unknown_id = uuid4()

    for suffix in ("deep-link", "diagnostics"):
        foreign = maria.get(
            f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/{suffix}"
        )
        unknown = maria.get(
            f"/api/v1/projects/{PROJECT}/platforms/connections/{unknown_id}/{suffix}"
        )
        assert foreign.status_code == 404
        assert unknown.status_code == 404
        assert foreign.json()["code"] == unknown.json()["code"] == "RESOURCE_NOT_FOUND"

    foreign_revoke = stranger.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/revoke",
        headers={"X-CSRF-Token": stranger_csrf},
    )
    assert foreign_revoke.status_code == 404
    assert len(fixture.gateway.revoke_calls) == 0


def test_tokens_stay_sealed_and_redacted_from_api() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")
    connection_id = completed_connection(client, csrf, PROJECT)

    record = fixture.store._connections.get(connection_id)
    assert record is not None
    assert record.sealed_access_token is not None
    assert SECRET_ACCESS_TOKEN.encode("utf-8") != record.sealed_access_token.ciphertext
    unsealed = fixture.service.vault.unseal(
        record.sealed_access_token, record.provider_key
    )
    assert unsealed == SECRET_ACCESS_TOKEN

    for path in (
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/diagnostics",
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/deep-link",
        f"/api/v1/projects/{PROJECT}/platforms",
    ):
        response = client.get(path)
        assert response.status_code in (200, 409)
        assert SECRET_ACCESS_TOKEN not in response.text
        assert SECRET_REFRESH_TOKEN not in response.text

    diagnostics = client.get(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/diagnostics"
    )
    assert diagnostics.status_code == 200
    body = diagnostics.json()
    fingerprint = body["token_fingerprint"]
    assert isinstance(fingerprint, str)
    assert fingerprint.startswith("sha256:")
    assert fingerprint != SECRET_ACCESS_TOKEN
    assert "gitverse_live_demo" not in fingerprint


def test_expired_connection_requires_reconnect_and_stops_sync() -> None:
    fixture = build_app()
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")
    connection_id = completed_connection(client, csrf, PROJECT)

    fixture.clock.advance(timedelta(seconds=7200))
    payload = client.get(f"/api/v1/projects/{PROJECT}/platforms").json()
    gitverse = next(
        item
        for item in payload["items"]
        if item["provider_key"] == "gitverse"
    )
    connection = gitverse["connection"]
    assert isinstance(connection, dict)
    assert connection["status"] == ConnectionStatus.EXPIRED.value

    link = client.get(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/deep-link"
    )
    assert link.status_code == 409

    reconnect_challenge = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/reconnect",
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert reconnect_challenge.status_code == 201
    reconnect_state = reconnect_challenge.json()["state"]
    reconnected = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": reconnect_state,
            "code": "oauth_code_demo",
            "idempotency_key": "reconnect-1",
        },
    )
    assert reconnected.status_code == 200
    assert reconnected.json()["status"] == ConnectionStatus.CONNECTED.value


def test_provider_outage_reports_safe_retryable_error() -> None:
    fixture = build_app()
    fixture.gateway.exchange_error = ProviderOutageError("gitverse down")
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")

    challenge = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    state = challenge.json()["state"]
    failed = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": state,
            "code": "oauth_code_demo",
            "idempotency_key": "outage-1",
        },
    )
    assert failed.status_code == 503
    envelope = failed.json()
    assert envelope["code"] == "PLATFORM_PROVIDER_UNAVAILABLE"
    assert envelope["retryable"] is True
    assert "Traceback" not in failed.text
    assert "gitverse down" not in failed.text  # provider details not leaked
    assert SECRET_ACCESS_TOKEN not in failed.text

    payload = client.get(f"/api/v1/projects/{PROJECT}/platforms").json()
    gitverse = next(item for item in payload["items"] if item["provider_key"] == "gitverse")
    connection = gitverse["connection"]
    assert isinstance(connection, dict)
    assert connection["status"] == ConnectionStatus.ERROR.value
    assert connection["last_error"] == (
        "Платформа временно недоступна. Повторите позже."
    )

    reconnect_chall = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/reconnect",
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    fixture.gateway.exchange_error = None
    state = reconnect_chall.json()["state"]
    retry = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={"state": state, "code": "oauth_code_demo", "idempotency_key": "retry-1"},
    )
    assert retry.status_code == 200
    assert retry.json()["status"] == ConnectionStatus.CONNECTED.value


def test_credential_rejection_marks_error_without_details() -> None:
    fixture = build_app()
    fixture.gateway.exchange_error = CredentialRejectedError("bad client secret")
    fixture.membership.add(PROJECT, ALEX)
    client = TestClient(fixture.app)
    csrf = login(client, "participant-alex")

    challenge = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": "impulse-demo/navigator"},
    )
    state = challenge.json()["state"]
    failed = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/gitverse/callback",
        headers={"X-CSRF-Token": csrf},
        json={"state": state, "code": "code", "idempotency_key": "rejection-1"},
    )
    assert failed.status_code == 400
    envelope = failed.json()
    assert envelope["code"] == "PLATFORM_EXCHANGE_REJECTED"
    assert "bad client secret" not in failed.text


def test_vault_rejects_tampered_sealed_secret() -> None:
    fixture = build_app()
    sealed_by_other = SealedVault(bytes(range(64, 128)))
    forged = sealed_by_other.seal(SECRET_ACCESS_TOKEN)
    try:
        fixture.service.vault.unseal(forged, "gitverse")
    except CredentialRejectedError:
        pass
    else:  # pragma: no cover - safety net
        raise AssertionError("tampered secret must not unseal")
