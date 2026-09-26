"""Version 1 public API."""

from fastapi import APIRouter, Request

from impulse.bootstrap.settings import Settings

router = APIRouter(prefix="/api/v1")


@router.get("/config", response_model=dict[str, bool | str])
async def public_config(request: Request) -> dict[str, bool | str]:
    settings: Settings = request.app.state.settings
    return settings.public_flags()
