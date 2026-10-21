"""Customer assistant API: editable AI brief drafts with explicit data-class gates."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from impulse.ai.gateway import ModelErrorCode, ModelGatewayError
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

BriefField = Literal["problem", "deliverable", "criterion"]


def _empty_fields() -> dict[BriefField, str]:
    return {}


def _empty_patches() -> list[BriefPatchView]:
    return []


class BriefDraftRequest(BaseModel):
    brief: str = Field(min_length=1, max_length=4_000)
    data_class: DataClass
    correlation_id: str = Field(min_length=1, max_length=128)
    draft_version: int = Field(default=1, ge=1)
    fields: dict[BriefField, str] = Field(default_factory=_empty_fields)


class BriefPatchView(BaseModel):
    target_field: BriefField
    before: str
    field_version: int
    proposed_text: str
    reason: str
    source_version: str
    prompt_version: str


class BriefDraftView(BaseModel):
    kind: str
    editable: Literal[True] = True
    problem: str | None = None
    deliverable: str | None = None
    acceptance_criteria: list[str] = Field(default_factory=list)
    disclaimer: str | None = None
    gateway_called: bool
    notice: str
    suggestion_id: str | None = None
    draft_version: int = 1
    source_version: str = "customer-brief-v1"
    prompt_version: str = "customer-brief-prompt-v1"
    patches: list[BriefPatchView] = Field(default_factory=_empty_patches)


def _manual_template(gateway_called: bool = False, *, draft_version: int = 1) -> BriefDraftView:
    return BriefDraftView(
        kind="manual_template",
        gateway_called=gateway_called,
        notice=MANUAL_TEMPLATE_NOTICE,
        draft_version=draft_version,
    )


def _suggestion_view(suggestion: Suggestion, command: BriefDraftRequest) -> BriefDraftView:
    payload = suggestion.payload
    if not isinstance(payload, CustomerBriefSuggestion):
        raise ApiError("ASSISTANT_UNAVAILABLE", "Assistant returned an unexpected draft.", 503)
    proposed: dict[BriefField, str] = {
        "problem": payload.problem,
        "deliverable": payload.deliverable,
        "criterion": "\n".join(payload.acceptance_criteria),
    }
    reasons: dict[BriefField, str] = {
        "problem": "Уточнить проблему и целевую аудиторию решения.",
        "deliverable": "Зафиксировать проверяемый формат результата.",
        "criterion": "Добавить измеримые условия приёмки.",
    }
    patches: list[BriefPatchView] = [
        BriefPatchView(
            target_field=target,
            before=command.fields.get(target, ""),
            field_version=command.draft_version,
            proposed_text=text,
            reason=reasons[target],
            source_version="customer-brief-v1",
            prompt_version="customer-brief-prompt-v1",
        )
        for target, text in proposed.items()
        if text.strip()
    ]
    return BriefDraftView(
        kind=suggestion.kind,
        problem=payload.problem,
        deliverable=payload.deliverable,
        acceptance_criteria=list(payload.acceptance_criteria),
        disclaimer=payload.disclaimer,
        gateway_called=True,
        notice="Черновик от AI можно редактировать; публикация возможна только человеком.",
        suggestion_id=str(suggestion.id),
        draft_version=command.draft_version,
        patches=patches,
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
        return _manual_template(draft_version=command.draft_version)
    try:
        suggestion = await service.customer_brief(
            command.brief,
            command.data_class,
            correlation_id=command.correlation_id,
        )
    except ModelGatewayError as error:
        if error.code in {
            ModelErrorCode.MODEL_RATE_LIMITED,
            ModelErrorCode.AGENT_BUDGET_EXCEEDED,
        }:
            raise ApiError(
                "ASSISTANT_QUOTA_EXCEEDED",
                "Лимит AI-помощника исчерпан.",
                429,
                retryable=error.retryable,
            ) from error
        if error.code is ModelErrorCode.MODEL_TIMEOUT:
            raise ApiError(
                "ASSISTANT_TIMEOUT",
                "AI-помощник не успел ответить.",
                503,
                retryable=True,
            ) from error
        raise ApiError(
            "ASSISTANT_UNAVAILABLE",
            "AI-помощник недоступен.",
            503,
            retryable=error.retryable,
        ) from error
    if isinstance(suggestion, Suggestion):
        return _suggestion_view(suggestion, command)
    return BriefDraftView(
        kind="manual_template",
        gateway_called=False,
        notice=str(suggestion),
        draft_version=command.draft_version,
    )
