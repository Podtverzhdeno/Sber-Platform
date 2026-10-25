"""Characterization tests for the application/API exception boundary."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from impulse.api.errors import ApiError as TransportApiError
from impulse.api.errors import install_error_handlers
from impulse.api.request_context import RequestContextMiddleware
from impulse.application.errors import ApiError as ApplicationApiError


def _client(error: ApplicationApiError) -> TestClient:
    app = FastAPI()
    install_error_handlers(app)
    app.add_middleware(RequestContextMiddleware)

    @app.get("/fail")
    async def fail() -> None:
        raise error

    return TestClient(app)


def test_exception_identity_and_legacy_constructor_are_preserved() -> None:
    assert ApplicationApiError is TransportApiError
    error = ApplicationApiError(
        code="TERMS_CHANGED",
        message="Условия изменились",
        status_code=409,
        field_errors={"terms_version": ["Refresh required"]},
    )
    assert str(error) == "Условия изменились"
    assert error.args == ("Условия изменились",)
    assert error.status_code == 409


def test_framework_free_application_error_keeps_stable_http_envelope() -> None:
    client = _client(ApplicationApiError("TERMS_CHANGED", "Условия изменились", 409))
    response = client.get("/fail", headers={"x-request-id": "architecture-test-001"})
    assert response.status_code == 409
    assert response.json() == {
        "code": "TERMS_CHANGED",
        "message": "Условия изменились",
        "request_id": "architecture-test-001",
        "retryable": False,
    }
    assert response.headers["x-request-id"] == "architecture-test-001"


def test_non_disclosing_not_found_and_retryable_error_remain_compatible() -> None:
    for status_code, code, retryable in (
        (404, "RESOURCE_NOT_FOUND", False),
        (503, "SERVICE_UNAVAILABLE", True),
    ):
        response = _client(
            ApplicationApiError(code, "Запрошенный ресурс недоступен.", status_code, retryable)
        ).get("/fail")
        assert response.status_code == status_code
        assert response.json()["code"] == code
        assert response.json()["retryable"] is retryable
        assert response.json()["message"] == "Запрошенный ресурс недоступен."
