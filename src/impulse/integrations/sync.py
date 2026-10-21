"""Platform sync projections with provenance and freshness (openspec 22.21).

A connected platform may surface derived metadata about repositories,
agent runs, artifacts and activity events in the project workspace. An
imported projection never equals evidence: it stays ``imported`` or
``provisional`` until the participant explicitly binds it to one of their
own actionable trajectory checkpoints, and only the existing human/provider
verification flow — never this module — changes progress or the Skill
Passport. This module exposes no confirm/verify operation at all; the
checkpoint port is read-only, and the AI context receives only a strict
allowlist of derived metadata without credential or repository content.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol, runtime_checkable
from urllib.parse import urlparse
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.identity import ActorContext
from impulse.integrations.providers import (
    PlatformProvider,
    get_provider,
    validate_link_url,
)
from impulse.integrations.service import (
    NON_DISCLOSING_404,
    ConnectionRecord,
    ConnectionStatus,
    ConnectionStore,
    CredentialRejectedError,
    MembershipPort,
    PlatformAuditEvent,
    ProjectPlatformConfigPort,
    ProviderOutageError,
    SealedVault,
)

SYNC_EXTERNAL_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$")
SYNC_LABEL_MAX_LENGTH = 300

CHECKPOINT_NOT_BOUND = "not_bound"
CHECKPOINT_AWAITING_VERIFICATION = "awaiting_human_verification"


class SyncItemKind(StrEnum):
    """Derived-object kinds that a provider may project into the workspace."""

    REPOSITORY = "repository"
    COMMIT = "commit"
    RUN = "agent_run"
    ARTIFACT = "artifact"
    ACTIVITY = "activity"


class SyncItemStatus(StrEnum):
    """The only two observable states: a sync item is never confirmed evidence."""

    IMPORTED = "imported"
    PROVISIONAL = "provisional"


@dataclass(frozen=True, slots=True)
class ProviderSyncItem:
    """Derived metadata offered by the provider surface; nothing secret."""

    kind: SyncItemKind
    external_id: str
    title_label: str | None = None
    source_url: str | None = None
    occurred_at: datetime | None = None
    provisional: bool = False


@dataclass(frozen=True, slots=True)
class SanitizedSyncItem:
    """Provider item after clearance checks; unsafe fields are dropped."""

    kind: SyncItemKind
    external_id: str
    status: SyncItemStatus
    title_label: str | None
    source_url: str | None
    occurred_at: datetime | None


@dataclass()
class SyncItemRecord:
    """Persisted projection with provenance, freshness and optional binding."""

    id: UUID
    connection_id: UUID
    project_id: UUID
    person_id: UUID
    provider_key: str
    kind: SyncItemKind
    external_id: str
    status: SyncItemStatus
    imported_at: datetime
    last_synced_at: datetime
    title_label: str | None = None
    source_url: str | None = None
    occurred_at: datetime | None = None
    bound_checkpoint_key: str | None = None
    bound_checkpoint_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class SyncItemView:
    """Public projection; never carries credentials or provider secrets."""

    id: UUID
    connection_id: UUID
    provider_key: str
    kind: str
    status: str
    external_id: str
    title_label: str | None
    source_url: str | None
    occurred_at: datetime | None
    imported_at: datetime
    last_synced_at: datetime
    bound_checkpoint_key: str | None
    verification_status: str


@dataclass(frozen=True, slots=True)
class SyncRefreshReport:
    """Content-free refresh outcome: counts only, no provider payload."""

    connection_id: UUID
    checked_at: datetime
    imported_new: int
    refreshed_existing: int
    skipped_invalid: int


@runtime_checkable
class PlatformSyncGateway(Protocol):
    """HTTP boundary towards provider sync surfaces; typed failures only."""

    async def fetch_items(
        self,
        provider_key: str,
        access_token: str,
        workspace_ref: str | None,
    ) -> tuple[ProviderSyncItem, ...]: ...


@runtime_checkable
class SyncItemStore(Protocol):
    async def upsert_sync_item(self, record: SyncItemRecord) -> SyncItemRecord: ...

    async def sync_items_for(self, connection_id: UUID) -> tuple[SyncItemRecord, ...]: ...

    async def find_sync_item(
        self, connection_id: UUID, kind: SyncItemKind, external_id: str
    ) -> SyncItemRecord | None: ...

    async def sync_item(self, item_id: UUID) -> SyncItemRecord | None: ...


@runtime_checkable
class CheckpointPort(Protocol):
    """Read-only checkpoint facts; binding may never mutate progress here."""

    async def actionable_checkpoints(self, actor: ActorContext) -> frozenset[str]:
        """Checkpoint keys of the actor that are actionable right now."""
        ...


class MemorySyncStore:
    """dict-backed store for sync projections, in-process runs and tests."""

    def __init__(self) -> None:
        self._items: dict[UUID, SyncItemRecord] = {}

    async def upsert_sync_item(self, record: SyncItemRecord) -> SyncItemRecord:
        self._items[record.id] = record
        return record

    async def sync_items_for(self, connection_id: UUID) -> tuple[SyncItemRecord, ...]:
        matched = [
            record for record in self._items.values() if record.connection_id == connection_id
        ]
        return tuple(
            sorted(
                matched,
                key=lambda record: (record.last_synced_at, record.imported_at, str(record.id)),
                reverse=True,
            )
        )

    async def find_sync_item(
        self, connection_id: UUID, kind: SyncItemKind, external_id: str
    ) -> SyncItemRecord | None:
        for record in self._items.values():
            if (
                record.connection_id == connection_id
                and record.kind is kind
                and record.external_id == external_id
            ):
                return record
        return None

    async def sync_item(self, item_id: UUID) -> SyncItemRecord | None:
        return self._items.get(item_id)


AI_SAFE_METADATA_FIELDS: frozenset[str] = frozenset(
    {
        "kind",
        "status",
        "provider_key",
        "occurred_at",
        "last_synced_at",
        "imported_at",
        "bound_checkpoint_key",
        "bound_checkpoint_at",
    }
)


def ai_safe_metadata(item: SyncItemRecord) -> dict[str, object]:
    """Allowlisted derived metadata for AI context.

    External ids, titles and source links are excluded by default so closed
    repository content and provider URLs never cross the AI boundary, and no
    credential field can appear because records simply never hold one.
    """
    safe: dict[str, object] = {
        "kind": item.kind.value,
        "status": item.status.value,
        "provider_key": item.provider_key,
    }
    for field_name in ("occurred_at", "last_synced_at", "imported_at", "bound_checkpoint_at"):
        value: datetime | None = getattr(item, field_name)
        if isinstance(value, datetime):
            safe[field_name] = value.isoformat()
    bound = item.bound_checkpoint_key
    if bound is not None:
        safe["bound_checkpoint_key"] = bound
    bound_at = item.bound_checkpoint_at
    if isinstance(bound_at, datetime):
        safe["bound_checkpoint_at"] = bound_at.isoformat()
    return {key: value for key, value in safe.items() if key in AI_SAFE_METADATA_FIELDS}


def sanitize_sync_item(
    provider: PlatformProvider, raw: ProviderSyncItem, *, now: datetime
) -> SanitizedSyncItem | None:
    """Drop unsafe provider payloads before anything is stored or shown."""
    external_id = raw.external_id.strip()
    if SYNC_EXTERNAL_ID_PATTERN.fullmatch(external_id) is None:
        return None
    title_label = None
    if raw.title_label is not None:
        label = raw.title_label.strip()
        if label and all(char.isprintable() for char in label):
            title_label = label[:SYNC_LABEL_MAX_LENGTH]
    source_url = None
    if raw.source_url is not None and _safe_item_source_url(provider, raw.source_url):
        source_url = raw.source_url
    occurred_at = raw.occurred_at
    if occurred_at is not None and occurred_at > now:
        occurred_at = None
    return SanitizedSyncItem(
        kind=raw.kind,
        external_id=external_id,
        status=SyncItemStatus.PROVISIONAL if raw.provisional else SyncItemStatus.IMPORTED,
        title_label=title_label,
        source_url=source_url,
        occurred_at=occurred_at,
    )


def _safe_item_source_url(provider: PlatformProvider, url: str) -> bool:
    """Only https links on the provider's own allowlisted hosts survive."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname in provider.allowed_link_hosts
        and validate_link_url(url)
    )


def _item_view(item: SyncItemRecord) -> SyncItemView:
    return SyncItemView(
        id=item.id,
        connection_id=item.connection_id,
        provider_key=item.provider_key,
        kind=item.kind.value,
        status=item.status.value,
        external_id=item.external_id,
        title_label=item.title_label,
        source_url=item.source_url,
        occurred_at=item.occurred_at,
        imported_at=item.imported_at,
        last_synced_at=item.last_synced_at,
        bound_checkpoint_key=item.bound_checkpoint_key,
        verification_status=(
            CHECKPOINT_AWAITING_VERIFICATION
            if item.bound_checkpoint_key is not None
            else CHECKPOINT_NOT_BOUND
        ),
    )


class PlatformSyncService:
    """Sync projections for connected platforms; imports are never evidence."""

    def __init__(
        self,
        connections: ConnectionStore,
        items: SyncItemStore,
        sync_gateway: PlatformSyncGateway,
        checkpoints: CheckpointPort,
        membership: MembershipPort,
        project_config: ProjectPlatformConfigPort,
        vault: SealedVault,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._connections = connections
        self._items = items
        self._gateway = sync_gateway
        self._checkpoints = checkpoints
        self._membership = membership
        self._project_config = project_config
        self._vault = vault
        self._now = now or (lambda: datetime.now(UTC))

    # -- guards ---------------------------------------------------------------

    async def _connection_for(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> ConnectionRecord:
        record = await self._connections.get(connection_id)
        if record is None or record.project_id != project_id or record.person_id != actor.person_id:
            raise NON_DISCLOSING_404
        assignment_id = await self._membership.active_assignment(record.project_id, actor.person_id)
        if assignment_id is None:
            raise NON_DISCLOSING_404
        provider = get_provider(record.provider_key)
        if provider is None:
            raise NON_DISCLOSING_404
        enabled = await self._project_config.enabled_providers(record.project_id)
        if record.provider_key not in enabled:
            raise NON_DISCLOSING_404
        return record

    def _require_connected(self, record: ConnectionRecord) -> None:
        if record.status is not ConnectionStatus.CONNECTED:
            raise ApiError(
                code="PLATFORM_SYNC_UNAVAILABLE",
                message="Синхронизация доступна только для подключённой платформы.",
                status_code=409,
            )

    def _access_token(self, record: ConnectionRecord) -> str:
        sealed = record.sealed_access_token
        if sealed is None:
            raise ApiError(
                code="PLATFORM_SYNC_UNAVAILABLE",
                message="Синхронизация доступна только для подключённой платформы.",
                status_code=409,
            )
        try:
            return self._vault.unseal(sealed, record.provider_key)
        except CredentialRejectedError:
            raise ApiError(
                code="PLATFORM_CREDENTIAL_REJECTED",
                message="Платформа отклонила учётные данные. Требуется повторное подключение.",
                status_code=400,
            ) from None

    async def _audit(
        self, connection: ConnectionRecord, actor_id: UUID, action: str, outcome: str
    ) -> None:
        await self._connections.append_audit(
            PlatformAuditEvent(
                id=uuid4(),
                occurred_at=self._now(),
                actor_id=actor_id,
                project_id=connection.project_id,
                provider_key=connection.provider_key,
                connection_id=connection.id,
                action=action,
                outcome=outcome,
            )
        )

    # -- refresh --------------------------------------------------------------

    async def refresh(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> SyncRefreshReport:
        record = await self._connection_for(actor, project_id, connection_id)
        self._require_connected(record)
        provider = get_provider(record.provider_key)
        if provider is None:
            raise NON_DISCLOSING_404
        try:
            raw_items = await self._fetch_with_secrets(record)
        except ProviderOutageError:
            await self._audit(record, actor.person_id, "sync_refreshed", "provider_outage")
            raise ApiError(
                code="PLATFORM_SYNC_UNAVAILABLE",
                message="Платформа временно недоступна. Повторите позже.",
                status_code=503,
                retryable=True,
            ) from None
        except CredentialRejectedError:
            await self._audit(record, actor.person_id, "sync_refreshed", "credential_rejected")
            raise ApiError(
                code="PLATFORM_CREDENTIAL_REJECTED",
                message="Платформа отклонила учётные данные. Требуется повторное подключение.",
                status_code=400,
            ) from None
        now = self._now()
        imported_new = 0
        refreshed_existing = 0
        skipped_invalid = 0
        for raw in raw_items:
            sanitized = sanitize_sync_item(provider, raw, now=now)
            if sanitized is None:
                skipped_invalid += 1
                continue
            existing = await self._items.find_sync_item(
                connection_id, sanitized.kind, sanitized.external_id
            )
            if existing is None:
                await self._items.upsert_sync_item(
                    SyncItemRecord(
                        id=uuid4(),
                        connection_id=connection_id,
                        project_id=record.project_id,
                        person_id=actor.person_id,
                        provider_key=record.provider_key,
                        kind=sanitized.kind,
                        external_id=sanitized.external_id,
                        status=sanitized.status,
                        imported_at=now,
                        last_synced_at=now,
                        title_label=sanitized.title_label,
                        source_url=sanitized.source_url,
                        occurred_at=sanitized.occurred_at,
                    )
                )
                imported_new += 1
            else:
                await self._items.upsert_sync_item(
                    replace(
                        existing,
                        title_label=sanitized.title_label,
                        source_url=sanitized.source_url,
                        occurred_at=sanitized.occurred_at,
                        last_synced_at=now,
                    )
                )
                refreshed_existing += 1
        await self._audit(
            record,
            actor.person_id,
            "sync_refreshed",
            f"imported_{imported_new}_refreshed_{refreshed_existing}_skipped_{skipped_invalid}",
        )
        return SyncRefreshReport(
            connection_id=connection_id,
            checked_at=now,
            imported_new=imported_new,
            refreshed_existing=refreshed_existing,
            skipped_invalid=skipped_invalid,
        )

    async def _fetch_with_secrets(self, record: ConnectionRecord) -> tuple[ProviderSyncItem, ...]:
        access_token = self._access_token(record)
        return await self._gateway.fetch_items(
            record.provider_key, access_token, record.workspace_ref
        )

    # -- catalog --------------------------------------------------------------

    async def items(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> tuple[SyncItemView, ...]:
        record = await self._connection_for(actor, project_id, connection_id)
        del record
        records = await self._items.sync_items_for(connection_id)
        return tuple(_item_view(item) for item in records)

    # -- explicit checkpoint binding -------------------------------------------

    async def bind_to_checkpoint(
        self,
        actor: ActorContext,
        project_id: UUID,
        connection_id: UUID,
        item_id: UUID,
        checkpoint_key: str | None,
    ) -> SyncItemView:
        record = await self._connection_for(actor, project_id, connection_id)
        item = await self._items.sync_item(item_id)
        if item is None or item.connection_id != connection_id or item.project_id != project_id:
            raise NON_DISCLOSING_404
        key = (checkpoint_key or "").strip()
        if not key:
            raise ApiError(
                code="PLATFORM_CHECKPOINT_REQUIRED",
                message="Выберите checkpoint для привязки импортированных данных.",
                status_code=422,
            )
        actionable = await self._checkpoints.actionable_checkpoints(actor)
        if key not in actionable:
            raise NON_DISCLOSING_404
        if item.bound_checkpoint_key == key:
            return _item_view(item)
        rebound = item.bound_checkpoint_key is not None
        item = replace(item, bound_checkpoint_key=key, bound_checkpoint_at=self._now())
        await self._items.upsert_sync_item(item)
        await self._audit(
            record, actor.person_id, "checkpoint_bound", "rebound" if rebound else "ok"
        )
        return _item_view(item)
