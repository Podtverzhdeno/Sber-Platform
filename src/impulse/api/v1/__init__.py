"""Version 1 public API."""

from fastapi import APIRouter, Request

from impulse.api.v1.analytics import router as analytics_router
from impulse.api.v1.assistant import router as assistant_router
from impulse.api.v1.buddy import router as buddy_router
from impulse.api.v1.competencies import router as competencies_router
from impulse.api.v1.development import router as development_router
from impulse.api.v1.ecosystem import router as ecosystem_router
from impulse.api.v1.growth import router as growth_router
from impulse.api.v1.identity import router as identity_router
from impulse.api.v1.messaging import router as messaging_router
from impulse.api.v1.notifications import router as notifications_router
from impulse.api.v1.operations import router as operations_router
from impulse.api.v1.portfolio import router as portfolio_router
from impulse.api.v1.recognition import router as recognition_router
from impulse.api.v1.reward import router as reward_router
from impulse.api.v1.search import router as search_router
from impulse.api.v1.work import router as work_router
from impulse.bootstrap.settings import Settings

router = APIRouter(prefix="/api/v1")
router.include_router(analytics_router)
router.include_router(assistant_router)
router.include_router(buddy_router)
router.include_router(competencies_router)
router.include_router(development_router)
router.include_router(growth_router)
router.include_router(ecosystem_router)
router.include_router(identity_router)
router.include_router(messaging_router)
router.include_router(notifications_router)
router.include_router(operations_router)
router.include_router(portfolio_router)
router.include_router(recognition_router)
router.include_router(reward_router)
router.include_router(search_router)
router.include_router(work_router)


@router.get("/config", response_model=dict[str, bool | str])
async def public_config(request: Request) -> dict[str, bool | str]:
    settings: Settings = request.app.state.settings
    return settings.public_flags()
