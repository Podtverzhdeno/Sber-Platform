"""Process health endpoints, including operator-only AI diagnostics."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel

from impulse.ai.gateway import ModelRegistry
from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter(tags=["health"])


class LiveResponse(BaseModel):
    """Stable liveness response."""

    status: Literal["ok"] = "ok"


class AiModelDiagnostic(BaseModel):
    model_id: str
    available: bool
    free: bool
    capabilities: list[str]


class AiHealthResponse(BaseModel):
    status: Literal["disabled", "ready", "degraded"]
    features: dict[str, bool]
    models: list[AiModelDiagnostic]


@router.get("/health/live", response_model=LiveResponse)
async def live() -> LiveResponse:
    """Return success while the process event loop is responsive."""
    return LiveResponse()


@router.get("/health/ready", response_model=LiveResponse, include_in_schema=False)
async def ready(request: Request, response: Response) -> LiveResponse:
    """Report readiness only when the configured database accepts queries."""
    database = request.app.state.database
    if database is not None and not await database.ready():
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return LiveResponse()


@router.get("/health/ai", response_model=AiHealthResponse, include_in_schema=False)
async def ai_health(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> AiHealthResponse:
    """Expose only feature state and catalog metadata to an operator/admin."""
    if authenticated.actor.active_role not in {Role.OPERATOR, Role.ACCESS_ADMIN}:
        raise ApiError("PERMISSION_DENIED", "AI diagnostics require operator access.", 403)
    settings = request.app.state.settings
    features = {
        "buddy": settings.ai_buddy_enabled,
        "mentor_review": settings.ai_mentor_draft_enabled,
        "operator_triage": settings.ai_operator_triage_enabled,
        "customer_brief": settings.ai_customer_brief_enabled,
    }
    registry: ModelRegistry | None = request.app.state.ai_registry
    models = []
    if registry is not None:
        models = [
            AiModelDiagnostic(
                model_id=item.model_id,
                available=item.available,
                free=item.is_free,
                capabilities=sorted(capability.value for capability in item.capabilities),
            )
            for item in registry.diagnostics()
        ]
    if not any(features.values()):
        diagnostic_status: Literal["disabled", "ready", "degraded"] = "disabled"
    elif models and any(item.available and item.free for item in models):
        diagnostic_status = "ready"
    else:
        diagnostic_status = "degraded"
    return AiHealthResponse(status=diagnostic_status, features=features, models=models)
