"""TC-015 permitted recommendation-detail and terms read contract.

The detail surface reuses the TC-008 page service ``require_visible`` authority;
the terms read loads the current permitted brief/terms version pair and the
explicit participation conditions. Both reads are separated from private
project state: no workspace, assignment or checkpoint fields exist on these
views, and a denied or removed task resolves to the same typed safe not-found.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from impulse.api.errors import ApiError
from impulse.application.task_catalog import CatalogContractError, TaskRecommendationProjection
from impulse.application.task_catalog_page import TaskCatalogPageService
from impulse.application.task_catalog_visibility import TaskVisibilityError
from impulse.application.task_concurrency import (
    CatalogTermsMarker,
    TermsChangedConflict,
    marker_for,
    parse_submitted_token,
)
from impulse.domain.identity import ActorContext, Role


class TaskTermsError(CatalogContractError):
    """Raised when a terms snapshot violates the permitted-fields contract."""


def _require_paid_condition(paid: bool, payout_condition: str | None) -> None:
    if paid and not (payout_condition or "").strip():
        raise TaskTermsError("Paid participation requires an explicit payout condition.")


@dataclass(frozen=True, slots=True)
class TaskTermsSnapshot:
    """Permitted participation conditions for one visible task (TC-006 fields)."""

    task_id: UUID
    terms_version: int
    brief_version: int
    deliverable: str
    prerequisites: tuple[str, ...]
    selection_criteria: tuple[str, ...]
    support_model: str
    ip_terms: str
    portfolio_permission: str
    paid: bool
    payout_condition: str | None
    deadline_at: datetime | None
    data_constraints: str | None = None
    acceptance_criteria: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.terms_version < 1 or self.brief_version < 1:
            raise TaskTermsError("Terms and brief versions must be positive integers.")
        if self.deadline_at is not None and self.deadline_at.tzinfo is None:
            raise TaskTermsError("Catalog deadlines must be timezone-aware.")
        if not self.deliverable.strip():
            raise TaskTermsError("Terms snapshot requires an explicit deliverable.")
        if not self.support_model.strip():
            raise TaskTermsError("Support model must be explicit; use none when absent.")
        if self.portfolio_permission not in ("none", "restricted", "conditional", "full"):
            raise TaskTermsError(
                "Portfolio permission must be none, restricted, conditional or full."
            )
        # Empty tuples are authoritative "none published" states.  The UI must
        # say so explicitly instead of inventing prerequisite/selection rules.
        _require_paid_condition(self.paid, self.payout_condition)


DetailProvider = Callable[
    [ActorContext], Awaitable[Sequence[tuple[TaskRecommendationProjection, TaskTermsSnapshot]]]
]


class TaskDetailReadService:
    """Participant-scoped detail and terms reads over TC-009 visible admissions."""

    def __init__(
        self,
        page_service: TaskCatalogPageService,
        terms_provider: DetailProvider,
    ) -> None:
        self._page_service = page_service
        self._terms_provider = terms_provider

    @staticmethod
    def _role(actor: ActorContext, role: Role) -> None:
        if actor.active_role is not role:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для роли.", status_code=403
            )

    async def detail(self, actor: ActorContext, task_id: UUID) -> TaskRecommendationProjection:
        self._role(actor, Role.PARTICIPANT)
        return await self._page_service.require_visible(actor, task_id)

    async def pair(
        self, actor: ActorContext, task_id: UUID
    ) -> tuple[TaskRecommendationProjection, TaskTermsSnapshot]:
        self._role(actor, Role.PARTICIPANT)
        projection = await self._page_service.require_visible(actor, task_id)
        for item, terms in await self._terms_provider(actor):
            if item.task_id == projection.task_id:
                return projection, terms
        raise TaskVisibilityError("Задача недоступна или не существует.")

    async def terms(self, actor: ActorContext, task_id: UUID) -> TaskTermsSnapshot:
        return (await self.pair(actor, task_id))[1]

    async def revalidate(
        self,
        actor: ActorContext,
        task_id: UUID,
        submitted_token: str | None = None,
        submitted_terms_version: int | None = None,
    ) -> CatalogTermsMarker:
        """Pre-apply guard: drift against the submitted marker is TERMS_CHANGED."""
        projection, terms = await self.pair(actor, task_id)
        marker = marker_for(terms, projection)
        if submitted_terms_version is not None and submitted_terms_version != marker.terms_version:
            raise TermsChangedConflict(
                "Условия изменились. Откройте актуальную версию и подтвердите её."
            )
        if submitted_token is not None:
            normalized = parse_submitted_token(submitted_token)
            if normalized != marker.token:
                raise TermsChangedConflict(
                    "Условия изменились. Откройте актуальную версию и подтвердите её."
                )
        return marker


__all__ = ["TaskDetailReadService", "TaskTermsError", "TaskTermsSnapshot"]
