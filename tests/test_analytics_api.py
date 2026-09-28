"""Participant funnel and earnings acceptance scenarios."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.analytics import ratio_metric
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


def test_ratio_formula_and_zero_denominator_are_explicit() -> None:
    end = datetime.now(UTC)
    metric = ratio_metric(
        key="fixture",
        label="Fixture",
        numerator=2,
        denominator=5,
        period_start=end - timedelta(days=30),
        period_end=end,
        cohort="test",
        definition="2 / 5",
    )
    assert str(metric.value) == "40.00"
    unknown = ratio_metric(
        key="empty",
        label="Empty",
        numerator=0,
        denominator=0,
        period_start=end - timedelta(days=30),
        period_end=end,
        cohort="test",
        definition="0 / 0",
    )
    assert unknown.value is None


def test_each_mvp_staff_role_gets_defined_metrics() -> None:
    api = client()
    for persona, role in (
        ("mentor-elena", "mentor"),
        ("customer-roman", "customer"),
        ("manager-olga", "manager"),
        ("hr-nina", "hr"),
        ("operator-pavel", "operator"),
    ):
        login(api, persona)
        response = api.get("/api/v1/analytics/role")
        assert response.status_code == 200
        assert response.json()["role"] == role
        for metric in response.json()["metrics"]:
            assert metric["numerator"] >= 0
            assert metric["denominator"] >= 0
            assert metric["period_start"] < metric["period_end"]
            assert metric["cohort"].endswith(f":{role}:30d")
            assert metric["definition"]
            assert metric["freshness"] == "fresh"


def test_hr_empty_funnel_is_unknown_not_zero_success() -> None:
    api = client()
    login(api, "hr-nina")
    metrics = {item["key"]: item for item in api.get("/api/v1/analytics/role").json()["metrics"]}
    assert metrics["hr_hire_rate"]["denominator"] == 0
    assert metrics["hr_hire_rate"]["value"] is None
