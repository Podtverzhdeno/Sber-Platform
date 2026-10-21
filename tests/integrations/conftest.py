"""Shared builders for project platform connection tests (openspec 22.20/22.21)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.api.errors import install_error_handlers
from impulse.api.v1.identity import router as identity_router
from impulse.application.identity import (
    ActorContext,
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.integrations.api import router as platform_router
from impulse.integrations.providers import GIGACODE, GITVERSE
from impulse.integrations.service import (
    ConnectionStore,
    GatewayTokens,
    MembershipPort,
    MemoryConnectionStore,
    PlatformConnectionService,
    PlatformGateway,
    ProjectPlatformConfigPort,
    SealedVault,
)
from impulse.integrations.sync import (
    MemorySyncStore,
    PlatformSyncService,
    ProviderSyncItem,
)

SECRET_ACCESS_TOKEN = "gitverse_live_demo_access_token_31337"
SECRET_REFRESH_TOKEN = "gitverse_live_demo_refresh_token_31337"
VAULT_KEY = bytes(range(64))


def _persona_id(key: str) -> UUID:
    """Resolve a stable demo persona id (uuid5-derived, like the identity layer)."""
    matches = [item.person_id for item in demo_personas() if item.key == key]
    assert len(matches) == 1
    return matches[0]


ALEX = _persona_id("participant-alex")
MARIA = _persona_id("participant-maria")


def login(client: TestClient, persona: str) -> str:
    """Demo-login a persona and return its CSRF token."""
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200, response.text
    token = response.json()["csrf_token"]
    assert isinstance(token, str)
    return token


@dataclass
class TestClock:
    """Controllable clock for expiry scenarios."""

    moment: datetime = field(default_factory=lambda: datetime(2026, 10, 19, 12, 0, tzinfo=UTC))

    def __call__(self) -> datetime:
        return self.moment

    def advance(self, delta: timedelta) -> None:
        self.moment = self.moment + delta


class ScriptedGateway:
    """Scriptable platform gateway standing in for real provider HTTP."""

    def __init__(self) -> None:
        self.exchange_calls: list[tuple[str, str, tuple[str, ...]]] = []
        self.revoke_calls: list[tuple[str, str]] = []
        self.exchange_error: Exception | None = None
        self.revoke_error: Exception | None = None

    async def exchange_code(
        self, provider_key: str, code: str, scopes: tuple[str, ...]
    ) -> GatewayTokens:
        self.exchange_calls.append((provider_key, code, scopes))
        error = self.exchange_error
        if error is not None:
            raise error
        return GatewayTokens(
            access_token=SECRET_ACCESS_TOKEN,
            refresh_token=SECRET_REFRESH_TOKEN,
            account_ref="alex@gitverse",
            expires_in_seconds=3600,
        )

    async def revoke_token(self, provider_key: str, access_token: str) -> bool:
        self.revoke_calls.append((provider_key, access_token))
        error = self.revoke_error
        if error is not None:
            raise error
        return True


class ScriptedSyncGateway:
    """Scriptable provider sync surface standing in for real provider HTTP."""

    def __init__(self) -> None:
        self.items: tuple[ProviderSyncItem, ...] = ()
        self.error: Exception | None = None
        self.calls: list[tuple[str, str, str | None]] = []

    async def fetch_items(
        self, provider_key: str, access_token: str, workspace_ref: str | None
    ) -> tuple[ProviderSyncItem, ...]:
        self.calls.append((provider_key, access_token, workspace_ref))
        error = self.error
        if error is not None:
            raise error
        return self.items


class StaticCheckpoints:
    """Actor-owned actionable checkpoint keys for binding scenarios."""

    def __init__(self) -> None:
        self.keys: frozenset[str] = frozenset()

    async def actionable_checkpoints(self, actor: ActorContext) -> frozenset[str]:
        del actor
        return self.keys


class StaticMembership:
    """Assignment-backed membership port over real assignment facts."""

    def __init__(self) -> None:
        self.assignments: dict[tuple[UUID, UUID], UUID] = {}

    def add(self, project_id: UUID, person_id: UUID) -> UUID:
        assignment_id = uuid4()
        self.assignments[(project_id, person_id)] = assignment_id
        return assignment_id

    async def active_assignment(self, project_id: UUID, person_id: UUID) -> UUID | None:
        return self.assignments.get((project_id, person_id))


class StaticProjectConfig:
    enabled = frozenset({GIGACODE.key, GITVERSE.key})

    async def enabled_providers(self, project_id: UUID) -> frozenset[str]:
        return self.enabled


@dataclass(frozen=True, slots=True)
class PlatformFixture:
    """Fully wired app + platform service for API-level scenarios."""

    app: FastAPI
    service: PlatformConnectionService
    store: MemoryConnectionStore
    gateway: ScriptedGateway
    membership: StaticMembership
    clock: TestClock
    person_ids: dict[str, UUID]
    sync_service: PlatformSyncService
    sync_store: MemorySyncStore
    sync_gateway: ScriptedSyncGateway
    checkpoints: StaticCheckpoints

    def member_client(self, persona: str) -> tuple[TestClient, str]:
        """Authenticated client for a demo persona with its CSRF token."""
        client = TestClient(self.app)
        response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
        assert response.status_code == 200, response.text
        token = response.json()["csrf_token"]
        assert isinstance(token, str)
        return client, token


@pytest.fixture
def platform() -> PlatformFixture:
    """Fresh app with standard GigaCode/GitVerse config and no memberships."""
    return build_app()


def connect_and_confirm(
    client: TestClient,
    csrf: str,
    project_id: UUID,
    provider_key: str = GITVERSE.key,
    *,
    workspace_ref: str = "impulse-demo/navigator",
    idempotency_key: str = "connect-gitverse-demo",
) -> dict[str, object]:
    """Drive start → callback and return the resulting connection view."""
    challenge = client.post(
        f"/api/v1/projects/{project_id}/platforms/{provider_key}/connect",
        headers={"X-CSRF-Token": csrf},
        json={"workspace_ref": workspace_ref},
    )
    assert challenge.status_code == 201, challenge.text
    state = challenge.json()["state"]
    completed = client.post(
        f"/api/v1/projects/{project_id}/platforms/{provider_key}/callback",
        headers={"X-CSRF-Token": csrf},
        json={
            "state": state,
            "code": "oauth_code_demo",
            "idempotency_key": idempotency_key,
        },
    )
    assert completed.status_code == 200, completed.text
    return completed.json()


def completed_connection(
    client: TestClient,
    csrf: str,
    project_id: UUID,
    *,
    provider_key: str = GITVERSE.key,
    workspace_ref: str = "impulse-demo/navigator",
) -> UUID:
    """Return the connection id for the successfully connected platform."""
    view = connect_and_confirm(
        client,
        csrf,
        project_id,
        provider_key,
        workspace_ref=workspace_ref,
    )
    identifier = view["id"]
    assert isinstance(identifier, str)
    return UUID(identifier)


def build_app(
    *,
    vault: SealedVault | None = None,
    gateway: PlatformGateway | None = None,
    store: ConnectionStore | None = None,
    membership: MembershipPort | None = None,
    config: ProjectPlatformConfigPort | None = None,
    clock: TestClock | None = None,
    sync_gateway: ScriptedSyncGateway | None = None,
    sync_store: MemorySyncStore | None = None,
    checkpoints: StaticCheckpoints | None = None,
) -> PlatformFixture:
    """Assemble the identity + platform routers behind one real FastAPI app."""
    clock = clock or TestClock()
    gateway = gateway or ScriptedGateway()
    store = store or MemoryConnectionStore()
    membership = membership or StaticMembership()
    config = config or StaticProjectConfig()
    sealed_vault = vault or SealedVault(VAULT_KEY)
    service = PlatformConnectionService(
        cast(ConnectionStore, store),
        sealed_vault,
        cast(PlatformGateway, gateway),
        cast(MembershipPort, membership),
        cast(ProjectPlatformConfigPort, config),
        now=clock,
    )
    sync_items_store = MemorySyncStore() if sync_store is None else sync_store
    sync_items_gateway = sync_gateway or ScriptedSyncGateway()
    binding_points = checkpoints or StaticCheckpoints()
    sync_service = PlatformSyncService(
        cast(ConnectionStore, store),
        sync_items_store,
        sync_items_gateway,
        binding_points,
        cast(MembershipPort, membership),
        cast(ProjectPlatformConfigPort, config),
        sealed_vault,
        now=clock,
    )
    app = FastAPI()
    app.state.settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("platform-catalog-test-secret-long-enough"),
    )
    app.state.auth_service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret="platform-catalog-test-secret-long-enough",
        ttl_seconds=3600,
    )
    app.state.platforms_service = service
    app.state.platforms_sync_service = sync_service
    install_error_handlers(app)
    app.include_router(identity_router, prefix="/api/v1")
    app.include_router(platform_router, prefix="/api/v1")
    person_ids = {item.key: item.person_id for item in demo_personas()}
    return PlatformFixture(
        app=app,
        service=service,
        store=cast(MemoryConnectionStore, store),
        gateway=cast(ScriptedGateway, gateway),
        membership=cast(StaticMembership, membership),
        clock=clock,
        person_ids=person_ids,
        sync_service=sync_service,
        sync_store=sync_items_store,
        sync_gateway=sync_items_gateway,
        checkpoints=binding_points,
    )
