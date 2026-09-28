"""Version 1 public API."""

from fastapi import APIRouter, Request

from impulse.api.v1.development import router as development_router
from impulse.api.v1.ecosystem import router as ecosystem_router
from impulse.api.v1.identity import router as identity_router
from impulse.api.v1.operations import router as operations_router
from impulse.api.v1.portfolio import router as portfolio_router
from impulse.api.v1.recognition import router as recognition_router
from impulse.api.v1.reward import router as reward_router
from impulse.api.v1.work import router as work_router
from impulse.bootstrap.settings import Settings

router = APIRouter(prefix="/api/v1")
router.include_router(development_router)
router.include_router(ecosystem_router)
router.include_router(identity_router)
router.include_router(operations_router)
router.include_router(portfolio_router)
router.include_router(recognition_router)
router.include_router(reward_router)
router.include_router(work_router)


@router.get("/config", response_model=dict[str, bool | str])
async def public_config(request: Request) -> dict[str, bool | str]:
    settings: Settings = request.app.state.settings
    return settings.public_flags()
