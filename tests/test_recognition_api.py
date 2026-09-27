"""HTTP acceptance scenarios for versioned rating policies."""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.recognition import CohortMember


def client() -> TestClient:
    personas = demo_personas()
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("recognition-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(personas),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(
        create_app(
            settings,
            auth_service=auth,
            recognition_service=RecognitionService(
                MemoryRecognitionStore(
                    tuple(
                        CohortMember(item.person_id, "impulse", ("python",))
                        for item in personas
                        if item.key == "participant-alex"
                    )
                )
            ),
        )
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def policy_payload() -> dict[str, object]:
    return {
        "expected_season_version": 1,
        "cohort": {
            "key": "python-2026",
            "title": "Python 2026",
            "program_key": "impulse",
            "track_keys": ["python"],
            "minimum_size": 10,
        },
        "sources": [{"rule_id": "projects", "source_type": "project", "weight": "1", "cap": "600"}],
        "tie_breakers": ["successful_projects", "person_id"],
        "diploma_thresholds": [
            {"level": "gold", "place_from": 1, "place_to": 3, "title": "I degree"}
        ],
        "appeal_period_days": 14,
    }


def test_operator_publishes_policy_before_opening_season() -> None:
    api = client()
    with api:
        csrf = login(api, "operator-pavel")
        headers = {"X-CSRF-Token": csrf}
        created = api.post(
            "/api/v1/operations/rating-seasons",
            json={"key": "autumn-2026", "title": "Autumn 2026"},
            headers=headers,
        )
        assert created.status_code == 200
        season_id = created.json()["id"]

        blocked = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/open",
            json={"expected_version": 1},
            headers=headers,
        )
        assert blocked.status_code == 409
        assert blocked.json()["code"] == "RATING_POLICY_INCOMPLETE"

        published = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/policies",
            json=policy_payload(),
            headers=headers,
        )
        assert published.status_code == 200
        assert published.json()["version"] == 1
        opened = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/open",
            json={"expected_version": 1},
            headers=headers,
        )
        assert opened.status_code == 200
        assert opened.json()["status"] == "open"
        assert opened.json()["policy_version"] == 1

        frozen = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/policies",
            json={**policy_payload(), "expected_season_version": 2},
            headers=headers,
        )
        assert frozen.status_code == 409
        assert frozen.json()["code"] == "SEASON_POLICY_FROZEN"


def test_participant_cannot_create_rating_season() -> None:
    api = client()
    with api:
        csrf = login(api, "participant-alex")
        response = api.post(
            "/api/v1/operations/rating-seasons",
            json={"key": "hidden", "title": "Hidden"},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 404


def test_score_api_preserves_source_and_rebuilds_after_correction() -> None:
    api = client()
    with api:
        csrf = login(api, "operator-pavel")
        headers = {"X-CSRF-Token": csrf}
        participant = next(item for item in demo_personas() if item.key == "participant-alex")
        created = api.post(
            "/api/v1/operations/rating-seasons",
            json={"key": "score-api", "title": "Score API"},
            headers=headers,
        )
        season_id = created.json()["id"]
        api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/policies",
            json=policy_payload(),
            headers=headers,
        )
        api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/open",
            json={"expected_version": 1},
            headers=headers,
        )
        payload = {
            "person_id": str(participant.person_id),
            "source_type": "project",
            "source_id": str(uuid4()),
            "rule_id": "projects",
            "points": "80",
            "occurred_at": datetime.now(UTC).isoformat(),
        }
        score = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/scores",
            json=payload,
            headers=headers,
        )
        assert score.status_code == 200
        duplicate = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/scores",
            json=payload,
            headers=headers,
        )
        assert duplicate.status_code == 409
        correction = api.post(
            f"/api/v1/operations/score-entries/{score.json()['id']}/corrections",
            json={
                "points_delta": "-10",
                "reason": "Verified source correction.",
                "occurred_at": datetime.now(UTC).isoformat(),
            },
            headers=headers,
        )
        assert correction.status_code == 200
        rebuilt = api.post(
            f"/api/v1/operations/rating-seasons/{season_id}/standings/rebuild",
            headers=headers,
        )
        assert rebuilt.status_code == 200
        assert rebuilt.json()[0]["score"] == "70"
