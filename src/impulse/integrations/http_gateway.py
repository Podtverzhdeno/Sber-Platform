"""HTTP provider adapters for connect and sync (openspec 29.5).

Adapters are enabled only when deployment settings provide per-provider
endpoint URLs; otherwise the fail-closed gateways stay in place so the
catalog and its subscribers remain untouched. Failures surface as typed
``ProviderOutageError`` / ``CredentialRejectedError``; provider payloads,
access tokens and codes never reach exception messages or logs — only the
provider key, endpoint host and status code are recorded.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, cast
from urllib.parse import parse_qsl, urlparse

import httpx

from impulse.integrations.service import (
    CredentialRejectedError,
    GatewayTokens,
    ProviderOutageError,
)
from impulse.integrations.sync import ProviderSyncItem, SyncItemKind

_logger = logging.getLogger(__name__)

_REJECTED_STATUS = frozenset({400, 401, 403})


def _empty_mapping() -> Mapping[str, str]:
    return {}


@dataclass(frozen=True, slots=True)
class PlatformHttpEndpoints:
    """Deployment-provided endpoint registry; unconfigured providers stay offline."""

    token_urls: Mapping[str, str] = field(default_factory=_empty_mapping)
    item_urls: Mapping[str, str] = field(default_factory=_empty_mapping)

    def _configured(self, mapping: Mapping[str, str], provider_key: str, event: str) -> str:
        url = mapping.get(provider_key, "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname is None:
            _logger.info(event, extra={"platform_provider": provider_key})
            raise ProviderOutageError from None
        if parsed.username is not None or parsed.password is not None:
            _logger.warning(
                "platform_endpoint_config_invalid", extra={"platform_provider": provider_key}
            )
            raise ProviderOutageError from None
        for key, _value in parse_qsl(parsed.query):
            if key.lower() in {"code", "access_token", "token"}:
                raise ProviderOutageError from None
        return url

    def token_url(self, provider_key: str) -> str:
        return self._configured(self.token_urls, provider_key, "platform_connect_not_configured")

    def item_url(self, provider_key: str) -> str:
        return self._configured(self.item_urls, provider_key, "platform_sync_not_configured")


class _DryRunRefused(ProviderOutageError):
    """Raised instead of network I/O when the deployment selects dry-run."""


def _validate_dry_run(provider_key: str, url: str, event: str) -> None:
    _logger.info(
        event,
        extra={
            "platform_provider": provider_key,
            "platform_endpoint_host": urlparse(url).netloc,
        },
    )
    raise _DryRunRefused from None


class HttpPlatformGateway:
    """OAuth code exchange and token revocation against configured endpoints."""

    def __init__(
        self,
        endpoints: PlatformHttpEndpoints,
        *,
        dry_run: bool = False,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._endpoints = endpoints
        self._dry_run = dry_run
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self._timeout_seconds,
            follow_redirects=False,
            transport=self._transport,
        )

    async def exchange_code(
        self,
        provider_key: str,
        code: str,
        scopes: tuple[str, ...],
    ) -> GatewayTokens:
        url = self._endpoints.token_url(provider_key)
        if self._dry_run:
            _validate_dry_run(provider_key, url, "platform_connect_dry_run")
        form = {
            "grant_type": "authorization_code",
            "code": code,
            "scope": " ".join(scopes),
        }
        status, body = await self._post_json(provider_key, url, form, event="platform_connect")
        token = body.get("access_token")
        refresh = body.get("refresh_token")
        if not isinstance(token, str) or not token:
            _logger.warning(
                "platform_connect_rejected",
                extra={"platform_provider": provider_key, "platform_status": status},
            )
            raise CredentialRejectedError from None
        return GatewayTokens(
            access_token=token,
            refresh_token=refresh if isinstance(refresh, str) and refresh else None,
            account_ref=str(body.get("account_ref") or ""),
            expires_in_seconds=(
                int(body["expires_in"]) if isinstance(body.get("expires_in"), int) else None
            ),
        )

    async def revoke_token(self, provider_key: str, access_token: str) -> bool:
        url = self._endpoints.token_url(provider_key)
        if self._dry_run:
            _validate_dry_run(provider_key, url, "platform_revoke_dry_run")
        status, _body = await self._post_json(
            provider_key,
            url,
            {"token": access_token, "token_type_hint": "access_token"},
            event="platform_revoke",
            require_payload=False,
        )
        return status < 400

    async def _post_json(
        self,
        provider_key: str,
        url: str,
        form: dict[str, str],
        *,
        event: str,
        require_payload: bool = True,
    ) -> tuple[int, dict[str, Any]]:
        try:
            async with self._client() as client:
                response = await client.post(url, data=form)
        except httpx.TimeoutException:
            _logger.warning(f"{event}_timeout", extra={"platform_provider": provider_key})
            raise ProviderOutageError from None
        except httpx.TransportError:
            _logger.warning(f"{event}_transport_error", extra={"platform_provider": provider_key})
            raise ProviderOutageError from None
        if response.status_code in _REJECTED_STATUS:
            _logger.warning(
                f"{event}_rejected",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise CredentialRejectedError from None
        if response.status_code >= 400:
            _logger.warning(
                f"{event}_unavailable",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise ProviderOutageError from None
        if not response.content:
            if require_payload:
                _logger.warning(
                    f"{event}_empty_payload",
                    extra={
                        "platform_provider": provider_key,
                        "platform_status": response.status_code,
                    },
                )
                raise ProviderOutageError from None
            return response.status_code, {}
        try:
            body = cast("dict[str, Any]", response.json())
        except ValueError:
            _logger.warning(
                f"{event}_invalid_payload",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise ProviderOutageError from None
        return response.status_code, body


class HttpPlatformSyncGateway:
    """Fetches derived provider projections with the sealed access token."""

    def __init__(
        self,
        endpoints: PlatformHttpEndpoints,
        *,
        dry_run: bool = False,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._endpoints = endpoints
        self._dry_run = dry_run
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def fetch_items(
        self,
        provider_key: str,
        access_token: str,
        workspace_ref: str | None,
    ) -> tuple[ProviderSyncItem, ...]:
        url = self._endpoints.item_url(provider_key)
        if self._dry_run:
            _validate_dry_run(provider_key, url, "platform_sync_dry_run")
        params: dict[str, str] = {}
        if workspace_ref is not None:
            params["workspace"] = workspace_ref
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.get(
                    url,
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.TimeoutException:
            _logger.warning("platform_sync_timeout", extra={"platform_provider": provider_key})
            raise ProviderOutageError from None
        except httpx.TransportError:
            _logger.warning(
                "platform_sync_transport_error", extra={"platform_provider": provider_key}
            )
            raise ProviderOutageError from None
        if response.status_code in _REJECTED_STATUS:
            _logger.warning(
                "platform_sync_rejected",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise CredentialRejectedError from None
        if response.status_code >= 400:
            _logger.warning(
                "platform_sync_unavailable",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise ProviderOutageError from None
        try:
            payload = response.json()
        except ValueError:
            _logger.warning(
                "platform_sync_invalid_payload",
                extra={"platform_provider": provider_key, "platform_status": response.status_code},
            )
            raise ProviderOutageError from None
        if not isinstance(payload, dict):
            raise ProviderOutageError from None
        payload_map = cast("dict[str, Any]", payload)
        return tuple(_parse_items(payload_map.get("items")))


def _parse_items(raw_items: Any) -> tuple[ProviderSyncItem, ...]:
    if not isinstance(raw_items, list):
        return ()
    entries = cast("list[Any]", raw_items)
    parsed: list[ProviderSyncItem] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        item = _parse_item(cast("dict[str, Any]", entry))
        if item is not None:
            parsed.append(item)
    return tuple(parsed)


def _parse_item(raw: dict[str, Any]) -> ProviderSyncItem | None:
    kind_value = raw.get("kind")
    external_id = raw.get("id")
    if not isinstance(kind_value, str) or not isinstance(external_id, str):
        return None
    try:
        item_kind = SyncItemKind(kind_value)
    except ValueError:
        return None
    title_value = raw.get("title")
    url_value = raw.get("url")
    occurred_value = raw.get("occurred_at")
    occurred_at: datetime | None = None
    if isinstance(occurred_value, str):
        try:
            occurred_at = datetime.fromisoformat(occurred_value.replace("Z", "+00:00"))
        except ValueError:
            occurred_at = None
    return ProviderSyncItem(
        kind=item_kind,
        external_id=external_id,
        title_label=title_value if isinstance(title_value, str) else None,
        source_url=url_value if isinstance(url_value, str) else None,
        occurred_at=occurred_at,
        provisional=raw.get("provisional") is True,
    )
