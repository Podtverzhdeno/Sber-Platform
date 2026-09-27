"""HTTP scenarios for project-specific human 5+ reviews."""

from dataclasses import replace
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.reward import (
    DEFAULT_REVIEW_RUBRIC,
    MemoryRewardStore,
    ReviewEvidence,
    RewardService,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


class MutableEvidence:
    def __init__(self, mentor_id: UUID, evidence: ReviewEvidence) -> None:
        self.mentor_id = mentor_id
        self.evidence = evidence

    async def for_mentor(self, mentor_id: UUID, contribution_id: UUID) -> ReviewEvidence | None:
        if mentor_id == self.mentor_id and contribution_id == self.evidence.contribution_id:
            return self.evidence
        return None


def review_client() -> tuple[TestClient, MutableEvidence]:
    personas = demo_personas()
    mentor_id = next(item.person_id for item in personas if item.key == "mentor-elena")
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("reward-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(personas),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    evidence = MutableEvidence(
        mentor_id,
        ReviewEvidence(
            uuid4(), contribution_version=2, accepted=True, authorship_conflict_open=False
        ),
    )
    reward = RewardService(MemoryRewardStore(), evidence)
    return TestClient(create_app(settings, auth_service=auth, reward_service=reward)), evidence


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def draft_payload() -> dict[str, object]:
    return {
        "rubric_id": str(DEFAULT_REVIEW_RUBRIC.rubric_id),
        "grade": "B",
        "draft_origin": "ai_suggestion",
        "explanation": "Оценка B основана на принятом результате и личных доказательствах.",
        "assessments": [
            {
                "criterion_key": criterion.key,
                "finding": f"Факт по критерию: {criterion.title}.",
                "evidence_refs": [f"artifact:{criterion.key}"],
            }
            for criterion in DEFAULT_REVIEW_RUBRIC.criteria
        ],
    }


def test_ai_draft_requires_explicit_human_confirmation_before_published_b() -> None:
    api, evidence = review_client()
    with api:
        csrf = login(api, "mentor-elena")
        rubric = api.get(f"/api/v1/mentor/review-rubrics/{DEFAULT_REVIEW_RUBRIC.rubric_id}")
        assert rubric.status_code == 200
        assert len(rubric.json()["criteria"]) == 3

        draft = api.post(
            f"/api/v1/mentor/contributions/{evidence.evidence.contribution_id}/reviews",
            json=draft_payload(),
            headers={"X-CSRF-Token": csrf},
        )
        assert draft.status_code == 200
        assert draft.json()["status"] == "draft"
        assert draft.json()["draft_origin"] == "ai_suggestion"
        assert draft.json()["confirmed_by"] is None
        review_id = draft.json()["id"]

        premature = api.post(
            f"/api/v1/mentor/reviews/{review_id}/publish",
            json={"expected_version": 1},
            headers={"X-CSRF-Token": csrf},
        )
        assert premature.status_code == 409
        assert premature.json()["code"] == "INVALID_REVIEW_TRANSITION"

        proposed = api.post(
            f"/api/v1/mentor/reviews/{review_id}/propose",
            json={"expected_version": 1},
            headers={"X-CSRF-Token": csrf},
        )
        confirmed = api.post(
            f"/api/v1/mentor/reviews/{review_id}/confirm",
            json={"expected_version": proposed.json()["version"]},
            headers={"X-CSRF-Token": csrf},
        )
        published = api.post(
            f"/api/v1/mentor/reviews/{review_id}/publish",
            json={"expected_version": confirmed.json()["version"]},
            headers={"X-CSRF-Token": csrf},
        )
        assert published.status_code == 200
        assert published.json()["status"] == "published"
        assert published.json()["grade"] == "B"
        assert published.json()["published_by"] == confirmed.json()["confirmed_by"]
        assert published.json()["contribution_id"] == str(evidence.evidence.contribution_id)


def test_open_authorship_conflict_blocks_http_publish_and_participant_is_hidden() -> None:
    api, evidence = review_client()
    with api:
        participant_csrf = login(api, "participant-alex")
        hidden = api.post(
            f"/api/v1/mentor/contributions/{evidence.evidence.contribution_id}/reviews",
            json=draft_payload(),
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert hidden.status_code == 404

        csrf = login(api, "mentor-elena")
        draft = api.post(
            f"/api/v1/mentor/contributions/{evidence.evidence.contribution_id}/reviews",
            json=draft_payload(),
            headers={"X-CSRF-Token": csrf},
        ).json()
        proposed = api.post(
            f"/api/v1/mentor/reviews/{draft['id']}/propose",
            json={"expected_version": draft["version"]},
            headers={"X-CSRF-Token": csrf},
        ).json()
        confirmed = api.post(
            f"/api/v1/mentor/reviews/{draft['id']}/confirm",
            json={"expected_version": proposed["version"]},
            headers={"X-CSRF-Token": csrf},
        ).json()
        evidence.evidence = replace(evidence.evidence, authorship_conflict_open=True)
        blocked = api.post(
            f"/api/v1/mentor/reviews/{draft['id']}/publish",
            json={"expected_version": confirmed["version"]},
            headers={"X-CSRF-Token": csrf},
        )
        assert blocked.status_code == 409
        assert blocked.json()["code"] == "INVALID_REVIEW_TRANSITION"
        assert "конфликт авторства" in blocked.json()["message"]
