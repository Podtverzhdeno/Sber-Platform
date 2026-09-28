"""Unified operator queue acceptance scenarios."""

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
                session_secret=SecretStr("operations-test-secret-long-enough"),
            )
        )
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_operator_sees_priority_sources_and_dependencies() -> None:
    api = client()
    login(api, "operator-pavel")
    items = api.get("/api/v1/ops/cases")
    assert items.status_code == 200
    assert [item["priority"] for item in items.json()] == ["critical", "high", "medium"]
    assert items.json()[0]["source_refs"]
    assert items.json()[0]["dependency_refs"]


def test_stale_case_decision_is_rejected_and_timeline_is_human() -> None:
    api = client()
    csrf = login(api, "operator-pavel")
    item = api.get("/api/v1/ops/cases").json()[0]
    first = api.post(
        f"/api/v1/ops/cases/{item['id']}/decide",
        json={
            "expected_version": 1,
            "outcome": "resolved",
            "reason": "Payment reference checked manually.",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert first.status_code == 200
    assert first.json()["version"] == 2
    stale = api.post(
        f"/api/v1/ops/cases/{item['id']}/decide",
        json={"expected_version": 1, "outcome": "rejected", "reason": "Old browser tab."},
        headers={"X-CSRF-Token": csrf},
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "STALE_CASE"
    timeline = api.get(f"/api/v1/ops/cases/{item['id']}/timeline").json()
    assert len(timeline) == 1
    assert timeline[0]["case_version"] == 1


def test_non_operator_cannot_discover_cases() -> None:
    api = client()
    login(api, "participant-alex")
    assert api.get("/api/v1/ops/cases").status_code == 404
