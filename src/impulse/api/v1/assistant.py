"""Customer assistant API: editable AI brief drafts with explicit data-class gates."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.ai.gateway import ModelGatewayError
from impulse.ai.guardrails import DataClass
from impulse.ai.prompts import CustomerBriefSuggestion
from impulse.ai.suggestions import Suggestion, SuggestionService
from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter()

MANUAL_TEMPLATE_NOTICE = "Заполните ручной шаблон: проблема, результат, критерии приёмки."

ALLOWED_BRIEF_CLASSES: frozenset[DataClass] = frozenset(
    {DataClass.PUBLIC, DataClass.DEMO_SYNTHETIC}
)


class BriefDraftRequest(BaseModel):
    brief: str = Field(min_length=1, max_length=4_000)
    data_class: DataClass
    correlation_id: str = Field(min_length=1, max_length=128)


class BriefDraftView(BaseModel):
    kind: str
    editable: Literal[True] = True
    problem: str | None = None
    deliverable: str | None = None
    acceptance_criteria: list[str] = Field(default_factory=list)
    disclaimer: str | None = None
    gateway_called: bool
    notice: str


def _manual_template(gateway_called: bool = False) -> BriefDraftView:
    return BriefDraftView(
        kind="manual_template",
        gateway_called=gateway_called,
        notice=MANUAL_TEMPLATE_NOTICE,
    )


def _suggestion_view(suggestion: Suggestion) -> BriefDraftView:
    payload = suggestion.payload
    if not isinstance(payload, CustomerBriefSuggestion):
        raise ApiError("ASSISTANT_UNAVAILABLE", "Assistant returned an unexpected draft.", 503)
    return BriefDraftView(
        kind=suggestion.kind,
        problem=payload.problem,
        deliverable=payload.deliverable,
        acceptance_criteria=list(payload.acceptance_criteria),
        disclaimer=payload.disclaimer,
        gateway_called=True,
        notice="Черновик от AI можно редактировать; публикация возможна только человеком.",
    )


def _service(request: Request) -> SuggestionService | None:
    return getattr(request.app.state, "ai_suggestion_service", None)


@router.post("/me/assistant/customer-brief", response_model=BriefDraftView)
async def customer_brief_draft(
    command: BriefDraftRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
) -> BriefDraftView:
    if authenticated.actor.active_role is not Role.CUSTOMER:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    settings = request.app.state.settings
    service = _service(request)
    if (
        service is None
        or not settings.ai_customer_brief_enabled
        or command.data_class not in ALLOWED_BRIEF_CLASSES
    ):
        return _manual_template()
    try:
        suggestion = await service.customer_brief(
            command.brief,
            command.data_class,
            correlation_id=command.correlation_id,
        )
    except ModelGatewayError as error:
        raise ApiError("ASSISTANT_UNAVAILABLE", "AI-помощник недоступен.", 503) from error
    if isinstance(suggestion, Suggestion):
        return _suggestion_view(suggestion)
    return BriefDraftView(
        kind="manual_template",
        gateway_called=False,
        notice=str(suggestion),
    )
