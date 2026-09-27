"""FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from impulse.api.errors import install_error_handlers
from impulse.api.health import router as health_router
from impulse.api.request_context import RequestContextMiddleware
from impulse.api.v1 import router as api_v1_router
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.logging import configure_logging
from impulse.bootstrap.settings import Settings
from impulse.infrastructure.database import Database
from impulse.infrastructure.identity_store import SqlIdentityStore


def create_app(
    settings: Settings | None = None,
    *,
    auth_service: DemoAuthService | None = None,
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
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_v1_router)
    return app
