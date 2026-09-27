"""Version 1 public API."""

from fastapi import APIRouter, Request

from impulse.api.v1.development import router as development_router
from impulse.api.v1.ecosystem import router as ecosystem_router
from impulse.api.v1.identity import router as identity_router
from impulse.bootstrap.settings import Settings

router = APIRouter(prefix="/api/v1")
router.include_router(development_router)
router.include_router(ecosystem_router)
router.include_router(identity_router)


@router.get("/config", response_model=dict[str, bool | str])
async def public_config(request: Request) -> dict[str, bool | str]:
    settings: Settings = request.app.state.settings
    return settings.public_flags()
