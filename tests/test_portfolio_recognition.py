"""Issued recognition is reflected in portfolio without cross-role leakage."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.recognition import (
    CredentialStatus,
    LeaderboardEntry,
    OfferProof,
    RatingSeason,
    SeasonStatus,
    TrophyProof,
)


class StubRecognition:
    def __init__(self, person_id: UUID, *, public: bool = True) -> None:
        self.person_id = person_id
        self.public = public
        self.season = RatingSeason(
            season_id=uuid4(),
            key="portfolio-proof",
            title="Сезон доказательств",
            status=SeasonStatus.OPEN,
            version=2,
            policy_version=1,
        )
        self.store = SimpleNamespace(person_credentials=self.person_credentials)

    async def person_credentials(self, person_id: UUID) -> tuple[SimpleNamespace, ...]:
        if person_id != self.person_id:
            return ()
        return (
            SimpleNamespace(
                verification_id="credential-current",
                title="Именной диплом",
                status=CredentialStatus.VALID,
            ),
            SimpleNamespace(
                verification_id="credential-revoked",
                title="Отозванный диплом",
                status=CredentialStatus.REVOKED,
            ),
        )

    async def public_seasons(self) -> tuple[RatingSeason, ...]:
        return (self.season,)

    async def leaderboard(self, season_id: UUID) -> tuple[LeaderboardEntry, ...]:
        assert season_id == self.season.season_id
        if not self.public:
            return (
                LeaderboardEntry(
                    place=1,
                    person_id=None,
                    display_name="Участник рейтинга",
                    score=Decimal("100"),
                    successful_projects=2,
                    trophies=(),
                    offers=(),
                    anonymized=True,
                ),
            )
        return (
            LeaderboardEntry(
                place=1,
                person_id=self.person_id,
                display_name="Участник",
                score=Decimal("100"),
                successful_projects=2,
                trophies=(
                    TrophyProof(
                        trophy_type="winner",
                        title="Подтверждённый результат",
                        source_url="https://example.com/evidence",
                    ),
                ),
                offers=(
                    OfferProof(
                        event_title="Встреча с экспертом",
                        source_url="https://example.com/offer",
                        basis="Опубликованное признание",
                    ),
                ),
                anonymized=False,
            ),
        )


def _client() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("portfolio-recognition-test-secret-long-enough"),
    )
    return TestClient(create_app(settings))


def _login(api: TestClient, key: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": key})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_owner_portfolio_shows_issued_valid_revoked_and_public_evidence() -> None:
    with _client() as api:
        _login(api, "participant-alex")
        person = UUID(api.get("/api/v1/me/portfolio").json()["person_id"])
        api.app.state.recognition_service = StubRecognition(person)
        response = api.get("/api/v1/me/portfolio")
        assert response.status_code == 200, response.text
        result = response.json()
        assert [
            (credential["verification_id"], credential["status"])
            for credential in result["credentials"]
        ] == [
            ("credential-current", "valid"),
            ("credential-revoked", "revoked"),
        ]
        assert result["trophies"][0]["title"] == "Подтверждённый результат"
        assert result["trophies"][0]["organizer"] == "Не указан"
        assert result["offers"] == [
            {"title": "Встреча с экспертом", "basis": "Опубликованное признание"}
        ]


def test_anonymized_rating_cannot_be_reidentified_from_portfolio() -> None:
    with _client() as api:
        _login(api, "participant-alex")
        person = UUID(api.get("/api/v1/me/portfolio").json()["person_id"])
        api.app.state.recognition_service = StubRecognition(person, public=False)
        result = api.get("/api/v1/me/portfolio").json()
        assert result["trophies"] == []
        assert result["offers"] == []
        assert any(item["status"] == "revoked" for item in result["credentials"])


def test_hr_without_achievements_consent_cannot_read_credentials_or_trophies() -> None:
    with _client() as api:
        participant_csrf = _login(api, "participant-alex")
        person = UUID(api.get("/api/v1/me/portfolio").json()["person_id"])
        api.app.state.recognition_service = StubRecognition(person)
        _login(api, "hr-nina")
        assert api.get(f"/api/v1/hr/candidates/{person}").status_code == 404

        participant_csrf = _login(api, "participant-alex")
        permitted = api.put(
            "/api/v1/me/consents/hr_profile",
            json={"granted": True},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert permitted.status_code == 200
        _login(api, "hr-nina")
        response = api.get(f"/api/v1/hr/candidates/{person}")
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["credentials"] == []
        assert result["trophies"] == []
        assert result["offers"] == []
