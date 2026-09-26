"""FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from impulse.api.errors import install_error_handlers
from impulse.api.health import router as health_router
from impulse.api.request_context import RequestContextMiddleware
from impulse.api.v1 import router as api_v1_router
from impulse.bootstrap.logging import configure_logging
from impulse.bootstrap.settings import Settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    """Own process-level resources once dependencies are introduced."""
    yield


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the HTTP application without import-time side effects."""
    runtime_settings = settings or Settings()
    configure_logging()
    app = FastAPI(
        title="Impulse API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = runtime_settings
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_v1_router)
    return app
