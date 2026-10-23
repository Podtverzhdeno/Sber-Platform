"""Server-side page contract for the participant task recommendation catalog (TC-008).

Pure query/paging semantics over :class:`TaskRecommendationProjection` items.
No storage access and no matching policy: the projection supplier stays an
explicit callable, so the recommendation lane can replace the interim default
ordering without touching this contract. Ordering keys are composed only from
stable comparable primitives (ints, ISO strings, stable task IDs) so a cursor
round-trips through JSON without recomputing any projection.
"""

from __future__ import annotations

import base64
import binascii
import json
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC
from typing import Any, cast

from impulse.api.errors import ApiError
from impulse.application.task_catalog import (
    CatalogContractError,
    EligibilityStatus,
    MatchStatus,
    TaskRecommendationProjection,
)
from impulse.domain.identity import ActorContext, Role

MATCH_SORT = "match-default"
DEADLINE_SORT = "deadline"
DURATION_SORT = "duration"
TASK_CATALOG_SORT_OPTIONS = (MATCH_SORT, DEADLINE_SORT, DURATION_SORT)

DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 50
_NO_DEADLINE_KEY = "9999-12-31T23:59:59.999999+00:00"
_MATCH_MAX_BUCKET = 100_000
_MATCH_PRECISION = 1000


class CatalogQueryError(CatalogContractError):
    """Raised for client-supplied queries the catalog contract cannot honor."""


@dataclass(frozen=True, slots=True)
class CatalogQuery:
    """Validated server-side query for recommendations (filters + ordering + cursor)."""

    q: str | None = None
    competency: tuple[str, ...] = ()
    difficulty: str | None = None
    work_format: str | None = None
    customer: str | None = None
    sort: str = MATCH_SORT
    page_size: int = DEFAULT_PAGE_SIZE
    cursor: str | None = None

    def __post_init__(self) -> None:
        if (self.q or "") and len(self.q) > 120:
            raise CatalogQueryError("Catalog search text must not exceed 120 characters.")
        for tag in self.competency:
            if not tag.strip() or len(tag) > 64:
                raise CatalogQueryError("Competency filter requires non-empty tags.")
        if self.sort not in TASK_CATALOG_SORT_OPTIONS:
            raise CatalogQueryError(
                "Unsupported catalog ordering key; expected one of "
                + ", ".join(TASK_CATALOG_SORT_OPTIONS)
                + "."
            )
        if not 1 <= self.page_size <= MAX_PAGE_SIZE:
            raise CatalogQueryError(f"Catalog page size must be between 1 and {MAX_PAGE_SIZE}.")
        if self.cursor is not None and not self.cursor:
            raise CatalogQueryError("Empty cursor is invalid; omit the parameter instead.")

    @property
    def fingerprint(self) -> str:
        """Filter/order fingerprint used to reject stale cursors."""
        return json.dumps(
            {
                "q": self.q,
                "competency": list(self.competency),
                "difficulty": self.difficulty,
                "work_format": self.work_format,
                "customer": self.customer,
                "sort": self.sort,
            },
            ensure_ascii=False,
            sort_keys=True,
        )


@dataclass(frozen=True, slots=True)
class CatalogPage:
    """One immutable page of the authoritative catalog ordering."""

    items: tuple[TaskRecommendationProjection, ...]
    total_found: int
    total_available: int
    next_cursor: str | None


def _cursor_sort_key(item: TaskRecommendationProjection, sort: str) -> tuple[Any, ...]:
    """Ordering primitive tuple; JSON round-trip safe (ints / ISO strings)."""
    task_id = item.stable_tie_breaker
    deadline = item.deadline_at
    deadline_key = (
        deadline.astimezone(UTC).isoformat() if deadline is not None else _NO_DEADLINE_KEY
    )
    if sort == DEADLINE_SORT:
        return (0 if deadline is not None else 1, deadline_key, task_id)
    if sort == DURATION_SORT:
        return (item.duration_minutes or _MATCH_MAX_BUCKET, task_id)
    match = item.match
    if match.status is MatchStatus.CALCULATED and match.percent is not None:
        bucket = _MATCH_MAX_BUCKET - int(match.percent * _MATCH_PRECISION)
        return (0, bucket, deadline_key, task_id)
    return (1, 0, deadline_key, task_id)


def _cursor_key(item: TaskRecommendationProjection, sort: str) -> str:
    return json.dumps(list(_cursor_sort_key(item, sort)))


def _encode_cursor(cursor_key: str, fingerprint: str) -> str:
    payload = {"key": cursor_key, "fp": fingerprint}
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8"))
    return raw.decode("ascii").rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, str]:
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        payload: object = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise CatalogQueryError("Catalog cursor is not valid.") from exc
    if not isinstance(payload, dict):
        raise CatalogQueryError("Catalog cursor is not valid.")
    mapping = cast("dict[str, object]", payload)
    cursor_key = mapping.get("key")
    fingerprint = mapping.get("fp")
    if not isinstance(cursor_key, str) or not isinstance(fingerprint, str):
        raise CatalogQueryError("Catalog cursor is not valid.")
    return cursor_key, fingerprint


def _matches_filters(item: TaskRecommendationProjection, query: CatalogQuery) -> bool:
    query_text = (query.q or "").casefold()
    if query_text:
        haystack = (
            item.title + " " + item.brief_summary + " " + " ".join(item.competency_tags)
        ).casefold()
        if query_text not in haystack:
            return False
    if query.competency:
        tags = {tag.casefold() for tag in item.competency_tags}
        if not all(tag.casefold() in tags for tag in query.competency):
            return False
    if query.difficulty:
        known = (item.difficulty or "").casefold()
        if known != query.difficulty.casefold():
            return False
    if query.work_format:
        known = (item.work_format or "").casefold()
        if known != query.work_format.casefold():
            return False
    if query.customer:
        presentation = item.customer.display_name.casefold()
        if query.customer.casefold() not in presentation:
            return False
    return True


def build_catalog_page(
    items: Sequence[TaskRecommendationProjection],
    query: CatalogQuery,
) -> CatalogPage:
    """Deterministic filter -> stable ordering -> keyset pagination."""
    visible = tuple(item for item in items if _matches_filters(item, query))
    ordered = sorted(visible, key=lambda item: _cursor_sort_key(item, query.sort))
    after_key: tuple[Any, ...] | None = None
    if query.cursor is not None:
        cursor_key, fingerprint = _decode_cursor(query.cursor)
        if fingerprint != query.fingerprint:
            raise CatalogQueryError("Catalog cursor belongs to a different query.")
        try:
            decoded = cast("list[object]", json.loads(cursor_key))
        except ValueError as exc:
            raise CatalogQueryError("Catalog cursor key is not valid.") from exc
        segments = decoded
        if len(segments) != _KEY_SHAPES[query.sort]:
            raise CatalogQueryError("Catalog cursor key is not valid.")
        after_key = tuple(segments)
    matched: list[TaskRecommendationProjection] = []
    for item in ordered:
        if after_key is not None and _cursor_sort_key(item, query.sort) <= after_key:
            continue
        matched.append(item)
    window = tuple(matched[: query.page_size])
    has_more = len(matched) > len(window)
    if window and has_more:
        next_cursor = _encode_cursor(_cursor_key(window[-1], query.sort), query.fingerprint)
    else:
        next_cursor = None
    return CatalogPage(
        items=window,
        total_found=len(ordered),
        total_available=sum(
            1 for item in items if item.eligibility.status is EligibilityStatus.ELIGIBLE
        ),
        next_cursor=next_cursor,
    )


_KEY_SHAPES = {
    MATCH_SORT: 4,
    DEADLINE_SORT: 3,
    DURATION_SORT: 2,
}

ProjectionProvider = Callable[[ActorContext], Awaitable[Sequence[TaskRecommendationProjection]]]


class TaskCatalogPageService:
    """Participant-scoped catalog page service over an explicit projection provider."""

    def __init__(self, provider: ProjectionProvider) -> None:
        self._provider = provider

    @staticmethod
    def _role(actor: ActorContext, role: Role) -> None:
        if actor.active_role is not role:
            raise ApiError(
                code="FORBIDDEN", message="Действие недоступно для роли.", status_code=403
            )

    async def page(self, actor: ActorContext, query: CatalogQuery) -> CatalogPage:
        self._role(actor, Role.PARTICIPANT)
        try:
            items = await self._provider(actor)
        except CatalogContractError:
            raise
        return build_catalog_page(items, query)
