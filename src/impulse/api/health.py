"""Process health endpoints."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class LiveResponse(BaseModel):
    """Stable liveness response."""

    status: Literal["ok"] = "ok"


@router.get("/health/live", response_model=LiveResponse)
async def live() -> LiveResponse:
    """Return success while the process event loop is responsive."""
    return LiveResponse()
