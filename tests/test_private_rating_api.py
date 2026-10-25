"""Owner's private rating must not depend on public identity visibility."""

from __future__ import annotations

import asyncio
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.recognition import MemoryRecognitionStore, RecognitionService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.recognition import RatingSeason, SeasonStatus, Standing


def _api() -> tuple[TestClient, str]:
    personas = demo_personas()
    owner = next(item for item in personas if item.key == "participant-alex")
    store = MemoryRecognitionStore(
        leaderboard_profiles={owner.person_id: (owner.display_name, False, False, ())}
    )
    visible = RatingSeason(
        season_id=uuid4(),
        key="published-test",
        title="Опубликованный сезон",
        status=SeasonStatus.OPEN,
        version=2,
        policy_version=1,
    )
    scheduled = RatingSeason(
        season_id=uuid4(),
        key="draft-test",
        title="Ещё не открыт",
    )

    async def seed() -> None:
        await store.add_season(visible)
        await store.add_season(scheduled)
        await store.replace_standings(
            visible.season_id,
            (
                Standing(
                    season_id=visible.season_id,
                    person_id=owner.person_id,
                    place=2,
                    score=Decimal("125.50"),
                    successful_projects=3,
                    highest_project_score=Decimal("75"),
                    earliest_achievement=None,
                ),
            ),
        )
        # Even a draft with provisional standings must never appear.
        await store.replace_standings(
            scheduled.season_id,
            (
                Standing(
                    season_id=scheduled.season_id,
                    person_id=owner.person_id,
                    place=1,
                    score=Decimal("900"),
                    successful_projects=10,
                    highest_project_score=Decimal("100"),
                    earliest_achievement=None,
                ),
            ),
        )

    asyncio.run(seed())
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("private-rating-journey-api-test-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(personas),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return (
        TestClient(
            create_app(
                settings,
                auth_service=auth,
                recognition_service=RecognitionService(store),
            )
        ),
        str(visible.season_id),
    )


def _login(api: TestClient, key: str) -> None:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": key})
    assert response.status_code == 200, response.text


def test_private_owner_rank_remains_readable_without_public_consent() -> None:
    client, season_id = _api()
    with client as api:
        public = api.get(f"/api/v1/rating-seasons/{season_id}/leaderboard")
        assert public.status_code == 200, public.text
        assert public.json()[0]["anonymized"] is True
        assert public.json()[0]["person_id"] is None

        _login(api, "participant-alex")
        response = api.get("/api/v1/me/rating/standings")
        assert response.status_code == 200, response.text
        assert response.headers["cache-control"] == "private, no-store"
        items = response.json()
        assert len(items) == 1
        assert items[0]["season_id"] == season_id
        assert items[0]["place"] == 2
        assert Decimal(str(items[0]["score"])) == Decimal("125.50")
        assert items[0]["successful_projects"] == 3
        assert items[0]["season_version"] == 2
        assert items[0]["policy_version"] == 1
        assert "person_id" not in items[0]
        assert "display_name" not in items[0]

        # Maria cannot enumerate Alex's standing through the private endpoint.
        _login(api, "participant-maria")
        other = api.get("/api/v1/me/rating/standings")
        assert other.status_code == 200, other.text
        assert len(other.json()) == 1
        assert other.json()[0]["place"] is None
        assert other.json()[0]["score"] is None
        assert other.json()[0]["successful_projects"] is None

        _login(api, "customer-roman")
        forbidden = api.get("/api/v1/me/rating/standings")
        assert forbidden.status_code == 404
        assert str(season_id) not in forbidden.text
