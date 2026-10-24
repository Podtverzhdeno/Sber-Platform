"""Read-only participant Agentic Coding target and qualified evidence view."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request

from impulse.agentic_coding import QualifiedEvidence, RoleProfile, evaluate_profile
from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter(tags=["agentic-coding"])


@router.get("/me/agentic-coding/profile", response_model=RoleProfile)
async def agentic_coding_profile(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
    role_key: Annotated[Literal["developer", "analyst", "qa"], Query()] = "developer",
) -> RoleProfile:
    if authenticated.actor.active_role is not Role.PARTICIPANT:
        raise ApiError(code="NOT_FOUND", message="Профиль не найден.", status_code=404)
    # No trusted source integration yet. Never promote generic course completions
    # or demo competence into Agentic levels. A verified owner may attach a
    # read-only qualified source only after authorization, audit and publication.
    evidence = getattr(request.app.state, "agentic_qualified_evidence", ())
    if not isinstance(evidence, tuple) or not all(
        isinstance(row, QualifiedEvidence) for row in evidence
    ):
        raise ApiError(
            code="AGENTIC_SOURCE_UNAVAILABLE",
            message="Источник проверенных данных временно недоступен.",
            status_code=503,
            retryable=True,
        )
    return evaluate_profile(authenticated.actor.person_id, role_key, evidence)
