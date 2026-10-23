"""HTTP contract of the explainable Bootcamp catalog projection (openspec 22.15).

The read endpoint exposes one card per catalog course with independent
access/completion/recommendation measurements, so the UI never has to fake a
state dimension from another one: badges, buttons and notes map one-to-one onto
``CourseCard`` fields.
"""

from __future__ import annotations

from typing import Annotated, Protocol

from fastapi import APIRouter, Depends, Header, Query, Request
from pydantic import BaseModel, Field

from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.bootcamp.catalog import CourseCard
from impulse.bootcamp.commands import (
    BootcampLearningCommandService,
    LearningAction,
    LearningCommandResult,
)
from impulse.bootcamp.detail import CourseDetail
from impulse.bootcamp.overview import BootcampOverviewV2
from impulse.bootcamp.service import BootcampCatalogService

router = APIRouter(tags=["bootcamp"])


class BootcampV2ProjectionService(Protocol):
    async def overview(self, person_id: object, track_key: str | None) -> BootcampOverviewV2: ...

    async def detail(
        self, person_id: object, course_key: str, course_version: str | None
    ) -> CourseDetail: ...


class LearningCommandBody(BaseModel):
    course_version: str = Field(min_length=1, max_length=120)


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


def _v2_service(request: Request) -> BootcampV2ProjectionService:
    service = getattr(request.app.state, "bootcamp_v2_service", None)
    if service is None:
        from impulse.api.errors import ApiError

        raise ApiError(
            code="BOOTCAMP_PROVIDER_UNAVAILABLE",
            message="Данные Bootcamp временно недоступны.",
            status_code=503,
            retryable=True,
        )
    return service


def _learning_commands(request: Request) -> BootcampLearningCommandService:
    service = getattr(request.app.state, "bootcamp_learning_commands", None)
    if service is None:
        from impulse.api.errors import ApiError

        raise ApiError(
            code="BOOTCAMP_COMMANDS_UNAVAILABLE",
            message="Действия Bootcamp временно недоступны.",
            status_code=503,
            retryable=True,
        )
    return service


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


@router.get("/me/bootcamp/overview", response_model=BootcampOverviewV2)
async def bootcamp_overview_v2(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BootcampV2ProjectionService, Depends(_v2_service)],
    track: Annotated[str | None, Query(max_length=120)] = None,
) -> BootcampOverviewV2:
    return await service.overview(authenticated.actor.person_id, track)


@router.get("/me/bootcamp/courses/{course_key}", response_model=CourseDetail)
async def bootcamp_course_detail_v2(
    course_key: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BootcampV2ProjectionService, Depends(_v2_service)],
    course_version: Annotated[str | None, Query(max_length=120)] = None,
) -> CourseDetail:
    return await service.detail(authenticated.actor.person_id, course_key, course_version)


@router.post(
    "/me/bootcamp/courses/{course_key}/{action}",
    response_model=LearningCommandResult,
)
async def bootcamp_learning_command(
    course_key: str,
    action: LearningAction,
    body: LearningCommandBody,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BootcampLearningCommandService, Depends(_learning_commands)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=200)],
) -> LearningCommandResult:
    return await service.execute(
        authenticated.actor,
        course_key=course_key,
        course_version=body.course_version,
        action=action,
        idempotency_key=idempotency_key,
    )


__all__ = [
    "BootcampV2ProjectionService",
    "CourseCardView",
    "LearningCommandBody",
    "MustTakeView",
    "router",
]
