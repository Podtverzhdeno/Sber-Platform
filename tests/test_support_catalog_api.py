"""Contract tests for the explainable support-model catalog (openspec 23.1)."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def _client() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("support-catalog-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(create_app(settings, auth_service=auth))


def test_support_catalog_requires_authentication() -> None:
    client = _client()
    response = client.get("/api/v1/customer/support-models")
    assert response.status_code == 401


def test_support_catalog_is_versioned_explainable_and_marks_unavailable_options() -> None:
    client = _client()
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "customer-roman"})
    assert login.status_code == 200
    response = client.get("/api/v1/customer/support-models")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == 1
    assert [item["code"] for item in payload["models"]] == [
        "platform",
        "assigned_mentor",
        "expert_consultations",
        "customer_self",
    ]
    for item in payload["models"]:
        assert item["responsible"]
        assert item["activities"]
        assert item["response_time"]
        assert item["restrictions"]
    expert = payload["models"][2]
    assert expert["available"] is False
    assert expert["unavailable_reason"]
    mentor = payload["models"][1]
    assert mentor["requires_assignee"] is True
    platform = payload["models"][0]
    assert "Не заменяет предметного ментора" in platform["restrictions"]
    assert "Не принимает результат за заказчика" in platform["restrictions"]
