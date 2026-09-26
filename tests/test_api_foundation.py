"""Request context, errors and redaction tests."""

from typing import Any

from fastapi.testclient import TestClient

from impulse.api.errors import ApiError
from impulse.bootstrap.app import create_app
from impulse.bootstrap.logging import REDACTED, redact_processor


def test_request_id_is_preserved_when_safe() -> None:
    client = TestClient(create_app())
    response = client.get("/health/live", headers={"X-Request-ID": "request-12345678"})

    assert response.headers["X-Request-ID"] == "request-12345678"


def test_invalid_request_id_is_replaced() -> None:
    client = TestClient(create_app())
    response = client.get("/health/live", headers={"X-Request-ID": "bad value\n"})

    assert response.status_code == 200
    assert len(response.headers["X-Request-ID"]) == 32


def test_api_error_uses_stable_envelope() -> None:
    app = create_app()

    @app.get("/expected-error")
    async def expected_error() -> None:
        raise ApiError(code="CONFLICT", message="Conflict", status_code=409)

    response = TestClient(app).get("/expected-error")

    assert response.status_code == 409
    assert response.json() == {
        "code": "CONFLICT",
        "message": "Conflict",
        "request_id": response.headers["X-Request-ID"],
        "retryable": False,
    }


def test_unexpected_error_exposes_no_stack_or_secret() -> None:
    app = create_app()

    @app.get("/unexpected-error")
    async def unexpected_error() -> None:
        raise RuntimeError("database failed with sk-or-v1-" + "q" * 32)

    response = TestClient(app, raise_server_exceptions=False).get("/unexpected-error")
    body = response.text

    assert response.status_code == 500
    assert "RuntimeError" not in body
    assert "sk-or-v1" not in body
    assert "traceback" not in body.lower()


def test_logging_processor_redacts_nested_values() -> None:
    event: dict[str, Any] = {
        "event": "provider_error",
        "authorization": "Bearer synthetic",
        "details": {"message": "bad sk-or-v1-" + "x" * 32},
    }

    redacted = redact_processor(None, "error", event)

    assert redacted["authorization"] == REDACTED
    assert "sk-or-v1" not in repr(redacted)
