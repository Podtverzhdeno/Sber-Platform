"""Participant funnel and earnings acceptance scenarios."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.analytics import ratio_metric, visible_personal_rows
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client() -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                database_url=None,
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
    assert metrics["hr_hire_rate"]["suppressed"] is True
    assert metrics["hr_hire_rate"]["suppression_reason"] == "cohort_below_5"


def test_pilot_funnel_is_unknown_without_selection_pairs_or_baseline() -> None:
    api = client()
    login(api, "hr-nina")
    metrics = {item["key"]: item for item in api.get("/api/v1/analytics/role").json()["metrics"]}
    assert metrics["pilot_leader_interest"]["value"] == "0"
    assert metrics["pilot_selection_hours"]["value"] is None
    assert metrics["pilot_selection_hours"]["suppressed"] is True
    assert metrics["pilot_selection_hours"]["suppression_reason"] == "no_selection_pairs"
    assert metrics["pilot_selection_savings_hours"]["value"] is None
    assert metrics["pilot_selection_savings_hours"]["suppressed"] is True
    assert metrics["pilot_selection_savings_hours"]["suppression_reason"] == "baseline_missing"
    with_baseline = api.get("/api/v1/analytics/role?baseline_hours=24").json()["metrics"]
    savings = {item["key"]: item for item in with_baseline}["pilot_selection_savings_hours"]
    assert savings["value"] is None
    assert savings["suppression_reason"] == "no_selection_pairs"


def test_customer_empty_funnel_has_explicit_denominators() -> None:
    api = client()
    login(api, "customer-roman")
    metrics = {item["key"]: item for item in api.get("/api/v1/analytics/role").json()["metrics"]}
    assert metrics["customer_applications"]["value"] == "0"
    assert metrics["customer_staffing_rate"]["denominator"] == 0
    assert metrics["customer_staffing_rate"]["value"] is None
    assert metrics["customer_acceptance_rate"]["value"] is None
    assert metrics["customer_repeat_participants"]["denominator"] == 0
    assert metrics["customer_repeat_participants"]["value"] is None
    assert metrics["customer_time_to_result_hours"]["numerator"] == 0
    assert metrics["customer_time_to_result_hours"]["value"] is None


def test_personal_rows_are_hidden_below_privacy_threshold() -> None:
    rows = ({"person_id": "one"}, {"person_id": "two"})
    assert visible_personal_rows(rows, cohort_size=2) == ()
    assert visible_personal_rows(rows, cohort_size=5) == rows
