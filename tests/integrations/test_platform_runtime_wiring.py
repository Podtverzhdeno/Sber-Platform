"""Production-app wiring checks for the platform catalog (openspec 22.20)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.integrations.runtime import (
    DefaultProjectPlatformConfig,
    FailClosedPlatformGateway,
    WorkAssignmentMembership,
)
from impulse.integrations.service import DeploymentSealedVault, ProviderOutageError

from .conftest import ALEX, build_app, login


@dataclass(frozen=True, slots=True)
class AssignmentStub:
    id: UUID
    task_id: UUID
    person_id: UUID


class AssignmentStoreStub:
    def __init__(self, project_id: UUID, person_id: UUID) -> None:
        self.assignment = AssignmentStub(uuid4(), project_id, person_id)

    async def assignments_for_task(self, task_id: UUID) -> tuple[AssignmentStub, ...]:
        return (self.assignment,) if task_id == self.assignment.task_id else ()


async def test_runtime_adapters_are_project_scoped_and_fail_closed() -> None:
    project_id = uuid4()
    membership = WorkAssignmentMembership(AssignmentStoreStub(project_id, ALEX))  # type: ignore[arg-type]
    assert await membership.active_assignment(project_id, ALEX) is not None
    assert await membership.active_assignment(project_id, uuid4()) is None
    assert await DefaultProjectPlatformConfig().enabled_providers(project_id) == frozenset(
        {"gigacode", "gigacowork", "gigaagent", "gitverse"}
    )
    gateway = FailClosedPlatformGateway()
    try:
        await gateway.exchange_code("gitverse", "code", ("repo:read",))
    except ProviderOutageError:
        pass
    else:
        raise AssertionError("runtime gateway must not fabricate a successful token exchange")


def test_deployment_vault_uses_explicit_secret_and_rejects_short_values() -> None:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        platform_vault_secret=SecretStr("v" * 32),
    )
    vault = DeploymentSealedVault.from_secret(settings.platform_sealing_secret())
    sealed = vault.seal("provider-secret")
    assert vault.unseal(sealed, "gitverse") == "provider-secret"
    assert "provider-secret" not in repr(sealed)
    with pytest.raises(ValueError, match="at least 32"):
        DeploymentSealedVault.from_secret("too-short")


def test_create_app_mounts_platform_router_and_injected_service() -> None:
    fixture = build_app()
    project_id = uuid4()
    fixture.membership.add(project_id, ALEX)
    app = create_app(
        Settings(app_env=AppEnvironment.TEST),
        platforms_service=fixture.service,
    )
    with TestClient(app) as client:
        login(client, "participant-alex")
        response = client.get(f"/api/v1/projects/{project_id}/platforms")

    assert response.status_code == 200, response.text
    assert {item["provider_key"] for item in response.json()["items"]} == {
        "gigacode",
        "gitverse",
    }
    assert app.state.platforms_service is fixture.service
