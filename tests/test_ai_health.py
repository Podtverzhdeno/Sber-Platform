"""Authentication and redaction contract for AI diagnostics."""

from fastapi.testclient import TestClient

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def _client() -> TestClient:
    return TestClient(SettingsClient.app())


class SettingsClient:
    @staticmethod
    def app():
        return create_app(Settings(app_env=AppEnvironment.TEST, demo_mode=True))


def test_ai_health_requires_authentication_and_operator_role() -> None:
    with _client() as client:
        assert client.get("/health/ai").status_code == 401
        client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert client.get("/health/ai").status_code == 403


def test_ai_health_is_secret_and_content_safe() -> None:
    with _client() as client:
        login = client.post("/api/v1/auth/demo-login", json={"persona_key": "operator-pavel"})
        assert login.status_code == 200
        response = client.get("/health/ai")
        assert response.status_code == 200
        assert response.json()["status"] == "disabled"
        serialized = response.text.lower()
        assert "key" not in serialized
        assert "content" not in serialized
