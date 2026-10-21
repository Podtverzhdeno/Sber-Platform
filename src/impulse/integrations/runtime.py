"""Runtime adapters for project platform connections."""

from __future__ import annotations

from uuid import UUID

from impulse.application.development import DevelopmentService
from impulse.application.identity import ActorContext
from impulse.application.work import WorkStore
from impulse.domain.development import CompletionStatus
from impulse.integrations.providers import PROVIDER_KEYS
from impulse.integrations.service import (
    GatewayTokens,
    ProviderOutageError,
)
from impulse.integrations.sync import ProviderSyncItem
from impulse.trajectory_map.projection import build_trajectory_map


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


class FailClosedPlatformSyncGateway:
    """Fail-closed sync boundary: no provider client configured, no imports."""

    async def fetch_items(
        self,
        provider_key: str,
        access_token: str,
        workspace_ref: str | None,
    ) -> tuple[ProviderSyncItem, ...]:
        del provider_key, access_token, workspace_ref
        raise ProviderOutageError


class TrajectoryCheckpointLocator:
    """Read-only checkpoint facts from the actor's own trajectory roadmaps.

    The locator only lists what exists; binding validation relies on this
    snapshot and progress stays owned by the development/verification flow.
    """

    def __init__(self, development: DevelopmentService) -> None:
        self._development = development

    async def actionable_checkpoints(self, actor: ActorContext) -> frozenset[str]:
        projections = await self._development.roadmaps(actor)
        if not projections:
            return frozenset()
        enrollments: dict[str, CompletionStatus] = {
            item.course_key: item.status
            for item in await self._development.store.enrollments(actor.person_id)
        }
        keys: set[str] = set()
        for projection in projections:
            view = build_trajectory_map(projection, enrollments=enrollments)
            keys.update(node.key for node in view.checkpoints if node.actionable)
        return frozenset(keys)
