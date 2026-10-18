"""Global search API over published tasks, courses and events."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.search import SearchHit, SearchService

router = APIRouter()

MAX_SEARCH_LIMIT = 20
MIN_QUERY_LENGTH = 2


class SearchResults(BaseModel):
    items: list[SearchItem]


class SearchItem(BaseModel):
    kind: str
    ref: str
    title: str
    meta: str


def _service(request: Request) -> SearchService:
    return request.app.state.search_service


def _view(hit: SearchHit) -> SearchItem:
    return SearchItem(kind=hit.kind, ref=hit.ref, title=hit.title, meta=hit.meta)


@router.get("/search", response_model=SearchResults)
async def search(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[SearchService, Depends(_service)],
    q: str = Query(min_length=MIN_QUERY_LENGTH, max_length=96),
    limit: int = Query(default=8, ge=1, le=MAX_SEARCH_LIMIT),
) -> SearchResults:
    hits = await service.search(
        authenticated.actor,
        q,
        limit=limit,
    )
    return SearchResults(items=[_view(hit) for hit in hits])
