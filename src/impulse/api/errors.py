"""Stable API errors that never expose implementation details."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from impulse.api.request_context import get_request_id

logger = structlog.get_logger(__name__)


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    field_errors: dict[str, list[str]] | None = None
    request_id: str
    retryable: bool = False


@dataclass(slots=True)
class ApiError(Exception):
    code: str
    message: str
    status_code: int
    retryable: bool = False
    field_errors: dict[str, list[str]] | None = field(default=None)

    def __post_init__(self) -> None:
        # Zero-argument super() is unreliable in slotted dataclasses on Python 3.13:
        # dataclass may replace the class object while the generated closure still
        # points at the original one. Call the stable base explicitly.
        Exception.__init__(self, self.message)


def _response(error: ErrorEnvelope, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error.model_dump(exclude_none=True))


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
        return _response(
            ErrorEnvelope(
                code=exc.code,
                message=exc.message,
                field_errors=exc.field_errors,
                request_id=get_request_id(),
                retryable=exc.retryable,
            ),
            exc.status_code,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        await logger.aerror(
            "unhandled_request_error",
            request_id=get_request_id(),
            route=request.url.path,
            error_type=type(exc).__name__,
        )
        return _response(
            ErrorEnvelope(
                code="INTERNAL_ERROR",
                message="Внутренняя ошибка. Повторите попытку позже.",
                request_id=get_request_id(),
                retryable=True,
            ),
            500,
        )


def error_openapi_examples() -> dict[str, Any]:
    return {"model": ErrorEnvelope, "description": "Stable error envelope"}
