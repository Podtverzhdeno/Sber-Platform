"""Stable API errors that never expose implementation details."""

from __future__ import annotations

from typing import Any, cast

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ExceptionHandler

from impulse.api.request_context import get_request_id
from impulse.application.errors import ApiError

logger = structlog.get_logger(__name__)

_HTTP_CODE_BY_STATUS: dict[int, str] = {
    400: "INVALID_REQUEST",
    401: "AUTH_REQUIRED",
    403: "PERMISSION_DENIED",
    404: "RESOURCE_NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMITED",
}


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    field_errors: dict[str, list[str]] | None = None
    request_id: str
    retryable: bool = False


def _response(error: ErrorEnvelope, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error.model_dump(exclude_none=True))


def error_for_exception(
    request: Request,
    exc: StarletteHTTPException | ApiError,
) -> JSONResponse:
    """Build the stable envelope for either error kind."""
    if isinstance(exc, StarletteHTTPException):
        status_code = exc.status_code
        return _response(
            ErrorEnvelope(
                code=_HTTP_CODE_BY_STATUS.get(status_code, "HTTP_ERROR"),
                message="Запрошенный ресурс недоступен." if status_code == 404 else str(exc.detail),
                request_id=get_request_id(),
                retryable=False,
            ),
            status_code,
        )
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


def install_error_handlers(app: FastAPI) -> None:
    async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
        return error_for_exception(_request, exc)

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

    app.add_exception_handler(ApiError, cast(ExceptionHandler, api_error_handler))
    app.add_exception_handler(StarletteHTTPException, cast(ExceptionHandler, error_for_exception))
    app.add_exception_handler(Exception, unexpected_error_handler)


def error_openapi_examples() -> dict[str, Any]:
    return {"model": ErrorEnvelope, "description": "Stable error envelope"}
