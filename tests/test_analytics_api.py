"""Participant funnel and earnings acceptance scenarios."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client() -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                session_secret=SecretStr("analytics-test-secret-long-enough"),
            )
        )
    )


def login(api: TestClient, persona: str) -> None:
    assert api.post("/api/v1/auth/demo-login", json={"persona_key": persona}).status_code == 200


def test_incomplete_participant_journey_is_not_success() -> None:
    api = client()
    login(api, "participant-alex")
    response = api.get("/api/v1/me/analytics/journey")
    assert response.status_code == 200
    body = response.json()
    assert body["stages"][0]["completed"] is True
    assert body["stages"][-1]["completed"] is False
    assert body["successful"] is False
    assert body["next_action"]
    assert body["freshness"] == "fresh"
    assert body["generated_at"]


def test_earnings_states_are_not_presented_as_paid() -> None:
    api = client()
    login(api, "participant-alex")
    earnings = api.get("/api/v1/me/analytics/journey").json()["earnings"]
    assert set(earnings) == {
        "calculated",
        "approved",
        "paid",
        "failed",
        "currency",
        "unknown_items",
    }
    assert earnings["paid"] == "0"


def test_other_role_cannot_read_participant_analytics() -> None:
    api = client()
    login(api, "hr-nina")
    assert api.get("/api/v1/me/analytics/journey").status_code == 404
