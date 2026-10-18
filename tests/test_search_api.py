"""Global search acceptance scenarios."""

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.recognition import Credential, CredentialStatus

TEST_SECRET = SecretStr("search-test-secret-long-enough")


def build(logged_in: bool = True) -> TestClient:
    api = TestClient(
        create_app(
            Settings(app_env=AppEnvironment.TEST, demo_mode=True, session_secret=TEST_SECRET)
        )
    )
    if logged_in:
        api.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    return api


def test_search_matches_courses_and_events() -> None:
    api = build()

    response = api.get("/api/v1/search", params={"q": "python"})
    assert response.status_code == 200
    payload = response.json()
    kinds = {item["kind"] for item in payload["items"]}
    assert kinds <= {"task", "course", "event"}
    assert payload["items"], "seeded demo data should produce at least one hit"
    for item in payload["items"]:
        assert item["ref"].split(":", 1)[0] == item["kind"]
        assert item["title"].strip()

    course = api.get("/api/v1/search", params={"q": "python"}).json()
    match = [item for item in course["items"] if item["kind"] == "course"]
    assert match and any(
        item["ref"].startswith("course:") and item["meta"] in {"available", "unavailable"}
        for item in match
    )

    events = api.get("/api/v1/search", params={"q": "green"}).json()
    event_hits = [item for item in events["items"] if item["kind"] == "event"]
    assert event_hits and event_hits[0]["title"] == "Green Hack"


def test_search_requires_query_and_caps_results() -> None:
    api = build()

    short = api.get("/api/v1/search", params={"q": "p"})
    assert short.status_code == 422

    missed = api.get("/api/v1/search", params={"q": "missing-nonexistent-query-xyz"})
    assert missed.status_code == 200
    assert missed.json()["items"] == []

    capped = api.get("/api/v1/search", params={"q": "green", "limit": 1})
    assert capped.status_code == 200
    assert len(capped.json()["items"]) <= 1


def test_search_requires_session() -> None:
    api = build(logged_in=False)
    anonymous = api.get("/api/v1/search", params={"q": "python"})
    assert anonymous.status_code == 401


def _seed_shared_dialog(api: TestClient) -> dict:
    """Create a personal dialog + message so memory-mode search has context."""
    csrf = api.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}).json()[
        "csrf_token"
    ]
    opened = api.post(
        "/api/v1/me/messaging/channels/personal",
        json={"peer_id": str(demo_id("mentor-elena"))},
        headers={"X-CSRF-Token": csrf},
    )
    assert opened.status_code == 200, opened.text
    channel = opened.json()
    sent = api.post(
        f"/api/v1/me/messaging/channels/{channel['id']}/messages",
        json={"body": "Готовим прототип к демо.", "artifact_refs": []},
        headers={"X-CSRF-Token": csrf},
    )
    assert sent.status_code == 200, sent.text
    return channel


def test_search_finds_shared_people_and_own_messages() -> None:
    api = build()
    _seed_shared_dialog(api)

    people = api.get("/api/v1/search", params={"q": "елена"}).json()
    person_hits = [item for item in people["items"] if item["kind"] == "person"]
    assert person_hits and person_hits[0]["ref"].startswith("person:")
    assert person_hits[0]["title"] == "Елена Наставник"
    assert "mentor" in person_hits[0]["meta"]

    messages = api.get("/api/v1/search", params={"q": "прототип"}).json()
    message_hits = [item for item in messages["items"] if item["kind"] == "message"]
    assert message_hits
    hit = message_hits[0]
    parts = hit["ref"].split(":")
    assert hit["ref"].startswith("message:") and len(parts) == 3
    assert "прототип" in hit["title"].casefold()
    assert hit["meta"] == "Личный чат"

    outsider = api.get("/api/v1/search", params={"q": "анна"}).json()
    assert not [item for item in outsider["items"] if item["kind"] == "person"]


def test_search_messages_and_people_closed_channels_stay_hidden() -> None:
    api = build()
    _seed_shared_dialog(api)

    api.post("/api/v1/auth/demo-logout")
    api.post("/api/v1/auth/demo-login", json={"persona_key": "operator-pavel"})

    for query in ("прототип", "елена", "голосуем"):
        payload = api.get("/api/v1/search", params={"q": query}).json()
        kinds = {item["kind"] for item in payload["items"]}
        assert kinds.isdisjoint({"message", "person"}), f"{query} leaked private context"


def test_search_uses_canonical_peer_route_for_messages() -> None:
    api = build()
    channel = _seed_shared_dialog(api)
    response = api.get("/api/v1/search", params={"q": "прототип"})
    assert response.status_code == 200
    message_hits = [item for item in response.json()["items"] if item["kind"] == "message"]
    assert message_hits
    channel_id = message_hits[0]["ref"].split(":")[1]
    assert channel_id == channel["id"]
    listed = api.get("/api/v1/me/messaging/channels").json()
    assert channel_id in {item["id"] for item in listed}


def test_search_documents_only_own_credentials() -> None:
    api = build()
    asyncio.run(
        api.app.state.recognition_service.store.add_credential(
            Credential(
                credential_id=uuid4(),
                verification_id="RPM-SEARCH-0001",
                season_id=uuid4(),
                person_id=demo_id("participant-alex"),
                holder_name="Алекс Речной",
                credential_version=1,
                policy_version=1,
                status=CredentialStatus.VALID,
                title="Сертификат участника RPM",
                level="RPM",
                place=3,
                score=Decimal("4.2"),
                successful_projects=2,
                cohort_key="rpm-4-test",
                cohort_title="RPM 4 Тестовый поток",
                season_title="RPM 4",
                period="2026",
                issued_at=datetime(2026, 1, 10, tzinfo=UTC),
                checksum="checksum-verify-0001",
            )
        )
    )

    own = api.get("/api/v1/search", params={"q": "сертификат"}).json()
    own_hits = [item for item in own["items"] if item["kind"] == "document"]
    assert own_hits and own_hits[0]["ref"] == "credential:RPM-SEARCH-0001"
    assert own_hits[0]["meta"] == "valid"

    api.post("/api/v1/auth/demo-logout")
    api.post("/api/v1/auth/demo-login", json={"persona_key": "mentor-elena"})
    foreign = api.get("/api/v1/search", params={"q": "сертификат"}).json()
    assert not [item for item in foreign["items"] if item["kind"] == "document"]
