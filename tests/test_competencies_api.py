"""Versioned competency reports and evidence isolation scenarios."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def _app():
    return create_app(
        Settings(
            app_env=AppEnvironment.TEST,
            demo_mode=True,
            session_secret=SecretStr("competencies-test-secret-long-enough"),
        )
    )


def test_course_role_and_project_reports_do_not_transfer_unrelated_evidence() -> None:
    with TestClient(_app()) as api:
        login = api.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert login.status_code == 200

        response = api.get("/api/v1/me/competencies")
        assert response.status_code == 200
        reports = {item["framework_key"]: item for item in response.json()}
        assert set(reports) == {
            "course:openspec-sdd",
            "role:product-engineer",
            "project:semantic-search-rd",
        }

        role_skills = {
            item["skill_key"]: item for item in reports["role:product-engineer"]["skills"]
        }
        delivery = role_skills["delivery"]
        assert delivery["level"] == "базовый"
        assert [item["source_kind"] for item in delivery["anchors"]] == ["project"]
        assert [item["source_kind"] for item in delivery["excluded"]] == ["course"]
        assert delivery["excluded"][0]["counted"] is False

        evidence = api.get("/api/v1/me/competency-evidence", params={"competency_key": "delivery"})
        assert evidence.status_code == 200
        assert {item["source_kind"] for item in evidence.json()} == {"course", "project"}


def test_competency_evidence_is_scoped_to_authenticated_participant() -> None:
    with TestClient(_app()) as api:
        login = api.post("/api/v1/auth/demo-login", json={"persona_key": "participant-maria"})
        assert login.status_code == 200
        assert api.get("/api/v1/me/competency-evidence").json() == []
