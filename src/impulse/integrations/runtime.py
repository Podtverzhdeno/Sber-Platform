"""Runtime adapters for project platform connections."""

from __future__ import annotations

from uuid import UUID

from impulse.application.work import WorkStore
from impulse.integrations.providers import PROVIDER_KEYS
from impulse.integrations.service import GatewayTokens, ProviderOutageError


class WorkAssignmentMembership:
    """Authorize platform access from the canonical work assignment store."""

    def __init__(self, store: WorkStore) -> None:
        self._store = store

    async def active_assignment(self, project_id: UUID, person_id: UUID) -> UUID | None:
        assignments = await self._store.assignments_for_task(project_id)
        return next(
            (assignment.id for assignment in assignments if assignment.person_id == person_id),
            None,
        )


class DefaultProjectPlatformConfig:
    """Initial project policy: expose the four reviewed providers."""

    async def enabled_providers(self, project_id: UUID) -> frozenset[str]:
        del project_id
        return frozenset(PROVIDER_KEYS)


class FailClosedPlatformGateway:
    """Safe runtime boundary until a provider-specific OAuth client is configured.

    Starting a connection still creates a short-lived, audited state challenge;
    exchanging or revoking credentials never fabricates success or tokens.
    """

    async def exchange_code(
        self, provider_key: str, code: str, scopes: tuple[str, ...]
    ) -> GatewayTokens:
        del provider_key, code, scopes
        raise ProviderOutageError

    async def revoke_token(self, provider_key: str, access_token: str) -> bool:
        del provider_key, access_token
        raise ProviderOutageError
