"""HTTP contract of the explainable Bootcamp catalog projection (openspec 22.15).

The read endpoint exposes one card per catalog course with independent
access/completion/recommendation measurements, so the UI never has to fake a
state dimension from another one: badges, buttons and notes map one-to-one onto
``CourseCard`` fields.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp.catalog import CourseCard
from impulse.bootcamp.service import BootcampCatalogService

router = APIRouter(tags=["bootcamp"])


class MustTakeView(BaseModel):
    skill: str = Field(examples=["OpenSpec / SDD"])
    current_level: str | None
    target_level: str | None
    projected_impact: str
    explanation: str


class CourseCardView(BaseModel):
    key: str
    title: str
    track_keys: list[str]
    source_url: str
    access_state: str
    access_note: str
    completion_state: str
    relevant: bool
    relevance_reasons: list[str]
    recommendation_reason: str
    must_take: MustTakeView | None
    pending_verification_note: str | None
    verified_evidence: str | None


def _card_view(card: CourseCard) -> CourseCardView:
    must_take = card.must_take
    return CourseCardView(
        key=card.key,
        title=card.title,
        track_keys=list(card.track_keys),
        source_url=card.source_url,
        access_state=card.access_state,
        access_note=card.access_note,
        completion_state=card.completion_state,
        relevant=card.relevant,
        relevance_reasons=list(card.relevance_reasons),
        recommendation_reason=card.recommendation_reason,
        must_take=(
            MustTakeView(
                skill=must_take.skill,
                current_level=must_take.current_level,
                target_level=must_take.target_level,
                projected_impact=must_take.projected_impact,
                explanation=must_take.explanation,
            )
            if must_take is not None
            else None
        ),
        pending_verification_note=card.pending_verification_note,
        verified_evidence=card.verified_evidence,
    )


def _catalog_service(request: Request) -> BootcampCatalogService:
    development = request.app.state.development_service.store
    competencies = getattr(request.app.state, "competency_service", None)
    return BootcampCatalogService(development, competencies)


@router.get(
    "/me/bootcamp/catalog",
    response_model=list[CourseCardView],
    summary="Каталог Bootcamp карточкой на курс: доступ, завершение и «Надо пройти»",
)
async def bootcamp_catalog(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BootcampCatalogService, Depends(_catalog_service)],
) -> list[CourseCardView]:
    return [_card_view(card) for card in await service.catalog(authenticated.actor)]


__all__ = ["CourseCardView", "MustTakeView", "router"]
