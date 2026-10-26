"""Buddy conversation API with opaque, content-free SSE events."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import AwareDatetime, BaseModel, Field

from impulse.ai.buddy.tools import BuddyToolbox
from impulse.ai.gateway import (
    ModelGatewayError,
    ModelMessage,
    ModelOutputKind,
    ModelPurpose,
    OpenRouterGateway,
)
from impulse.api.errors import ApiError
from impulse.api.v1.identity import csrf_session, current_session
from impulse.application.buddy import (
    BuddyConversationService,
    BuddyMessage,
    BuddySuggestion,
    BuddySuggestionService,
    BuddyThread,
)
from impulse.application.development import DevelopmentService
from impulse.application.growth import GrowthService
from impulse.application.identity import AuthenticatedSession
from impulse.domain.buddy_suggestion import BUDDY_SUGGESTION_VERSION

router = APIRouter(prefix="/agents/buddy", tags=["buddy"])


class ThreadView(BaseModel):
    id: UUID
    status: str
    messages: list[MessageView]
    content_deleted: bool


class MessageView(BaseModel):
    id: UUID
    client_message_id: str
    role: str
    content: str


class MessageRequest(BaseModel):
    client_message_id: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1, max_length=8_000)


class FeedbackRequest(BaseModel):
    rating: int = Field(ge=-1, le=1)


class FeedbackView(BaseModel):
    id: UUID
    rating: int


def _service(request: Request) -> BuddyConversationService:
    return request.app.state.buddy_service


def _thread_view(thread: BuddyThread) -> ThreadView:
    return ThreadView(
        id=thread.id,
        status=thread.status,
        messages=[_message_view(item) for item in thread.messages],
        content_deleted=thread.content_deleted,
    )


def _message_view(message: BuddyMessage) -> MessageView:
    return MessageView(
        id=message.id,
        client_message_id=message.client_message_id,
        role=message.role,
        content=message.content,
    )


class ThreadSummaryView(BaseModel):
    id: UUID
    status: str
    title: str
    updated_at: AwareDatetime | None
    message_count: int


@router.get("/threads", response_model=list[ThreadSummaryView])
async def list_threads(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> list[ThreadSummaryView]:
    threads = await service.list_threads(authenticated.actor)
    results = [
        ThreadSummaryView(
            id=thread.id,
            status=thread.status,
            title=next(
                (msg.content[:52] for msg in thread.messages if msg.role == "user"),
                "Новый диалог",
            ),
            updated_at=thread.messages[-1].created_at if thread.messages else None,
            message_count=len(thread.messages),
        )
        for thread in threads
        if thread.status == "active"
    ]
    return sorted(
        results,
        key=lambda item: item.updated_at.isoformat() if item.updated_at else "",
        reverse=True,
    )


@router.post("/threads/{thread_id}/reply", response_model=ThreadView)
async def reply_to_thread(
    thread_id: UUID,
    body: MessageRequest,
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    """One bounded request to a server-side, free-only OpenRouter model."""
    settings = request.app.state.settings
    profile = await request.app.state.auth_service.participant_profile(authenticated)
    if not profile.buddy_enabled:
        raise ApiError("AI_BUDDY_DISABLED", "AI-Buddy выключен в настройках профиля.", 403)
    if not settings.ai_buddy_enabled or settings.openrouter_api_key is None:
        raise ApiError(
            "MODEL_UNAVAILABLE", "AI-Buddy не подключён. Настройте OpenRouter на сервере.", 503
        )
    thread = await service.thread(authenticated.actor, thread_id)
    if thread.status != "active":
        raise ApiError("THREAD_NOT_ACTIVE", "Диалог закрыт.", 409)
    existing_reply = next(
        (
            message
            for message in thread.messages
            if message.client_message_id == "reply:" + body.client_message_id
        ),
        None,
    )
    if existing_reply is not None:
        return _thread_view(thread)
    recent_messages = [
        message
        for saved in await service.list_threads(authenticated.actor)
        for message in saved.messages
        if message.role == "assistant"
        and message.created_at.astimezone(UTC).date() == datetime.now(UTC).date()
    ]
    if len(recent_messages) >= settings.ai_max_requests_per_user_day:
        raise ApiError("AGENT_BUDGET_EXCEEDED", "Лимит ответов AI-Buddy на сегодня достигнут.", 429)
    if len(thread.messages) > 100:
        raise ApiError("AGENT_BUDGET_EXCEEDED", "Лимит сообщений в диалоге достигнут.", 429)
    user_message = await service.add_message(
        authenticated.actor,
        thread_id,
        client_message_id=body.client_message_id,
        content=body.content,
    )
    toolbox = BuddyToolbox(
        request.app.state.development_service,
        request.app.state.work_service,
        max_items=6,
    )
    roadmap = await toolbox.roadmap(authenticated.actor)
    tasks = await toolbox.own_work(authenticated.actor)
    evidence = [*roadmap, *tasks]
    facts = "\n".join(
        f"[{item.source_ref}] " + "; ".join(item.facts[:7]) for item in evidence[:12]
    )[:6000]
    history = [
        ModelMessage("assistant" if msg.role == "assistant" else "user", msg.content[:1800])
        for msg in thread.messages[-10:]
    ]
    if not any(msg.client_message_id == user_message.client_message_id for msg in thread.messages):
        history.append(ModelMessage("user", body.content))
    system_prompt = (
        "Ты AI-Buddy платформы Impulse, полезный русскоязычный наставник по "
        "программированию и проектам. Давай содержательные, конкретные советы; "
        "объясняй пошагово. Используй только проверяемые факты о пользователе из "
        "КОНТЕКСТА; если их нет — прямо скажи. Никогда не выдумывай завершение "
        "курса, статус задачи, ссылки, документы, оценки или гарантированные награды. "
        "Не принимай решений за ментора. Не раскрывай персональные данные. "
        "Безопасные разделы платформы: /workspace/2 (Bootcamp), /workspace/3 "
        "(задачи), /workspace/8 (аналитика), /workspace/7 (портфолио). "
        "Для переходов называй название раздела, интерфейс отобразит реальные кнопки. "
        "КОНТЕКСТ (только чтение):\n" + (facts or "Данные пока недоступны.")
    )
    gateway = OpenRouterGateway(
        api_key=settings.openrouter_api_key,
        model_id=settings.openrouter_model_buddy,
        policy_version="buddy-chat-v1",
        timeout_seconds=int(settings.ai_timeout_seconds),
        max_tokens=1200,
    )
    try:
        result = await gateway.invoke(
            ModelPurpose.BUDDY,
            (ModelMessage("system", system_prompt), *history),
            correlation_id=str(uuid4()),
        )
    except ModelGatewayError as error:
        raise ApiError(
            "MODEL_UNAVAILABLE", "Модель временно недоступна. Повторите запрос.", 503
        ) from error
    if result.kind is not ModelOutputKind.TEXT or not result.text or not result.text.strip():
        raise ApiError("MODEL_OUTPUT_MALFORMED", "Модель не вернула текстовый ответ.", 502)
    await service.add_assistant_message(
        authenticated.actor,
        thread_id,
        client_message_id="reply:" + body.client_message_id,
        content=result.text[:8000],
    )
    return _thread_view(await service.thread(authenticated.actor, thread_id))


@router.post("/threads", response_model=ThreadView, status_code=201)
async def create_thread(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(await service.create_thread(authenticated.actor))


@router.get("/threads/{thread_id}", response_model=ThreadView)
async def get_thread(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(await service.thread(authenticated.actor, thread_id))


@router.post("/threads/{thread_id}/messages", response_model=MessageView)
async def add_message(
    thread_id: UUID,
    body: MessageRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> MessageView:
    return _message_view(
        await service.add_message(
            authenticated.actor,
            thread_id,
            client_message_id=body.client_message_id,
            content=body.content,
        )
    )


@router.post("/threads/{thread_id}/cancel", response_model=ThreadView)
async def cancel_thread(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> ThreadView:
    return _thread_view(await service.cancel(authenticated.actor, thread_id))


@router.post("/threads/{thread_id}/feedback", response_model=FeedbackView)
async def add_feedback(
    thread_id: UUID,
    body: FeedbackRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> FeedbackView:
    result = await service.feedback(authenticated.actor, thread_id, rating=body.rating)
    return FeedbackView(id=result.id, rating=result.rating)


@router.delete("/memory", status_code=204)
async def withdraw_memory(
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> None:
    await service.withdraw_memory(authenticated.actor)


@router.get("/threads/{thread_id}/events", response_class=StreamingResponse)
async def thread_events(
    thread_id: UUID,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> StreamingResponse:
    thread = await service.thread(authenticated.actor, thread_id)

    async def events() -> AsyncIterator[str]:
        safe = json.dumps({"thread_id": str(thread.id), "status": thread.status})
        yield f"event: status\ndata: {safe}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


class BuddyActionView(BaseModel):
    kind: str
    ref: str
    title: str
    target_kind: str
    target_id: str
    checkpoint_id: str | None
    target_version: int | None
    canonical_path: str
    estimated_minutes: int | None
    deadline_at: AwareDatetime | None
    points: int | None
    points_note: str
    skill_forecast: str
    effect_state: str
    available: bool
    stale_reason: str | None


class BuddySuggestionView(BaseModel):
    kind: str
    version: int
    suggestion_id: str
    generated_at: AwareDatetime
    observation: str
    gap: str
    action: BuddyActionView | None
    benefit: str
    source_categories: list[str]
    explanation: str
    idle_days: int | None
    model_called: bool
    auto_enrolled: bool
    rank_score: str
    partial: bool
    coverage_note: str


class BuddySuggestionStateView(BaseModel):
    policy_version: int
    ai_model_available: bool
    dismissed: bool
    suggestion: BuddySuggestionView | None
    suggestions: list[BuddySuggestionView]


class SuggestionDismissRequest(BaseModel):
    suggestion_id: str = Field(min_length=1, max_length=256)


class SuggestionFeedbackRequest(BaseModel):
    suggestion_id: str = Field(min_length=1, max_length=256)
    action: Literal["dismiss", "snooze", "irrelevant"]
    snooze_until: AwareDatetime | None = None


class SuggestionTargetView(BaseModel):
    suggestion_id: str
    target: BuddyActionView


def _suggestion_service(request: Request) -> BuddySuggestionService:
    development = request.app.state.development_service
    assert isinstance(development, DevelopmentService)
    growth = GrowthService(
        development,
        request.app.state.competency_service,
        request.app.state.work_service,
    )
    return BuddySuggestionService(growth, development, request.app.state.buddy_service)


def _suggestion_view(item: BuddySuggestion) -> BuddySuggestionView:
    return BuddySuggestionView(
        kind=str(item.kind.value),
        version=item.version,
        suggestion_id=item.suggestion_id,
        generated_at=item.generated_at,
        observation=item.observation,
        gap=item.gap,
        action=(
            BuddyActionView(
                kind=item.action.kind,
                ref=item.action.ref,
                title=item.action.title,
                target_kind=item.action.target.kind.value,
                target_id=item.action.target.object_id,
                checkpoint_id=item.action.target.checkpoint_id,
                target_version=item.action.target.version,
                canonical_path=item.action.canonical_path,
                estimated_minutes=item.action.estimated_minutes,
                deadline_at=item.action.deadline_at,
                points=item.action.points,
                points_note=item.action.points_note,
                skill_forecast=item.action.skill_forecast,
                effect_state=item.action.effect_state,
                available=item.action.available,
                stale_reason=item.action.stale_reason,
            )
            if item.action is not None
            else None
        ),
        benefit=item.benefit,
        source_categories=list(item.source_categories),
        explanation=item.explanation,
        idle_days=item.idle_days,
        model_called=item.model_called,
        auto_enrolled=item.auto_enrolled,
        rank_score=item.rank_score,
        partial=item.partial,
        coverage_note=item.coverage_note,
    )


@router.get("/suggestion", response_model=BuddySuggestionStateView)
async def get_suggestion(
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    request: Request,
    service: Annotated[BuddySuggestionService, Depends(_suggestion_service)],
) -> BuddySuggestionStateView:
    """Объяснимая рекомендация главной: только разрешённые данные и no model call."""
    state = await service.state(authenticated.actor)
    settings = getattr(request.app.state, "settings", None)
    ai_available = bool(getattr(settings, "ai_buddy_enabled", False))
    return BuddySuggestionStateView(
        policy_version=BUDDY_SUGGESTION_VERSION,
        ai_model_available=ai_available,
        dismissed=state.dismissed,
        suggestion=(_suggestion_view(state.suggestion) if state.suggestion is not None else None),
        suggestions=[_suggestion_view(item) for item in state.suggestions],
    )


@router.get("/suggestion/target", response_model=SuggestionTargetView)
async def resolve_suggestion_target(
    suggestion_id: str,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    service: Annotated[BuddySuggestionService, Depends(_suggestion_service)],
) -> SuggestionTargetView:
    """Stale/RBAC recheck immediately before the browser follows a deep link."""
    suggestion = await service.resolve(authenticated.actor, suggestion_id)
    if suggestion.action is None:
        raise ValueError("Suggestion has no navigation target")
    action = _suggestion_view(suggestion).action
    assert action is not None
    return SuggestionTargetView(
        suggestion_id=suggestion.suggestion_id,
        target=action,
    )


@router.post("/suggestion/feedback", status_code=204)
async def suggestion_feedback(
    body: SuggestionFeedbackRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddySuggestionService, Depends(_suggestion_service)],
) -> None:
    await service.feedback(
        authenticated.actor,
        body.suggestion_id,
        action=body.action,
        snooze_until=body.snooze_until,
    )


@router.post("/suggestion/dismiss", status_code=204)
async def dismiss_suggestion(
    body: SuggestionDismissRequest,
    authenticated: Annotated[AuthenticatedSession, Depends(csrf_session)],
    service: Annotated[BuddyConversationService, Depends(_service)],
) -> None:
    await service.dismiss_suggestion(authenticated.actor, body.suggestion_id)
