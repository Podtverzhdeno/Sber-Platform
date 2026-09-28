"""Process health endpoints."""

from typing import Literal

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class LiveResponse(BaseModel):
    """Stable liveness response."""

    status: Literal["ok"] = "ok"


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
