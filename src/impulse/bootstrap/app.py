"""FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from impulse.api.errors import install_error_handlers
from impulse.api.health import router as health_router
from impulse.api.request_context import RequestContextMiddleware
from impulse.api.v1 import router as api_v1_router
from impulse.application.development import DevelopmentService, MemoryDevelopmentStore
from impulse.application.ecosystem import EcosystemService, MemoryEcosystemStore
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.operations import MemoryOperationsStore, OperationsService
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.application.reward import (
    MemoryRewardStore,
    RewardService,
    WorkReviewEvidenceProvider,
)
from impulse.application.talent import MemoryTalentStore, TalentService
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.logging import configure_logging
from impulse.bootstrap.settings import Settings
from impulse.bootstrap.static import SinglePageApplication
from impulse.infrastructure.database import Database
from impulse.infrastructure.development_store import SqlDevelopmentStore
from impulse.infrastructure.ecosystem_store import SqlEcosystemStore
from impulse.infrastructure.identity_store import SqlIdentityStore
from impulse.infrastructure.operations_store import SqlOperationsStore
from impulse.infrastructure.recognition_store import SqlRecognitionStore
from impulse.infrastructure.reward_store import SqlRewardStore
from impulse.infrastructure.talent_store import SqlTalentStore
from impulse.infrastructure.work_store import SqlWorkStore


def create_app(
    settings: Settings | None = None,
    *,
    auth_service: DemoAuthService | None = None,
    development_service: DevelopmentService | None = None,
    ecosystem_service: EcosystemService | None = None,
    work_service: WorkService | None = None,
    reward_service: RewardService | None = None,
    recognition_service: RecognitionService | None = None,
    talent_service: TalentService | None = None,
    operations_service: OperationsService | None = None,
) -> FastAPI:
    """Build the HTTP application without import-time side effects."""
    runtime_settings = settings or Settings()
    configure_logging()
    owned_database: Database | None = None
    if auth_service is None:
        if runtime_settings.database_url is None:
            identity_store = MemoryIdentityStore(demo_personas())
        else:
            owned_database = Database(runtime_settings.database_url.get_secret_value())
            identity_store = SqlIdentityStore(owned_database)
        auth_service = DemoAuthService(
            identity_store,
            secret=runtime_settings.session_signing_secret(),
            ttl_seconds=runtime_settings.session_ttl_seconds,
        )
    if development_service is None:
        development_store = (
            SqlDevelopmentStore(owned_database)
            if owned_database is not None
            else MemoryDevelopmentStore()
        )
        development_service = DevelopmentService(development_store)
    if ecosystem_service is None:
        ecosystem_store = (
            SqlEcosystemStore(owned_database)
            if owned_database is not None
            else MemoryEcosystemStore(
                people={f"demo:{item.key}": item.person_id for item in demo_personas()}
            )
        )
        ecosystem_service = EcosystemService(ecosystem_store)
    if work_service is None:
        work_store = (
            SqlWorkStore(owned_database) if owned_database is not None else MemoryWorkStore()
        )
        work_service = WorkService(work_store)
    work_service.consent_store = auth_service.store
    if reward_service is None:
        reward_store = (
            SqlRewardStore(owned_database) if owned_database is not None else MemoryRewardStore()
        )
        reward_service = RewardService(
            reward_store,
            WorkReviewEvidenceProvider(work_service.store),
            work_service.store,
        )
    if recognition_service is None:
        recognition_store = (
            SqlRecognitionStore(owned_database)
            if owned_database is not None
            else MemoryRecognitionStore()
        )
        recognition_service = RecognitionService(recognition_store)
    if talent_service is None:
        talent_store = (
            SqlTalentStore(owned_database) if owned_database is not None else MemoryTalentStore()
        )
        talent_service = TalentService(talent_store)
    if operations_service is None:
        operations_store = (
            SqlOperationsStore(owned_database)
            if owned_database is not None
            else MemoryOperationsStore()
        )
        operations_service = OperationsService(operations_store)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        try:
            yield
        finally:
            if owned_database is not None:
                await owned_database.close()

    app = FastAPI(
        title="Impulse API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = runtime_settings
    app.state.database = owned_database
    app.state.auth_service = auth_service
    app.state.development_service = development_service
    app.state.ecosystem_service = ecosystem_service
    app.state.work_service = work_service
    app.state.reward_service = reward_service
    app.state.recognition_service = recognition_service
    app.state.talent_service = talent_service
    app.state.operations_service = operations_service
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_v1_router)
    frontend_directory = Path("frontend/dist")
    if frontend_directory.is_dir():
        app.mount(
            "/",
            SinglePageApplication(directory=frontend_directory, html=True),
            name="frontend",
        )
    return app
