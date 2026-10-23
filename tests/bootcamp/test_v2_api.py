from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def app_client() -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                session_secret=SecretStr("test-session-secret-with-at-least-32-characters"),
            )
        )
    )


def login(client: TestClient, persona: str = "participant-alex") -> None:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200


def test_v2_routes_are_typed_in_openapi() -> None:
    with app_client() as client:
        schema = client.get("/openapi.json").json()
    assert "/api/v1/me/bootcamp/overview" in schema["paths"]
    assert "/api/v1/me/bootcamp/courses/{course_key}" in schema["paths"]
    assert "/api/v1/me/bootcamp/courses/{course_key}/{action}" in schema["paths"]
    schemas = schema["components"]["schemas"]
    assert "BootcampOverviewV2" in schemas
    assert "CourseDetail" in schemas
    assert "LearningCommandResult" in schemas
    command = schema["paths"]["/api/v1/me/bootcamp/courses/{course_key}/{action}"]["post"]
    header = next(item for item in command["parameters"] if item["in"] == "header")
    assert header["name"] == "Idempotency-Key"
    assert header["required"] is True


def test_v2_read_provider_fails_closed_without_fixture_fallback() -> None:
    with app_client() as client:
        login(client)
        response = client.get("/api/v1/me/bootcamp/overview")
    assert response.status_code == 503
    assert response.json()["code"] == "BOOTCAMP_PROVIDER_UNAVAILABLE"
    assert response.json()["retryable"] is True


def test_v2_command_provider_fails_closed() -> None:
    with app_client() as client:
        login(client)
        response = client.post(
            "/api/v1/me/bootcamp/courses/openspec-sdd/start",
            json={"course_version": "v1"},
            headers={"Idempotency-Key": "request-1"},
        )
    assert response.status_code == 503
    assert response.json()["code"] == "BOOTCAMP_COMMANDS_UNAVAILABLE"


def test_v2_routes_require_session() -> None:
    with app_client() as client:
        assert client.get("/api/v1/me/bootcamp/overview").status_code == 401
        assert client.get("/api/v1/me/bootcamp/courses/openspec-sdd").status_code == 401
