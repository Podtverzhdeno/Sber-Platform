"""Portfolio visibility and consent withdrawal acceptance scenarios."""

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
                session_secret=SecretStr("portfolio-test-secret-long-enough"),
            )
        )
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_participant_portfolio_contains_visibility_without_private_chat() -> None:
    api = client()
    login(api, "participant-alex")
    response = api.get("/api/v1/me/portfolio")
    assert response.status_code == 200
    assert response.json()["display_name"] == "Алекс Речной"
    assert response.json()["visibility"]["hr_profile"] is False
    assert "chat" not in response.text.lower()


def test_hr_consent_withdrawal_removes_candidate_from_search_immediately() -> None:
    api = client()
    participant_csrf = login(api, "participant-alex")
    grant = api.put(
        "/api/v1/me/consents/hr_profile",
        json={"granted": True},
        headers={"X-CSRF-Token": participant_csrf},
    )
    assert grant.status_code == 200

    login(api, "hr-nina")
    candidates = api.get("/api/v1/hr/candidates")
    assert candidates.status_code == 200
    assert [item["display_name"] for item in candidates.json()] == ["Алекс Речной"]

    participant_csrf = login(api, "participant-alex")
    revoke = api.put(
        "/api/v1/me/consents/hr_profile",
        json={"granted": False},
        headers={"X-CSRF-Token": participant_csrf},
    )
    assert revoke.status_code == 200

    login(api, "hr-nina")
    assert api.get("/api/v1/hr/candidates").json() == []


def test_non_hr_cannot_enumerate_candidates() -> None:
    api = client()
    login(api, "participant-alex")
    response = api.get("/api/v1/hr/candidates")
    assert response.status_code == 404


def test_pipeline_counts_only_explicit_human_events() -> None:
    api = client()
    participant_csrf = login(api, "participant-alex")
    api.put(
        "/api/v1/me/consents/hr_profile",
        json={"granted": True},
        headers={"X-CSRF-Token": participant_csrf},
    )
    candidate_id = api.get("/api/v1/me/portfolio").json()["person_id"]

    hr_csrf = login(api, "hr-nina")
    initial = api.get("/api/v1/hr/pipeline").json()
    assert initial["counts"] == {"invitation": 0, "interview": 0, "offer": 0, "hire": 0}

    for stage in ("invitation", "interview", "offer", "hire"):
        created = api.post(
            f"/api/v1/hr/candidates/{candidate_id}/pipeline-events",
            json={"stage": stage, "note": f"Human decision: {stage}"},
            headers={"X-CSRF-Token": hr_csrf},
        )
        assert created.status_code == 200
        assert created.json()["origin"] == "human"
        counts = api.get("/api/v1/hr/pipeline").json()["counts"]
        assert counts[stage] == 1
        assert sum(counts.values()) == ("invitation", "interview", "offer", "hire").index(stage) + 1


def test_pipeline_rejects_skipped_or_automatic_stage() -> None:
    api = client()
    participant_csrf = login(api, "participant-alex")
    api.put(
        "/api/v1/me/consents/hr_profile",
        json={"granted": True},
        headers={"X-CSRF-Token": participant_csrf},
    )
    candidate_id = api.get("/api/v1/me/portfolio").json()["person_id"]
    hr_csrf = login(api, "hr-nina")
    response = api.post(
        f"/api/v1/hr/candidates/{candidate_id}/pipeline-events",
        json={"stage": "offer", "note": "Rating must not generate an offer."},
        headers={"X-CSRF-Token": hr_csrf},
    )
    assert response.status_code == 409
    assert api.get("/api/v1/hr/pipeline").json()["counts"]["offer"] == 0


def test_hr_candidate_search_filters_verified_projection() -> None:
    api = client()
    participant_csrf = login(api, "participant-alex")
    api.put(
        "/api/v1/me/consents/hr_profile",
        json={"granted": True},
        headers={"X-CSRF-Token": participant_csrf},
    )
    login(api, "hr-nina")
    assert len(api.get("/api/v1/hr/candidates?search=Алекс&min_projects=0").json()) == 1
    assert api.get("/api/v1/hr/candidates?search=НетТакого").json() == []
    assert api.get("/api/v1/hr/candidates?min_projects=1").json() == []
