"""Sync projections with provenance/freshness and honest binding (22.21).

Spec: импорт платформы не равен подтверждённому evidence — projection
остаётся imported/provisional до явной привязки участника к checkpoint, а
прогресс и Skill Passport меняет только уполномоченная проверка.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from impulse.integrations.providers import GITVERSE
from impulse.integrations.service import (
    ConnectionRecord,
    ConnectionStatus,
    CredentialRejectedError,
    ProviderOutageError,
)
from impulse.integrations.sync import (
    ProviderSyncItem,
    SyncItemKind,
    SyncItemStatus,
    ai_safe_metadata,
)

from .conftest import SECRET_ACCESS_TOKEN, PlatformFixture, completed_connection

PROJECT = uuid4()
OTHER_PROJECT = uuid4()

COMMIT_SHA = "9f8c3a2b1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f80"
CHECKPOINT_KEY = "checkpoint:python-base"
OTHER_CHECKPOINT_KEY = "checkpoint:api-design"


def as_dict(value: object) -> dict[str, object]:
    assert isinstance(value, dict)
    return cast("dict[str, object]", value)


def as_items(value: object) -> list[dict[str, object]]:
    assert isinstance(value, list)
    items = cast("list[object]", value)
    return [as_dict(item) for item in items]


def as_str(value: object) -> str:
    assert isinstance(value, str)
    return value


def projected_items(fixed: datetime) -> list[ProviderSyncItem]:
    """Provider drift for one refresh: mixed kinds plus one invalid payload."""
    return [
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id=COMMIT_SHA,
            title_label="Навигатор: первый коммит модуля платформ",
            source_url=f"https://gitverse.ru/impulse-demo/navigator/commit/{COMMIT_SHA}",
            occurred_at=fixed - timedelta(hours=2),
        ),
        ProviderSyncItem(
            kind=SyncItemKind.RUN,
            external_id="run-2026-10-18-a1",
            title_label="Обучающий прогон ассистента",
            occurred_at=fixed - timedelta(hours=3),
            provisional=True,
        ),
        ProviderSyncItem(
            kind=SyncItemKind.ARTIFACT,
            external_id="artifact-9713",
            title_label="Артефакт: скриншот прототипа",
            occurred_at=fixed - timedelta(hours=1),
            provisional=True,
        ),
        ProviderSyncItem(
            kind=SyncItemKind.ACTIVITY,
            external_id="activity-5",
            title_label="Недавняя активность команды платформы",
            occurred_at=fixed - timedelta(minutes=10),
        ),
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id="invalid external id",
        ),
    ]


def connect_member(platform: PlatformFixture) -> tuple[TestClient, str, UUID]:
    """Add membership, pass the OAuth flow, return (client, csrf, connection_id)."""
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")
    return client, csrf, completed_connection(client, csrf, PROJECT)


def refresh(client: TestClient, csrf: str, connection_id: UUID) -> tuple[int, dict[str, object]]:
    response = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/sync-items/refresh",
        headers={"X-CSRF-Token": csrf},
    )
    return response.status_code, as_dict(response.json())


def items_of(client: TestClient, connection_id: UUID) -> list[dict[str, object]]:
    response = client.get(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/sync-items"
    )
    assert response.status_code == 200, response.text
    return [as_dict(item) for item in as_items(response.json()["items"])]


def bind_item(
    client: TestClient,
    csrf: str,
    connection_id: UUID,
    item_id: str,
    checkpoint_key: str | None,
) -> tuple[int, dict[str, object]]:
    response = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}"
        f"/sync-items/{item_id}/bind-checkpoint",
        headers={"X-CSRF-Token": csrf},
        json={"checkpoint_key": checkpoint_key},
    )
    return response.status_code, as_dict(response.json())


def audit_actions(platform: PlatformFixture, connection_id: UUID) -> list[tuple[str, str]]:
    events = asyncio.run(platform.store.audit_for(connection_id))
    return [(event.action, event.outcome) for event in events]


def connection_record(platform: PlatformFixture, connection_id: UUID) -> ConnectionRecord:
    snapshot = asyncio.run(platform.store.get(connection_id))
    assert isinstance(snapshot, ConnectionRecord)
    return snapshot


def test_refresh_imports_items_with_provenance_and_freshness(
    platform: PlatformFixture,
) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = tuple(projected_items(platform.clock()))

    status, payload = refresh(client, csrf, connection_id)
    assert status == 200, payload
    assert payload["connection_id"] == str(connection_id)
    assert payload["imported_new"] == 4
    assert payload["refreshed_existing"] == 0
    assert payload["skipped_invalid"] == 1
    assert payload["checked_at"] == "2026-10-19T12:00:00+00:00"

    items = as_items(payload["items"])
    assert len(items) == 4
    by_external = {as_str(item["external_id"]): item for item in items}
    commit = as_dict(by_external[COMMIT_SHA])
    assert commit["kind"] == SyncItemKind.COMMIT.value
    assert commit["title_label"] == "Навигатор: первый коммит модуля платформ"
    assert as_str(commit["last_synced_at"]) == "2026-10-19T12:00:00+00:00"
    assert as_str(by_external["activity-5"]["kind"]) == SyncItemKind.ACTIVITY.value

    call = platform.sync_gateway.calls[0]
    assert call[0] == GITVERSE.key
    assert call[1] == SECRET_ACCESS_TOKEN
    assert call[2] == "impulse-demo/navigator"

    assert audit_actions(platform, connection_id) == [
        ("connect_started", "ok"),
        ("connect_completed", "ok"),
        ("sync_refreshed", "imported_4_refreshed_0_skipped_1"),
    ]


def test_refresh_deduplicates_and_preserves_freshness(platform: PlatformFixture) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = tuple(projected_items(platform.clock()))
    first = refresh(client, csrf, connection_id)[1]
    first_ids = {
        as_str(item["external_id"]): as_str(item["id"]) for item in as_items(first["items"])
    }

    platform.clock.advance(timedelta(hours=1))
    second_status, second = refresh(client, csrf, connection_id)
    assert second_status == 200
    assert second["imported_new"] == 0
    assert second["refreshed_existing"] == 4
    second_items = {as_str(item["external_id"]): item for item in as_items(second["items"])}
    assert set(second_items) == set(first_ids)
    for external_id, item in second_items.items():
        assert as_str(item["id"]) == first_ids[external_id]
        assert as_str(item["last_synced_at"]) == "2026-10-19T13:00:00+00:00"


def test_items_endpoint_reports_kinds_and_honest_states(platform: PlatformFixture) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = tuple(projected_items(platform.clock()))
    refresh(client, csrf, connection_id)

    items = items_of(client, connection_id)
    by_external = {as_str(item["external_id"]): item for item in items}
    commit = as_dict(by_external[COMMIT_SHA])
    assert commit["status"] == SyncItemStatus.IMPORTED.value
    assert (
        as_str(commit["source_url"])
        == f"https://gitverse.ru/impulse-demo/navigator/commit/{COMMIT_SHA}"
    )
    assert commit["verification_status"] == "not_bound"
    assert commit["bound_checkpoint_key"] is None
    run = as_dict(by_external["run-2026-10-18-a1"])
    assert run["status"] == SyncItemStatus.PROVISIONAL.value
    artifact = as_dict(by_external["artifact-9713"])
    assert artifact["title_label"] == "Артефакт: скриншот прототипа"


def test_binding_requires_explicit_checkpoint_key(platform: PlatformFixture) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = (
        ProviderSyncItem(kind=SyncItemKind.COMMIT, external_id=COMMIT_SHA),
    )
    refresh(client, csrf, connection_id)
    item_id = as_str(items_of(client, connection_id)[0]["id"])

    missing_status, missing_payload = bind_item(client, csrf, connection_id, item_id, None)
    assert missing_status == 422
    assert missing_payload["code"] == "PLATFORM_CHECKPOINT_REQUIRED"

    empty_status, empty_payload = bind_item(client, csrf, connection_id, item_id, "   ")
    assert empty_status == 422
    assert empty_payload["code"] == "PLATFORM_CHECKPOINT_REQUIRED"

    platform.checkpoints.keys = frozenset({CHECKPOINT_KEY, OTHER_CHECKPOINT_KEY})
    bound_status, bound_payload = bind_item(client, csrf, connection_id, item_id, CHECKPOINT_KEY)
    assert bound_status == 200, bound_payload
    assert bound_payload["bound_checkpoint_key"] == CHECKPOINT_KEY
    assert bound_payload["verification_status"] == "awaiting_human_verification"

    foreign_status, foreign_payload = bind_item(
        client, csrf, connection_id, item_id, "checkpoint:not-my-track"
    )
    assert foreign_status == 404
    assert foreign_payload["code"] == "RESOURCE_NOT_FOUND"


def test_binding_keeps_import_non_evidenced_and_idempotent(platform: PlatformFixture) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = (
        ProviderSyncItem(
            kind=SyncItemKind.ARTIFACT,
            external_id="artifact-9713",
            title_label="Артефакт: скриншот прототипа",
            provisional=True,
        ),
    )
    refresh(client, csrf, connection_id)
    item_id = as_str(items_of(client, connection_id)[0]["id"])
    platform.checkpoints.keys = frozenset({CHECKPOINT_KEY})

    assert audit_actions(platform, connection_id).count(("checkpoint_bound", "ok")) == 0
    bound_status, bound = bind_item(client, csrf, connection_id, item_id, CHECKPOINT_KEY)
    assert bound_status == 200
    assert bound["status"] == SyncItemStatus.PROVISIONAL.value
    assert audit_actions(platform, connection_id).count(("checkpoint_bound", "ok")) == 1

    repeat_status, repeat = bind_item(client, csrf, connection_id, item_id, CHECKPOINT_KEY)
    assert repeat_status == 200
    assert repeat["bound_checkpoint_key"] == CHECKPOINT_KEY
    assert audit_actions(platform, connection_id).count(("checkpoint_bound", "ok")) == 1

    platform.clock.advance(timedelta(hours=1))
    refresh_status, refreshed = refresh(client, csrf, connection_id)
    assert refresh_status == 200
    assert refreshed["refreshed_existing"] == 1
    records = items_of(client, connection_id)
    assert records[0]["status"] == SyncItemStatus.PROVISIONAL.value
    assert records[0]["bound_checkpoint_key"] == CHECKPOINT_KEY
    assert records[0]["verification_status"] == "awaiting_human_verification"
    assert audit_actions(platform, connection_id).count(("checkpoint_bound", "ok")) == 1
    assert not any(
        hint in action.lower()
        for action, _outcome in audit_actions(platform, connection_id)
        for hint in ("verify", "confirm", "evidence")
    )


def test_sync_and_binding_never_promote_progress_or_passport(
    platform: PlatformFixture,
) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = tuple(projected_items(platform.clock()))
    refresh(client, csrf, connection_id)
    item_id = as_str(items_of(client, connection_id)[0]["id"])
    platform.checkpoints.keys = frozenset({CHECKPOINT_KEY})

    before = connection_record(platform, connection_id)
    bound_status, _bound = bind_item(client, csrf, connection_id, item_id, CHECKPOINT_KEY)
    assert bound_status == 200
    after = connection_record(platform, connection_id)

    assert after.version == before.version
    assert after.status is ConnectionStatus.CONNECTED
    assert after.last_sync_at is None
    assert after.sealed_access_token == before.sealed_access_token

    actions = {action for action, _outcome in audit_actions(platform, connection_id)}
    assert actions <= {
        "connect_started",
        "connect_completed",
        "sync_refreshed",
        "checkpoint_bound",
    }
    public_methods = {name for name in dir(type(platform.sync_service)) if not name.startswith("_")}
    assert public_methods == {"refresh", "items", "bind_to_checkpoint"}
    forbidden = ("confirm", "verify", "evidence", "passport", "progress", "advance")
    assert all(not any(hint in name.lower() for hint in forbidden) for name in public_methods)


def test_outage_and_credential_rejection_keep_items_unchanged(
    platform: PlatformFixture,
) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = tuple(projected_items(platform.clock()))
    refresh(client, csrf, connection_id)
    stable = items_of(client, connection_id)

    platform.sync_gateway.error = ProviderOutageError()
    outage_status, outage_payload = refresh(client, csrf, connection_id)
    assert outage_status == 503
    assert outage_payload["code"] == "PLATFORM_SYNC_UNAVAILABLE"
    assert outage_payload["retryable"] is True
    assert audit_actions(platform, connection_id).count(("sync_refreshed", "provider_outage")) == 1
    assert items_of(client, connection_id) == stable

    platform.sync_gateway.error = CredentialRejectedError(GITVERSE.key)
    rejected_status, rejected_payload = refresh(client, csrf, connection_id)
    assert rejected_status == 400
    assert rejected_payload["code"] == "PLATFORM_CREDENTIAL_REJECTED"
    assert (
        audit_actions(platform, connection_id).count(("sync_refreshed", "credential_rejected")) == 1
    )
    assert items_of(client, connection_id) == stable
    assert SECRET_ACCESS_TOKEN not in str(outage_payload)
    assert SECRET_ACCESS_TOKEN not in str(rejected_payload)


def test_unsafe_provider_payload_fields_never_reach_the_workspace(
    platform: PlatformFixture,
) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = (
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id="commit-1",
            source_url="http://gitverse.ru/impulse-demo/navigator/commit/abc",
        ),
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id="commit-2",
            source_url="https://github.com/impulse-demo/navigator/commit/abc",
        ),
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id="commit-3",
            source_url="https://gitverse.ru/x?access_token=leak",
        ),
        ProviderSyncItem(
            kind=SyncItemKind.ACTIVITY,
            external_id="activity-future",
            occurred_at=platform.clock() + timedelta(hours=5),
        ),
    )
    status, payload = refresh(client, csrf, connection_id)
    assert status == 200
    assert payload["imported_new"] == 4
    assert payload["skipped_invalid"] == 0

    items = {as_str(item["external_id"]): item for item in items_of(client, connection_id)}
    for key in ("commit-1", "commit-2", "commit-3"):
        assert items[key]["source_url"] is None
        assert items[key]["status"] == SyncItemStatus.IMPORTED.value
    assert as_dict(items["activity-future"])["occurred_at"] is None


def test_foreign_and_csrf_protection_on_sync_surfaces(platform: PlatformFixture) -> None:
    platform.membership.add(PROJECT, platform.person_ids["participant-alex"])
    client, csrf = platform.member_client("participant-alex")
    connection_id = completed_connection(client, csrf, PROJECT)

    stranger = platform.member_client("customer-roman")[0]
    stranger_response = stranger.get(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/sync-items"
    )
    assert stranger_response.status_code == 404
    assert stranger_response.json()["code"] == "RESOURCE_NOT_FOUND"

    csrfless = client.post(
        f"/api/v1/projects/{PROJECT}/platforms/connections/{connection_id}/sync-items/refresh",
    )
    assert csrfless.status_code == 403
    assert csrfless.json()["code"] == "CSRF_INVALID"

    other_scope = client.get(
        f"/api/v1/projects/{OTHER_PROJECT}/platforms/connections/{connection_id}/sync-items"
    )
    assert other_scope.status_code == 404
    assert other_scope.json()["code"] == "RESOURCE_NOT_FOUND"


def test_ai_allowlist_never_exposes_titles_links_or_external_ids(
    platform: PlatformFixture,
) -> None:
    client, csrf, connection_id = connect_member(platform)
    platform.sync_gateway.items = (
        ProviderSyncItem(
            kind=SyncItemKind.COMMIT,
            external_id=COMMIT_SHA,
            title_label="Навигатор: коммит закрытого модуля",
            source_url=f"https://gitverse.ru/impulse-demo/navigator/commit/{COMMIT_SHA}",
        ),
    )
    refresh(client, csrf, connection_id)
    item_id = as_str(items_of(client, connection_id)[0]["id"])
    platform.checkpoints.keys = frozenset({CHECKPOINT_KEY})
    bound_status, _bound = bind_item(client, csrf, connection_id, item_id, CHECKPOINT_KEY)
    assert bound_status == 200

    item = asyncio.run(platform.sync_store.sync_item(UUID(item_id)))
    assert item is not None
    metadata = ai_safe_metadata(item)
    assert metadata["status"] == SyncItemStatus.IMPORTED.value
    assert metadata["provider_key"] == GITVERSE.key
    assert metadata["bound_checkpoint_key"] == CHECKPOINT_KEY
    assert isinstance(metadata["last_synced_at"], str)
    assert set(metadata.keys()) <= {
        "kind",
        "status",
        "provider_key",
        "occurred_at",
        "last_synced_at",
        "imported_at",
        "bound_checkpoint_key",
        "bound_checkpoint_at",
    }
    assert "title_label" not in metadata
    assert "source_url" not in metadata
    assert COMMIT_SHA not in str(metadata)
