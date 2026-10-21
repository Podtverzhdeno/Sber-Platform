"""HTTP surface for the project platform connection catalog (openspec 22.20)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.identity import AuthenticatedSession
from impulse.integrations.providers import PROVIDERS, PlatformProvider
from impulse.integrations.service import (
    ConnectChallenge,
    ConnectionDiagnostics,
    ConnectionStatus,
    ConnectionView,
    PlatformConnectionService,
)
from impulse.integrations.sync import (
    PlatformSyncService,
    SyncItemView,
    SyncRefreshReport,
)

router = APIRouter(prefix="/projects/{project_id}/platforms")


class ProviderCardView(BaseModel):
    """One row of the «Платформы» section for a project workspace."""

    provider_key: str
    title: str
    purpose: str
    required_permissions: list[str]
    repository_label: str
    connection: ConnectionCardView | None


class ConnectionCardView(BaseModel):
    id: UUID
    provider_key: str
    workspace_ref: str | None
    scopes: list[str]
    status: str
    last_sync_at: str | None
    last_error: str | None


class PlatformCatalogResponse(BaseModel):
    items: list[ProviderCardView]


class ConnectRequest(BaseModel):
    workspace_ref: str | None = None
    scopes: list[str] = Field(default_factory=list)


class ConnectChallengeView(BaseModel):
    provider_key: str
    authorization_url: str
    state: str
    expires_at: str


class CallbackRequest(BaseModel):
    state: str
    code: str
    idempotency_key: str


class ConnectionViewResponse(BaseModel):
    id: UUID
    provider_key: str
    project_id: UUID
    workspace_ref: str | None
    scopes: list[str]
    status: str
    last_sync_at: str | None
    last_error: str | None


class DeepLinkView(BaseModel):
    url: str


class DiagnosticsView(BaseModel):
    connection_id: UUID
    provider_key: str
    status: str
    scopes: list[str]
    token_fingerprint: str | None
    token_expires_at: str | None
    sync_paused: bool
    last_sync_at: str | None
    last_error: str | None


class SyncItemViewResponse(BaseModel):
    """One sync projection: provenance, freshness and the explicit binding.

    `verification_status` stays `not_bound` | `awaiting_human_verification`:
    no state in this surface ever claims a confirmed evidence.
    """

    id: UUID
    connection_id: UUID
    provider_key: str
    kind: str
    status: str
    external_id: str
    title_label: str | None
    source_url: str | None
    occurred_at: str | None
    imported_at: str
    last_synced_at: str
    bound_checkpoint_key: str | None
    verification_status: str


class SyncItemsResponse(BaseModel):
    items: list[SyncItemViewResponse]


class SyncRefreshView(BaseModel):
    connection_id: UUID
    checked_at: str
    imported_new: int
    refreshed_existing: int
    skipped_invalid: int
    items: list[SyncItemViewResponse]


class SyncBindRequest(BaseModel):
    checkpoint_key: str | None = None


def _service(request: Request) -> PlatformConnectionService:
    service = getattr(request.app.state, "platforms_service", None)
    if service is None:
        raise ApiError(
            code="PLATFORM_SERVICE_UNAVAILABLE",
            message="Каталог платформ недоступен.",
            status_code=503,
        )
    return service


def _sync_service(request: Request) -> PlatformSyncService:
    service = getattr(request.app.state, "platforms_sync_service", None)
    if service is None:
        raise ApiError(
            code="PLATFORM_SERVICE_UNAVAILABLE",
            message="Каталог платформ недоступен.",
            status_code=503,
        )
    return service


def _item_response(view: SyncItemView) -> SyncItemViewResponse:
    return SyncItemViewResponse(
        id=view.id,
        connection_id=view.connection_id,
        provider_key=view.provider_key,
        kind=view.kind,
        status=view.status,
        external_id=view.external_id,
        title_label=view.title_label,
        source_url=view.source_url,
        occurred_at=(view.occurred_at.isoformat() if view.occurred_at else None),
        imported_at=view.imported_at.isoformat(),
        last_synced_at=view.last_synced_at.isoformat(),
        bound_checkpoint_key=view.bound_checkpoint_key,
        verification_status=view.verification_status,
    )


def _refresh_response(
    report: SyncRefreshReport, views: tuple[SyncItemView, ...]
) -> SyncRefreshView:
    return SyncRefreshView(
        connection_id=report.connection_id,
        checked_at=report.checked_at.isoformat(),
        imported_new=report.imported_new,
        refreshed_existing=report.refreshed_existing,
        skipped_invalid=report.skipped_invalid,
        items=[_item_response(view) for view in views],
    )


def _connection_card(view: ConnectionView) -> ConnectionCardView:
    return ConnectionCardView(
        id=view.id,
        provider_key=view.provider_key,
        workspace_ref=view.workspace_ref,
        scopes=list(view.scopes),
        status=view.status,
        last_sync_at=(view.last_sync_at.isoformat() if view.last_sync_at else None),
        last_error=view.last_error,
    )


def _connection_response(view: ConnectionView) -> ConnectionViewResponse:
    return ConnectionViewResponse(
        id=view.id,
        provider_key=view.provider_key,
        project_id=view.project_id,
        workspace_ref=view.workspace_ref,
        scopes=list(view.scopes),
        status=view.status,
        last_sync_at=(view.last_sync_at.isoformat() if view.last_sync_at else None),
        last_error=view.last_error,
    )


def _challenge_view(challenge: ConnectChallenge) -> ConnectChallengeView:
    return ConnectChallengeView(
        provider_key=challenge.provider_key,
        authorization_url=challenge.authorization_url,
        state=challenge.state,
        expires_at=challenge.expires_at.isoformat(),
    )


def _diagnostics_view(diagnostics: ConnectionDiagnostics) -> DiagnosticsView:
    return DiagnosticsView(
        connection_id=diagnostics.connection_id,
        provider_key=diagnostics.provider_key,
        status=diagnostics.status,
        scopes=list(diagnostics.scopes),
        token_fingerprint=diagnostics.token_fingerprint,
        token_expires_at=(
            diagnostics.token_expires_at.isoformat() if diagnostics.token_expires_at else None
        ),
        sync_paused=diagnostics.sync_paused,
        last_sync_at=(diagnostics.last_sync_at.isoformat() if diagnostics.last_sync_at else None),
        last_error=diagnostics.last_error,
    )


@router.get("", response_model=PlatformCatalogResponse)
async def catalog(
    project_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> PlatformCatalogResponse:
    views = await service.catalog(authenticated.actor, project_id)
    items: list[ProviderCardView] = []
    for view in views:
        provider = PROVIDERS.get(view.provider_key)
        if provider is None:
            continue
        items.append(_card(provider, view))
    return PlatformCatalogResponse(items=items)


def _card(provider: PlatformProvider, view: ConnectionView | None) -> ProviderCardView:
    connected = view is not None and view.status != ConnectionStatus.NOT_CONNECTED.value
    return ProviderCardView(
        provider_key=provider.key,
        title=provider.title,
        purpose=provider.purpose,
        required_permissions=list(provider.required_permissions),
        repository_label=provider.repository_label,
        connection=(_connection_card(view) if connected and view is not None else None),
    )


@router.post(
    "/{provider_key}/connect",
    response_model=ConnectChallengeView,
    status_code=201,
)
async def connect(
    project_id: UUID,
    provider_key: str,
    command: ConnectRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> ConnectChallengeView:
    challenge = await service.start_connect(
        authenticated.actor,
        project_id,
        provider_key,
        workspace_ref=command.workspace_ref,
        scopes=tuple(command.scopes) if command.scopes else None,
    )
    return _challenge_view(challenge)


@router.post(
    "/{provider_key}/reconnect",
    response_model=ConnectChallengeView,
    status_code=201,
)
async def reconnect(
    project_id: UUID,
    provider_key: str,
    command: ConnectRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> ConnectChallengeView:
    challenge = await service.start_connect(
        authenticated.actor,
        project_id,
        provider_key,
        workspace_ref=command.workspace_ref,
        scopes=tuple(command.scopes) if command.scopes else None,
        reconnect=True,
    )
    return _challenge_view(challenge)


@router.post(
    "/{provider_key}/callback",
    response_model=ConnectionViewResponse,
)
async def callback(
    project_id: UUID,
    provider_key: str,
    command: CallbackRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> ConnectionViewResponse:
    view = await service.complete_connect(
        authenticated.actor,
        project_id,
        provider_key,
        state=command.state,
        code=command.code,
        idempotency_key=command.idempotency_key,
    )
    return _connection_response(view)


@router.get(
    "/connections/{connection_id}/deep-link",
    response_model=DeepLinkView,
)
async def deep_link(
    project_id: UUID,
    connection_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> DeepLinkView:
    url = await service.deep_link(authenticated.actor, project_id, connection_id)
    return DeepLinkView(url=url)


@router.post(
    "/connections/{connection_id}/revoke",
    response_model=ConnectionViewResponse,
)
async def revoke(
    project_id: UUID,
    connection_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> ConnectionViewResponse:
    view = await service.revoke(authenticated.actor, project_id, connection_id)
    return _connection_response(view)


@router.get(
    "/connections/{connection_id}/diagnostics",
    response_model=DiagnosticsView,
)
async def diagnostics(
    project_id: UUID,
    connection_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[PlatformConnectionService, Depends(_service)],
) -> DiagnosticsView:
    view = await service.diagnostics(authenticated.actor, project_id, connection_id)
    return _diagnostics_view(view)


# -- sync projections (openspec 22.21) ----------------------------------------


@router.get(
    "/connections/{connection_id}/sync-items",
    response_model=SyncItemsResponse,
)
async def sync_items(
    project_id: UUID,
    connection_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[PlatformSyncService, Depends(_sync_service)],
) -> SyncItemsResponse:
    views = await service.items(authenticated.actor, project_id, connection_id)
    return SyncItemsResponse(items=[_item_response(view) for view in views])


@router.post(
    "/connections/{connection_id}/sync-items/refresh",
    response_model=SyncRefreshView,
)
async def refresh_sync_items(
    project_id: UUID,
    connection_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformSyncService, Depends(_sync_service)],
) -> SyncRefreshView:
    report = await service.refresh(authenticated.actor, project_id, connection_id)
    views = await service.items(authenticated.actor, project_id, connection_id)
    return _refresh_response(report, views)


@router.post(
    "/connections/{connection_id}/sync-items/{item_id}/bind-checkpoint",
    response_model=SyncItemViewResponse,
)
async def bind_sync_item_to_checkpoint(
    project_id: UUID,
    connection_id: UUID,
    item_id: UUID,
    command: SyncBindRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[PlatformSyncService, Depends(_sync_service)],
) -> SyncItemViewResponse:
    """Binding requires an explicit checkpoint key; nothing is auto-confirmed."""
    view = await service.bind_to_checkpoint(
        authenticated.actor,
        project_id,
        connection_id,
        item_id,
        command.checkpoint_key,
    )
    return _item_response(view)
