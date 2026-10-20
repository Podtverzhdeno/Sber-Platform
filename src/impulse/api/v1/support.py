"""Authenticated catalog of published customer support models."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.domain.support import SUPPORT_CATALOG_VERSION, published_support_models

router = APIRouter()


class SupportModelView(BaseModel):
    code: str
    name: str
    responsible: str
    activities: list[str]
    response_time: str
    restrictions: list[str]
    available: bool
    unavailable_reason: str | None
    requires_assignee: bool


class SupportCatalogView(BaseModel):
    version: int
    models: list[SupportModelView]


@router.get("/customer/support-models", response_model=SupportCatalogView)
async def support_model_catalog(
    _authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> SupportCatalogView:
    return SupportCatalogView(
        version=SUPPORT_CATALOG_VERSION,
        models=[
            SupportModelView(
                code=item.code,
                name=item.name,
                responsible=item.responsible,
                activities=list(item.activities),
                response_time=item.response_time,
                restrictions=list(item.restrictions),
                available=item.available,
                unavailable_reason=item.unavailable_reason,
                requires_assignee=item.requires_assignee,
            )
            for item in published_support_models()
        ],
    )
