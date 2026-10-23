"""Participant task recommendation catalog page API (TC-008, TC-015).

One page endpoint over the authoritative task recommendation projection:
server filters, stable documented ordering, keyset cursor pagination and
honest totals. TC-015 adds the permitted detail read and the explicit
participation-terms read; both enforce object-level visibility through the
TC-009 safe-404 authority and carry no private project state. Router
registration into the shared app stays with the task-catalog-integration lane.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, BaseModel

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.application.task_catalog import (
    ApplicationState,
    BenefitState,
    CatalogAction,
    CustomerVerification,
    EligibilityStatus,
    ForecastStatus,
    MatchReason,
    MatchStatus,
    StagePlanState,
    TaskRecommendationProjection,
)
from impulse.application.task_catalog_page import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    TASK_CATALOG_SORT_OPTIONS,
    TaskCatalogPageService,
)

router = APIRouter()


class CatalogCustomerView(BaseModel):
    id: UUID
    display_name: str
    verification: CustomerVerification


class CatalogMatchReasonView(BaseModel):
    code: str
    label: str


class CatalogMatchView(BaseModel):
    status: MatchStatus
    percent: Decimal | None
    coverage: Decimal
    algorithm_version: str | None
    source_snapshot_version: str
    calculated_at: datetime
    reasons: list[CatalogMatchReasonView]
    missing_factors: list[str]


class CatalogEligibilityView(BaseModel):
    status: EligibilityStatus
    reason_codes: list[str]
    missing_prerequisites: list[str]


class CatalogSkillImpactView(BaseModel):
    skill_id: str
    title: str
    status: ForecastStatus
    current_level: str | None
    projected_level: str | None
    model_version: str | None
    explanation: str
    verification_required: bool


class CatalogStagePlanItemView(BaseModel):
    key: str
    position: int
    title: str
    summary: str
    estimated_minutes: int | None
    state: StagePlanState


class CatalogStagePlanView(BaseModel):
    version: int
    stages: list[CatalogStagePlanItemView]


class CatalogBenefitView(BaseModel):
    code: str
    label: str
    state: BenefitState
    condition: str


class CatalogProjectionSourceView(BaseModel):
    kind: str
    ref: str
    version: str
    observed_at: datetime | None = None


class CatalogRecommendationItemView(BaseModel):
    task_id: UUID
    snapshot_version: str
    brief_version: int
    terms_version: int
    title: str
    customer: CatalogCustomerView
    brief_summary: str
    competency_tags: list[str]
    difficulty: str | None
    duration_minutes: int | None
    work_format: str | None
    places_total: int
    places_available: int | None
    deadline_at: AwareDatetime | None
    eligibility: CatalogEligibilityView
    match: CatalogMatchView
    skill_impact: list[CatalogSkillImpactView]
    stage_plan: CatalogStagePlanView
    benefits: list[CatalogBenefitView]
    application_state: ApplicationState
    allowed_actions: list[CatalogAction]
    sources: list[CatalogProjectionSourceView]
    generated_at: datetime


class CatalogPageView(BaseModel):
    items: list[CatalogRecommendationItemView]
    total_found: int
    total_available: int
    next_cursor: str | None


def _service(request: Request) -> TaskCatalogPageService:
    service = getattr(request.app.state, "task_catalog_service", None)
    if not isinstance(service, TaskCatalogPageService):
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    return service


def _match_reason(item: MatchReason) -> CatalogMatchReasonView:
    return CatalogMatchReasonView(code=item.code, label=item.label)


def _recommendation_item(item: TaskRecommendationProjection) -> CatalogRecommendationItemView:
    customer = item.customer
    eligibility = item.eligibility
    match = item.match
    stage_plan = item.stage_plan
    return CatalogRecommendationItemView(
        task_id=item.task_id,
        snapshot_version=item.snapshot_version,
        brief_version=item.brief_version,
        terms_version=item.terms_version,
        title=item.title,
        customer=CatalogCustomerView(
            id=customer.id,
            display_name=customer.display_name,
            verification=customer.verification,
        ),
        brief_summary=item.brief_summary,
        competency_tags=list(item.competency_tags),
        difficulty=item.difficulty,
        duration_minutes=item.duration_minutes,
        work_format=item.work_format,
        places_total=item.places_total,
        places_available=item.places_available,
        deadline_at=item.deadline_at,
        eligibility=CatalogEligibilityView(
            status=eligibility.status,
            reason_codes=list(eligibility.reason_codes),
            missing_prerequisites=list(eligibility.missing_prerequisites),
        ),
        match=CatalogMatchView(
            status=match.status,
            percent=match.percent,
            coverage=match.coverage,
            algorithm_version=match.algorithm_version,
            source_snapshot_version=match.source_snapshot_version,
            calculated_at=match.calculated_at,
            reasons=[_match_reason(reason) for reason in match.reasons],
            missing_factors=list(match.missing_factors),
        ),
        skill_impact=[
            CatalogSkillImpactView(
                skill_id=impact.skill_id,
                title=impact.title,
                status=impact.status,
                current_level=impact.current_level,
                projected_level=impact.projected_level,
                model_version=impact.model_version,
                explanation=impact.explanation,
                verification_required=impact.verification_required,
            )
            for impact in item.skill_impact
        ],
        stage_plan=CatalogStagePlanView(
            version=stage_plan.version,
            stages=[
                CatalogStagePlanItemView(
                    key=stage.key,
                    position=stage.position,
                    title=stage.title,
                    summary=stage.summary,
                    estimated_minutes=stage.estimated_minutes,
                    state=stage.state,
                )
                for stage in stage_plan.stages
            ],
        ),
        benefits=[
            CatalogBenefitView(
                code=benefit.code,
                label=benefit.label,
                state=benefit.state,
                condition=benefit.condition,
            )
            for benefit in item.benefits
        ],
        application_state=item.application_state,
        allowed_actions=sorted(item.allowed_actions),
        sources=[
            CatalogProjectionSourceView(
                kind=source.kind,
                ref=source.ref,
                version=source.version,
                observed_at=source.observed_at,
            )
            for source in item.sources
        ],
        generated_at=item.generated_at,
    )


@router.get("/me/task-recommendations", response_model=CatalogPageView)
async def task_recommendations(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[TaskCatalogPageService, Depends(_service)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    competency: Annotated[list[str] | None, Query(max_length=20)] = None,
    difficulty: Annotated[str | None, Query(max_length=48)] = None,
    work_format: Annotated[str | None, Query(max_length=48)] = None,
    customer: Annotated[str | None, Query(max_length=120)] = None,
    sort: Annotated[str, Query()] = TASK_CATALOG_SORT_OPTIONS[0],
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    cursor: Annotated[str | None, Query()] = None,
) -> CatalogPageView:
    from impulse.application.task_catalog_page import CatalogQuery, CatalogQueryError

    try:
        query = CatalogQuery(
            q=q,
            competency=tuple(competency or ()),
            difficulty=difficulty,
            work_format=work_format,
            customer=customer,
            sort=sort,
            page_size=page_size,
            cursor=cursor,
        )
        page = await service.page(authenticated.actor, query)
    except CatalogQueryError as exc:
        raise ApiError(code="CATALOG_QUERY_INVALID", message=str(exc), status_code=422) from exc
    return CatalogPageView(
        items=[_recommendation_item(item) for item in page.items],
        total_found=page.total_found,
        total_available=page.total_available,
        next_cursor=page.next_cursor,
    )


class CatalogTermsView(BaseModel):
    task_id: UUID
    terms_version: int
    brief_version: int
    deliverable: str
    prerequisites: list[str]
    selection_criteria: list[str]
    support_model: str
    ip_terms: str
    portfolio_permission: str
    paid: bool
    payout_condition: str | None
    deadline_at: datetime | None
    data_constraints: str | None


def _terms_service(request: Request) -> Any:
    service = getattr(request.app.state, "task_catalog_terms_service", None)
    if service is None:
        raise ApiError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
    return service


def _safe_not_found(exc: Exception) -> ApiError:
    return ApiError(code="RESOURCE_NOT_FOUND", message=str(exc), status_code=404)


@router.get("/me/task-recommendations/{task_id}", response_model=CatalogRecommendationItemView)
async def task_recommendation_detail(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[TaskCatalogPageService, Depends(_service)],
    task_id: UUID,
) -> CatalogRecommendationItemView:
    from impulse.application.task_catalog_visibility import TaskVisibilityError

    try:
        item = await service.require_visible(authenticated.actor, task_id)
    except TaskVisibilityError as exc:
        raise _safe_not_found(exc) from exc
    return _recommendation_item(item)


@router.get("/me/task-recommendations/{task_id}/terms", response_model=CatalogTermsView)
async def task_recommendation_terms(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[Any, Depends(_terms_service)],
    task_id: UUID,
) -> CatalogTermsView:
    from impulse.application.task_catalog_visibility import TaskVisibilityError

    try:
        terms = await service.terms(authenticated.actor, task_id)
    except TaskVisibilityError as exc:
        raise _safe_not_found(exc) from exc
    return CatalogTermsView(
        task_id=terms.task_id,
        terms_version=terms.terms_version,
        brief_version=terms.brief_version,
        deliverable=terms.deliverable,
        prerequisites=list(terms.prerequisites),
        selection_criteria=list(terms.selection_criteria),
        support_model=terms.support_model,
        ip_terms=terms.ip_terms,
        portfolio_permission=terms.portfolio_permission,
        paid=terms.paid,
        payout_condition=terms.payout_condition,
        deadline_at=terms.deadline_at,
        data_constraints=terms.data_constraints,
    )
