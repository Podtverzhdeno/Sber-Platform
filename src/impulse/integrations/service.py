"""Project-scoped platform connection model (openspec 22.20).

Connections bind a provider account (GigaCode, GigaCoWork, GigaAgent, GitVerse)
to one project assignment. Provider secrets live only inside sealed storage and
never reach API views, logs or audit. Every state transition appends a
content-free audit event, and repeated commands with the same idempotency key
stay side-effect free.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Protocol, runtime_checkable
from uuid import UUID, uuid4

from impulse.api.errors import ApiError
from impulse.application.identity import ActorContext
from impulse.integrations.providers import (
    PlatformProvider,
    build_authorization_url,
    build_deep_link,
    get_provider,
    validate_link_url,
    validate_requested_scopes,
    validate_workspace_ref,
)

NON_DISCLOSING_404 = ApiError(
    code="RESOURCE_NOT_FOUND",
    message="Resource not found.",
    status_code=404,
)

CONNECT_STATE_TTL = timedelta(minutes=10)
STATE_DIGEST_PREFIX = "sha256:"


class ConnectionStatus(StrEnum):
    NOT_CONNECTED = "not_connected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ACTION_REQUIRED = "action_required"
    EXPIRED = "expired"
    REVOKED = "revoked"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


class ProviderOutageError(Exception):
    """The platform is temporarily unreachable."""


class CredentialRejectedError(Exception):
    """The provider rejected the presented credential (invalid or expired)."""


@dataclass(frozen=True, slots=True)
class SealedSecret:
    """Encrypted credential material; unsealable only with the process key."""

    nonce: bytes
    ciphertext: bytes
    tag: bytes


@dataclass(frozen=True, slots=True)
class GatewayTokens:
    access_token: str
    refresh_token: str | None = None
    account_ref: str = ""
    expires_in_seconds: int | None = None


@runtime_checkable
class PlatformGateway(Protocol):
    """HTTP boundary towards the provider; failures surface as typed errors."""

    async def exchange_code(
        self, provider_key: str, code: str, scopes: tuple[str, ...]
    ) -> GatewayTokens: ...

    async def revoke_token(self, provider_key: str, access_token: str) -> bool: ...


@runtime_checkable
class MembershipPort(Protocol):
    async def active_assignment(self, project_id: UUID, person_id: UUID) -> UUID | None:
        """Assignment id when the person holds an active assignment, else None."""
        ...


@runtime_checkable
class ProjectPlatformConfigPort(Protocol):
    async def enabled_providers(self, project_id: UUID) -> frozenset[str]:
        """Provider keys allowed for this project by its configuration."""
        ...


@dataclass(frozen=True, slots=True)
class PlatformAuditEvent:
    """Content-free audit row: who did what to which object, with an outcome."""

    id: UUID
    occurred_at: datetime
    actor_id: UUID
    project_id: UUID
    provider_key: str
    connection_id: UUID | None
    action: str
    outcome: str


@dataclass
class ConnectionRecord:
    id: UUID
    provider_key: str
    project_id: UUID
    person_id: UUID
    assignment_id: UUID | None
    workspace_ref: str | None
    scopes: tuple[str, ...]
    status: ConnectionStatus = ConnectionStatus.NOT_CONNECTED
    sealed_access_token: SealedSecret | None = None
    sealed_refresh_token: SealedSecret | None = None
    account_ref: str = ""
    token_expires_at: datetime | None = None
    state_digest: str | None = None
    state_expires_at: datetime | None = None
    idempotency_key: str | None = None
    sync_paused: bool = False
    last_sync_at: datetime | None = None
    last_error: str | None = None
    version: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class ConnectionStore(Protocol):
    async def save(self, record: ConnectionRecord) -> ConnectionRecord: ...

    async def get(self, connection_id: UUID) -> ConnectionRecord | None: ...

    async def latest_for_project(
        self, project_id: UUID, provider_key: str
    ) -> ConnectionRecord | None: ...

    async def append_audit(self, event: PlatformAuditEvent) -> None: ...

    async def audit_for(self, connection_id: UUID) -> tuple[PlatformAuditEvent, ...]: ...

    async def find_idempotent_result(self, idempotency_key: str) -> ConnectionRecord | None: ...


@dataclass
class MemoryConnectionStore:
    """dict-backed store for in-process runs and tests."""

    def __init__(self) -> None:
        self._connections: dict[UUID, ConnectionRecord] = {}
        self._audit: dict[UUID, list[PlatformAuditEvent]] = {}
        self._idempotency: dict[str, UUID] = {}

    async def save(self, record: ConnectionRecord) -> ConnectionRecord:
        self._connections[record.id] = record
        if record.idempotency_key:
            self._idempotency[record.idempotency_key] = record.id
        return record

    async def get(self, connection_id: UUID) -> ConnectionRecord | None:
        return self._connections.get(connection_id)

    async def latest_for_project(
        self, project_id: UUID, provider_key: str
    ) -> ConnectionRecord | None:
        candidates = [
            record
            for record in self._connections.values()
            if record.project_id == project_id and record.provider_key == provider_key
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda record: record.updated_at)

    async def append_audit(self, event: PlatformAuditEvent) -> None:
        if event.connection_id is not None:
            self._audit.setdefault(event.connection_id, []).append(event)

    async def audit_for(self, connection_id: UUID) -> tuple[PlatformAuditEvent, ...]:
        return tuple(self._audit.get(connection_id, ()))

    async def find_idempotent_result(self, idempotency_key: str) -> ConnectionRecord | None:
        connection_id = self._idempotency.get(idempotency_key)
        return self._connections.get(connection_id) if connection_id else None


class SealedVault:
    """HMAC-SHA256 encrypt-then-MAC sealing for provider credentials.

    Keystream is derived per nonce; the tag authenticates nonce plus ciphertext.
    Tokens sealed here are unsealed only server-side, right before a provider
    HTTP call, and never serialized to clients or logs.
    """

    def __init__(self, key: bytes) -> None:
        if len(key) < 64:
            raise ValueError("sealing key must be at least 64 bytes")
        self._encryption_key = key[:32]
        self._mac_key = key[32:64]

    def _keystream(self, nonce: bytes, length: int) -> bytes:
        stream = bytearray()
        counter = 0
        while len(stream) < length:
            block = hmac.new(
                self._encryption_key,
                b"sealed-v1" + nonce + counter.to_bytes(4, "big"),
                hashlib.sha256,
            ).digest()
            stream.extend(block)
            counter += 1
        return bytes(stream[:length])

    def seal(self, plaintext: str) -> SealedSecret:
        raw = plaintext.encode("utf-8")
        nonce = secrets.token_bytes(16)
        keystream = self._keystream(nonce, len(raw))
        ciphertext = bytes(a ^ b for a, b in zip(raw, keystream, strict=True))
        tag = hmac.new(self._mac_key, nonce + ciphertext, hashlib.sha256).digest()
        return SealedSecret(nonce=nonce, ciphertext=ciphertext, tag=tag)

    def unseal(self, sealed: SealedSecret, provider_key: str) -> str:
        expected = hmac.new(
            self._mac_key,
            sealed.nonce + sealed.ciphertext,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected, sealed.tag):
            raise CredentialRejectedError(provider_key)
        keystream = self._keystream(sealed.nonce, len(sealed.ciphertext))
        raw = bytes(a ^ b for a, b in zip(sealed.ciphertext, keystream, strict=True))
        return raw.decode("utf-8")


@dataclass(frozen=True, slots=True)
class ConnectionView:
    """Public connection projection; contains no credential material."""

    id: UUID
    provider_key: str
    project_id: UUID
    assignment_id: UUID | None
    workspace_ref: str | None
    scopes: tuple[str, ...]
    status: str
    account_ref: str
    token_expires_at: datetime | None
    sync_paused: bool
    last_sync_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class ConnectChallenge:
    provider_key: str
    authorization_url: str
    state: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ConnectionDiagnostics:
    """Redacted diagnostics: fingerprints instead of secrets."""

    connection_id: UUID
    provider_key: str
    status: str
    scopes: tuple[str, ...]
    token_fingerprint: str | None
    token_expires_at: datetime | None
    sync_paused: bool
    last_sync_at: datetime | None
    last_error: str | None


def _digest_state(state: str) -> str:
    return STATE_DIGEST_PREFIX + hashlib.sha256(state.encode("utf-8")).hexdigest()


def _view(record: ConnectionRecord) -> ConnectionView:
    return ConnectionView(
        id=record.id,
        provider_key=record.provider_key,
        project_id=record.project_id,
        assignment_id=record.assignment_id,
        workspace_ref=record.workspace_ref,
        scopes=record.scopes,
        status=record.status.value,
        account_ref=record.account_ref,
        token_expires_at=record.token_expires_at,
        sync_paused=record.sync_paused,
        last_sync_at=record.last_sync_at,
        last_error=record.last_error,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _safe_last_error(reason: str) -> str:
    """Map internal failures to stable, secret-free user messages."""
    safe_reasons = {
        "provider_outage": "Платформа временно недоступна. Повторите позже.",
        "credential_rejected": (
            "Платформа отклонила учётные данные. Требуется повторное подключение."
        ),
    }
    return safe_reasons.get(reason, reason)


class PlatformConnectionService:
    """Business rules for the project platform connection catalog."""

    def __init__(
        self,
        store: ConnectionStore,
        vault: SealedVault,
        gateway: PlatformGateway,
        membership: MembershipPort,
        project_config: ProjectPlatformConfigPort,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.store = store
        self.vault = vault
        self.gateway = gateway
        self.membership = membership
        self.project_config = project_config
        self._now = now or (lambda: datetime.now(UTC))

    # -- guards ---------------------------------------------------------------

    async def _authorise_participant(self, actor: ActorContext, project_id: UUID) -> UUID:
        """Only the assigned project member reaches platform state; others get 404."""
        assignment_id = await self.membership.active_assignment(project_id, actor.person_id)
        if assignment_id is None:
            raise NON_DISCLOSING_404
        return assignment_id

    async def _provider_for(self, project_id: UUID, provider_key: str) -> PlatformProvider:
        enabled = await self.project_config.enabled_providers(project_id)
        if provider_key not in enabled:
            raise NON_DISCLOSING_404
        provider = get_provider(provider_key)
        if provider is None:
            raise NON_DISCLOSING_404
        return provider

    async def _connection_for(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> ConnectionRecord:
        record = await self.store.get(connection_id)
        if record is None or record.project_id != project_id or record.person_id != actor.person_id:
            raise NON_DISCLOSING_404
        await self._authorise_participant(actor, record.project_id)
        provider = get_provider(record.provider_key)
        if (
            provider is not None
            and record.provider_key
            not in await self.project_config.enabled_providers(record.project_id)
        ):
            raise NON_DISCLOSING_404
        if provider is None:
            raise NON_DISCLOSING_404
        return record

    async def _audit(
        self,
        record: ConnectionRecord,
        actor_id: UUID,
        action: str,
        outcome: str,
    ) -> None:
        await self.store.append_audit(
            PlatformAuditEvent(
                id=uuid4(),
                occurred_at=self._now(),
                actor_id=actor_id,
                project_id=record.project_id,
                provider_key=record.provider_key,
                connection_id=record.id,
                action=action,
                outcome=outcome,
            )
        )

    # -- catalog --------------------------------------------------------------

    async def catalog(self, actor: ActorContext, project_id: UUID) -> tuple[ConnectionView, ...]:
        await self._authorise_participant(actor, project_id)
        enabled = await self.project_config.enabled_providers(project_id)
        views: list[ConnectionView] = []
        for provider_key in sorted(enabled):
            record = await self.store.latest_for_project(project_id, provider_key)
            if record is None or record.status is ConnectionStatus.REVOKED:
                views.append(
                    ConnectionView(
                        id=uuid4(),
                        provider_key=provider_key,
                        project_id=project_id,
                        assignment_id=None,
                        workspace_ref=None,
                        scopes=(),
                        status=ConnectionStatus.NOT_CONNECTED.value,
                        account_ref="",
                        token_expires_at=None,
                        sync_paused=False,
                        last_sync_at=None,
                        last_error=None,
                        created_at=self._now(),
                        updated_at=self._now(),
                    )
                )
                continue
            record = await self._apply_expiry(record)
            views.append(_view(record))
        return tuple(views)

    async def _apply_expiry(self, record: ConnectionRecord) -> ConnectionRecord:
        if (
            record.status is ConnectionStatus.CONNECTED
            and record.token_expires_at is not None
            and record.token_expires_at <= self._now()
        ):
            record = replace(
                record,
                status=ConnectionStatus.EXPIRED,
                sync_paused=True,
                last_error=_safe_last_error("credential_rejected"),
                version=record.version + 1,
                updated_at=self._now(),
            )
            await self.store.save(record)
        return record

    # -- connect / reconnect --------------------------------------------------

    async def start_connect(
        self,
        actor: ActorContext,
        project_id: UUID,
        provider_key: str,
        *,
        workspace_ref: str | None = None,
        scopes: tuple[str, ...] | None = None,
        reconnect: bool = False,
    ) -> ConnectChallenge:
        provider = await self._provider_for(project_id, provider_key)
        assignment_id = await self._authorise_participant(actor, project_id)
        existing = await self.store.latest_for_project(project_id, provider_key)
        if reconnect and not (workspace_ref or "").strip() and existing is not None:
            workspace_ref = existing.workspace_ref
        selected_scopes = validate_requested_scopes(provider, scopes)
        resolved_workspace = validate_workspace_ref(provider, workspace_ref)
        if reconnect:
            if existing is None or existing.status not in {
                ConnectionStatus.CONNECTED,
                ConnectionStatus.ACTION_REQUIRED,
                ConnectionStatus.EXPIRED,
                ConnectionStatus.ERROR,
            }:
                raise ApiError(
                    code="PLATFORM_RECONNECT_UNAVAILABLE",
                    message="Подключение платформы ещё не установлено.",
                    status_code=409,
                )
            record = existing
        else:
            if existing is not None and existing.status is ConnectionStatus.CONNECTED:
                raise ApiError(
                    code="PLATFORM_ALREADY_CONNECTED",
                    message="Платформа уже подключена к проекту.",
                    status_code=409,
                )
            if existing is not None and existing.status in {
                ConnectionStatus.CONNECTING,
                ConnectionStatus.CONNECTED,
                ConnectionStatus.ACTION_REQUIRED,
                ConnectionStatus.EXPIRED,
            }:
                record = existing
            else:
                record = ConnectionRecord(
                    id=uuid4(),
                    provider_key=provider_key,
                    project_id=project_id,
                    person_id=actor.person_id,
                    assignment_id=assignment_id,
                    workspace_ref=resolved_workspace,
                    scopes=selected_scopes,
                )
        state = secrets.token_urlsafe(32)
        expires_at = self._now() + CONNECT_STATE_TTL
        record = replace(
            record,
            person_id=actor.person_id,
            assignment_id=assignment_id,
            workspace_ref=resolved_workspace or record.workspace_ref,
            scopes=selected_scopes,
            status=ConnectionStatus.CONNECTING,
            sealed_access_token=None,
            sealed_refresh_token=None,
            account_ref="",
            token_expires_at=None,
            state_digest=_digest_state(state),
            state_expires_at=expires_at,
            sync_paused=False,
            last_error=None,
            version=record.version + 1,
            updated_at=self._now(),
        )
        await self.store.save(record)
        await self._audit(record, actor.person_id, "connect_started", "ok")
        return ConnectChallenge(
            provider_key=provider_key,
            authorization_url=build_authorization_url(
                provider, state=state, scopes=selected_scopes
            ),
            state=state,
            expires_at=expires_at,
        )

    async def complete_connect(
        self,
        actor: ActorContext,
        project_id: UUID,
        provider_key: str,
        *,
        state: str,
        code: str,
        idempotency_key: str,
    ) -> ConnectionView:
        await self._authorise_participant(actor, project_id)
        await self._provider_for(project_id, provider_key)
        if not state or not code or not idempotency_key.strip():
            raise ApiError(
                code="PLATFORM_STATE_INVALID",
                message="Подтверждение подключения не прошло проверку.",
                status_code=400,
            )
        replay = await self.store.find_idempotent_result(idempotency_key.strip())
        if (
            replay is not None
            and replay.person_id == actor.person_id
            and replay.project_id == project_id
            and replay.provider_key == provider_key
        ):
            return _view(await self._apply_expiry(replay))

        record = await self.store.latest_for_project(project_id, provider_key)
        if (
            record is None
            or record.person_id != actor.person_id
            or record.status is not ConnectionStatus.CONNECTING
            or record.state_digest is None
            or record.state_digest != _digest_state(state)
            or record.state_expires_at is None
            or record.state_expires_at < self._now()
        ):
            raise ApiError(
                code="PLATFORM_STATE_INVALID",
                message="Подтверждение подключения не прошло проверку.",
                status_code=400,
            )
        selected_scopes = record.scopes
        try:
            tokens = await self.gateway.exchange_code(provider_key, code, selected_scopes)
        except ProviderOutageError:
            record = replace(
                record,
                status=ConnectionStatus.ERROR,
                state_digest=None,
                state_expires_at=None,
                sync_paused=True,
                last_error=_safe_last_error("provider_outage"),
                version=record.version + 1,
                updated_at=self._now(),
            )
            await self.store.save(record)
            await self._audit(record, actor.person_id, "connect_completed", "provider_outage")
            raise ApiError(
                code="PLATFORM_PROVIDER_UNAVAILABLE",
                message="Платформа временно недоступна. Повторите позже.",
                status_code=503,
                retryable=True,
            ) from None
        except CredentialRejectedError:
            record = replace(
                record,
                status=ConnectionStatus.ERROR,
                state_digest=None,
                state_expires_at=None,
                sync_paused=True,
                last_error=_safe_last_error("credential_rejected"),
                version=record.version + 1,
                updated_at=self._now(),
            )
            await self.store.save(record)
            await self._audit(record, actor.person_id, "connect_completed", "credential_rejected")
            raise ApiError(
                code="PLATFORM_EXCHANGE_REJECTED",
                message="Платформа отклонила подтверждение подключения.",
                status_code=400,
            ) from None
        token_expires_at = (
            self._now() + timedelta(seconds=tokens.expires_in_seconds)
            if tokens.expires_in_seconds is not None
            else None
        )
        record = replace(
            record,
            status=ConnectionStatus.CONNECTED,
            sealed_access_token=self.vault.seal(tokens.access_token),
            sealed_refresh_token=(
                self.vault.seal(tokens.refresh_token) if tokens.refresh_token else None
            ),
            account_ref=tokens.account_ref,
            token_expires_at=token_expires_at,
            state_digest=None,
            state_expires_at=None,
            idempotency_key=idempotency_key.strip(),
            sync_paused=False,
            last_error=None,
            version=record.version + 1,
            updated_at=self._now(),
        )
        await self.store.save(record)
        await self._audit(record, actor.person_id, "connect_completed", "ok")
        return _view(record)

    # -- revoke ---------------------------------------------------------------

    async def revoke(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> ConnectionView:
        record = await self._connection_for(actor, project_id, connection_id)
        if record.status is ConnectionStatus.REVOKED:
            return _view(record)
        provider_confirmed = False
        if record.sealed_access_token is not None:
            try:
                access_token = self.vault.unseal(record.sealed_access_token, record.provider_key)
            except CredentialRejectedError:
                access_token = ""
            if access_token:
                try:
                    provider_confirmed = await self.gateway.revoke_token(
                        record.provider_key, access_token
                    )
                except ProviderOutageError:
                    provider_confirmed = False
        revoked_at = self._now()
        record = replace(
            record,
            status=ConnectionStatus.REVOKED,
            sealed_access_token=None,
            sealed_refresh_token=None,
            account_ref="",
            token_expires_at=None,
            state_digest=None,
            state_expires_at=None,
            sync_paused=True,
            last_error=None,
            version=record.version + 1,
            updated_at=revoked_at,
        )
        await self.store.save(record)
        await self._audit(
            record,
            actor.person_id,
            "revoked",
            "provider_confirmed" if provider_confirmed else "local_only",
        )
        return _view(record)

    async def diagnostics(
        self, actor: ActorContext, project_id: UUID, connection_id: UUID
    ) -> ConnectionDiagnostics:
        """Redacted diagnostics view; token text must never appear here."""
        record = await self._connection_for(actor, project_id, connection_id)
        record = await self._apply_expiry(record)
        fingerprint: str | None = None
        if record.sealed_access_token is not None:
            try:
                access_token = self.vault.unseal(record.sealed_access_token, record.provider_key)
            except CredentialRejectedError:
                access_token = ""
            if access_token:
                fingerprint = (
                    "sha256:" + hashlib.sha256(access_token.encode("utf-8")).hexdigest()[:16]
                )
        return ConnectionDiagnostics(
            connection_id=record.id,
            provider_key=record.provider_key,
            status=record.status.value,
            scopes=record.scopes,
            token_fingerprint=fingerprint,
            token_expires_at=record.token_expires_at,
            sync_paused=record.sync_paused,
            last_sync_at=record.last_sync_at,
            last_error=record.last_error,
        )

    async def deep_link(self, actor: ActorContext, project_id: UUID, connection_id: UUID) -> str:
        """Allowlist-validated workspace deep link; audit keeps no URL content."""
        record = await self._connection_for(actor, project_id, connection_id)
        record = await self._apply_expiry(record)
        if record.status is not ConnectionStatus.CONNECTED or record.workspace_ref is None:
            raise ApiError(
                code="PLATFORM_LINK_UNAVAILABLE",
                message="Переход доступен только для подключённой платформы.",
                status_code=409,
            )
        url = build_deep_link(record.provider_key, record.workspace_ref)
        if url is None or not validate_link_url(url):
            raise ApiError(
                code="PLATFORM_LINK_UNAVAILABLE",
                message="Ссылка платформы не прошла проверку безопасности.",
                status_code=409,
            )
        await self._audit(record, actor.person_id, "open_workspace", "ok")
        return url
