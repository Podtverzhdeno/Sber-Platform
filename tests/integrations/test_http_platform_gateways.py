"""HTTP platform adapters: typed honest failures, dry-run, no secret leakage (29.5)."""

from __future__ import annotations

import httpx
import pytest

from impulse.integrations.http_gateway import (
    HttpPlatformGateway,
    HttpPlatformSyncGateway,
    PlatformHttpEndpoints,
)
from impulse.integrations.service import (
    CredentialRejectedError,
    GatewayTokens,
    ProviderOutageError,
)
from impulse.integrations.sync import ProviderSyncItem, SyncItemKind

TOKEN_URL = "https://provider.example/oauth/token"
ITEM_URL = "https://provider.example/api/items"


def endpoints(
    *,
    token_urls: dict[str, str] | None = None,
    item_urls: dict[str, str] | None = None,
) -> PlatformHttpEndpoints:
    return PlatformHttpEndpoints(
        token_urls=token_urls if token_urls is not None else {"gigacode": TOKEN_URL},
        item_urls=item_urls if item_urls is not None else {"gigacode": ITEM_URL},
    )


@pytest.mark.asyncio
async def test_exchange_returns_tokens_from_configured_endpoint() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["grant"] = request.content.decode("utf-8")
        return httpx.Response(
            200, json={"access_token": "at-123", "expires_in": 3600, "account_ref": "acc"}
        )

    gateway = HttpPlatformGateway(endpoints(), transport=httpx.MockTransport(handler))
    tokens = await gateway.exchange_code("gigacode", "auth-code", ("repo:read",))
    assert isinstance(tokens, GatewayTokens)
    assert tokens.access_token == "at-123"
    assert tokens.account_ref == "acc"
    assert tokens.expires_in_seconds == 3600
    assert seen["url"] == TOKEN_URL
    assert "grant_type=authorization_code" in seen["grant"]
    assert "auth-code" in seen["grant"]


@pytest.mark.asyncio
async def test_exchange_maps_honest_failures_by_status_and_errno() -> None:
    def rejected(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid_grant"})

    with pytest.raises(CredentialRejectedError):
        await HttpPlatformGateway(
            endpoints(), transport=httpx.MockTransport(rejected)
        ).exchange_code("gigacode", "code", ("repo:read",))

    def outage(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={})

    with pytest.raises(ProviderOutageError):
        await HttpPlatformGateway(endpoints(), transport=httpx.MockTransport(outage)).exchange_code(
            "gigacode", "code", ("repo:read",)
        )

    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("upstream did not answer", request=request)

    with pytest.raises(ProviderOutageError):
        await HttpPlatformGateway(
            endpoints(), transport=httpx.MockTransport(timeout)
        ).exchange_code("gigacode", "secret-code-value", ("repo:read",))


@pytest.mark.asyncio
async def test_exchange_failure_messages_never_leak_secrets() -> None:
    code = "secret-code-value-should-not-leak"

    def rejected(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "bad_request", "code_hint": code})

    with pytest.raises(CredentialRejectedError) as caught:
        await HttpPlatformGateway(
            endpoints(), transport=httpx.MockTransport(rejected)
        ).exchange_code("gigacode", code, ("repo:read",))
    assert code not in str(caught.value)
    with pytest.raises(ProviderOutageError) as outage:
        await HttpPlatformGateway(
            endpoints(token_urls={}), transport=httpx.MockTransport(rejected)
        ).exchange_code("gigacode", code, ("repo:read",))
    assert code not in str(outage.value)


@pytest.mark.asyncio
async def test_unconfigured_or_insecure_endpoints_stay_offline() -> None:
    gateway = HttpPlatformGateway(
        endpoints(token_urls={}, item_urls={}),
        transport=httpx.MockTransport(lambda request: httpx.Response(200)),
    )
    with pytest.raises(ProviderOutageError):
        await gateway.exchange_code("gigacode", "code", ("repo:read",))

    insecure = HttpPlatformGateway(
        PlatformHttpEndpoints(token_urls={"gitverse": "http://gitverse.ru/oauth/token"}),
        transport=httpx.MockTransport(lambda request: httpx.Response(200)),
    )
    with pytest.raises(ProviderOutageError):
        await insecure.exchange_code("gitverse", "code", ())


@pytest.mark.asyncio
async def test_dry_run_permits_no_network_side_effects() -> None:
    def must_not_call(request: httpx.Request) -> httpx.Response:
        raise AssertionError("dry-run must not reach the network")

    gateway = HttpPlatformGateway(
        endpoints(), dry_run=True, transport=httpx.MockTransport(must_not_call)
    )
    with pytest.raises(ProviderOutageError):
        await gateway.exchange_code("gigacode", "code", ("repo:read",))
    with pytest.raises(ProviderOutageError):
        await gateway.revoke_token("gigacode", "at-token")
    sync_gateway = HttpPlatformSyncGateway(
        endpoints(item_urls={"gigaagent": ITEM_URL}),
        dry_run=True,
        transport=httpx.MockTransport(must_not_call),
    )
    with pytest.raises(ProviderOutageError):
        await sync_gateway.fetch_items("gigaagent", "at-token", "workspace-1")


@pytest.mark.asyncio
async def test_revoke_returns_boolean_by_provider_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if b"token=at-live" in request.content:
            return httpx.Response(200)
        return httpx.Response(401)

    gateway = HttpPlatformGateway(endpoints(), transport=httpx.MockTransport(handler))
    assert await gateway.revoke_token("gigacode", "at-live") is True
    with pytest.raises(CredentialRejectedError):
        await gateway.revoke_token("gigacode", "at-dead")


@pytest.mark.asyncio
async def test_sync_fetch_parses_derived_projection_items() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer at-sync"
        assert request.url.params["workspace"] == "acme/repo"
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "kind": "commit",
                        "id": "abc-123",
                        "title": "feat: первый коммит",
                        "url": "https://provider.example/acme/commit/abc-123",
                        "occurred_at": "2026-10-22T10:00:00Z",
                        "provisional": False,
                    },
                    {"kind": "mystery", "id": "unknown-kind"},
                    {"kind": "commit", "id": "bogus-kit", "title": None},
                ]
            },
        )

    gateway = HttpPlatformSyncGateway(
        endpoints(item_urls={"gitverse": ITEM_URL}), transport=httpx.MockTransport(handler)
    )
    items = await gateway.fetch_items("gitverse", "at-sync", "acme/repo")
    assert len(items) == 2
    assert items[0].kind is SyncItemKind.COMMIT
    assert items[0].external_id == "abc-123"
    assert items[0].title_label == "feat: первый коммит"
    assert items[0].occurred_at is not None
    assert isinstance(items[1], ProviderSyncItem)
    assert items[1].title_label is None


@pytest.mark.asyncio
async def test_sync_fetch_honest_failures() -> None:
    def rejected(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "expired_token"})

    with pytest.raises(CredentialRejectedError):
        await HttpPlatformSyncGateway(
            endpoints(), transport=httpx.MockTransport(rejected)
        ).fetch_items("gigacode", "at-expired", None)

    def malformed(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not json")

    with pytest.raises(ProviderOutageError):
        await HttpPlatformSyncGateway(
            endpoints(), transport=httpx.MockTransport(malformed)
        ).fetch_items("gigacode", "at-token", None)
