"""Notification center acceptance scenarios."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def build() -> TestClient:
    api = TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                session_secret=SecretStr("notifications-test-secret-long-enough"),
            )
        )
    )
    return api


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_notification_feed_marks_read_and_read_all() -> None:
    api = build()
    csrf = login(api, "participant-alex")

    listed = api.get("/api/v1/me/notifications")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["unread"] == 3
    assert len(payload["items"]) == 3
    kinds = {item["kind"] for item in payload["items"]}
    assert kinds == {"message", "checkpoint", "certificate"}
    assert all(item["read"] is False for item in payload["items"])

    names = {item["body"] for item in payload["items"]}
    assert names <= {
        "Елена Наставник: прототип выглядит крепко, проверим артефакты на этой неделе.",
        "Завершите checkpoint до конца недели, чтобы сохранить стрик.",
        "Сертификат подтверждён и доступен в портфолио.",
    }

    target = payload["items"][0]
    marked = api.post(
        f"/api/v1/me/notifications/{target['id']}/read", headers={"X-CSRF-Token": csrf}
    )
    assert marked.status_code == 200
    assert marked.json()["read"] is True

    after = api.get("/api/v1/me/notifications").json()
    assert after["unread"] == 2

    repeat = api.post(
        f"/api/v1/me/notifications/{target['id']}/read", headers={"X-CSRF-Token": csrf}
    )
    assert repeat.status_code == 200
    assert repeat.json()["read"] is True

    cleared = api.post("/api/v1/me/notifications/read-all", headers={"X-CSRF-Token": csrf})
    assert cleared.status_code == 200
    assert cleared.json()["cleared"] == 2

    final = api.get("/api/v1/me/notifications")
    assert final.json()["unread"] == 0
    assert all(item["read"] is True for item in final.json()["items"])

    other_self = api.post("/api/v1/auth/demo-login", json={"persona_key": "customer-roman"})
    assert other_self.status_code == 200
    roman = api.get("/api/v1/me/notifications").json()
    assert roman["unread"] == 2
    assert {item["kind"] for item in roman["items"]} == {"application", "review"}


def test_foreign_notifications_hidden_and_unknown_rejected() -> None:
    api = build()
    login(api, "participant-alex")
    alex_items = api.get("/api/v1/me/notifications").json()["items"]
    assert alex_items

    roman_csrf = login(api, "customer-roman")
    roman_items = api.get("/api/v1/me/notifications").json()["items"]
    foreign = [item for item in roman_items if item not in alex_items]
    assert foreign

    hidden = api.post(
        f"/api/v1/me/notifications/{alex_items[0]['id']}/read",
        headers={"X-CSRF-Token": roman_csrf},
    )
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"

    missing = api.post(
        "/api/v1/me/notifications/00000000-0000-0000-0000-000000000000/read",
        headers={"X-CSRF-Token": roman_csrf},
    )
    assert missing.status_code == 404
    assert missing.json()["code"] == "RESOURCE_NOT_FOUND"


def test_csrf_guard_requires_verified_session_for_write_actions() -> None:
    api = build()
    login(api, "participant-alex")
    blocked = api.post("/api/v1/me/notifications/read-all")
    assert blocked.status_code == 403
