"""TC-016 concurrency marker contract for the recommendation surface.

A stable ETag-style token over the mutable brief/terms facts plus a
timezone-aware deadline guard. The pre-apply revalidate reads the live
snapshot and compares the submitted marker: any drift yields the typed
``TermsChangedConflict`` (mapped to ``TERMS_CHANGED`` 409). The canonical
apply path in ``WorkService`` remains the source of truth; this contract
gives the conditions dialog an honest, structured preflight marker.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import TYPE_CHECKING
from uuid import UUID

from impulse.application.task_catalog import (
    CatalogContractError,
    TaskRecommendationProjection,
)
from impulse.application.task_catalog_visibility import deadline_cutoff

if TYPE_CHECKING:
    from impulse.application.task_terms_read import TaskTermsSnapshot


class TermsChangedConflict(CatalogContractError):
    """Typed drift signal: submitted marker no longer matches the live snapshot."""


class MarkerError(CatalogContractError):
    """Raised when a marker payload violates the token contract."""


def _aware(deadline_at: datetime | None) -> datetime | None:
    if deadline_at is None:
        return None
    if deadline_at.tzinfo is None:
        raise MarkerError("Catalog deadlines must be timezone-aware.")
    return deadline_cutoff(deadline_at)


@dataclass(frozen=True, slots=True)
class CatalogTermsMarker:
    """Immutable freshness signature over the versioned terms facts."""

    task_id: UUID
    terms_version: int
    brief_version: int
    snapshot_version: str
    deadline_at: datetime | None

    def __post_init__(self) -> None:
        if self.terms_version < 1 or self.brief_version < 1:
            raise MarkerError("Marker versions must be positive integers.")
        _aware(self.deadline_at)

    @property
    def token(self) -> str:
        payload = f"tc:{self.terms_version}:{self.brief_version}:{self.snapshot_version}"
        digest = sha256(payload.encode("utf-8")).hexdigest()[:16]
        return f'"tc-{digest}"'


def marker_for(
    terms: TaskTermsSnapshot, projection: TaskRecommendationProjection
) -> CatalogTermsMarker:
    """Build a marker from a TaskTermsSnapshot and its projection pair."""
    return CatalogTermsMarker(
        task_id=terms.task_id,
        terms_version=terms.terms_version,
        brief_version=terms.brief_version,
        snapshot_version=projection.snapshot_version,
        deadline_at=terms.deadline_at,
    )


def parse_submitted_token(value: str | None) -> str | None:
    """Normalize a client-submitted token (with or without quotes)."""
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if not stripped.startswith('"'):
        stripped = f'"{stripped}"'
    if len(stripped) < 8 or not stripped.endswith('"'):
        raise MarkerError("Submitted catalog marker is malformed.")
    return stripped


__all__ = [
    "CatalogTermsMarker",
    "MarkerError",
    "TermsChangedConflict",
    "marker_for",
    "parse_submitted_token",
]
