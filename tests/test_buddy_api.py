"""Buddy API idempotency, cancellation, SSE, and cross-thread IDOR."""

from fastapi.testclient import TestClient

from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_duplicate_message_cancel_and_safe_sse() -> None:
    with TestClient(create_app(Settings(app_env=AppEnvironment.TEST))) as client:
        csrf = login(client, "participant-alex")
        headers = {"X-CSRF-Token": csrf}
        created = client.post("/api/v1/agents/buddy/threads", headers=headers)
        thread_id = created.json()["id"]
        payload = {"client_message_id": "client-1", "content": "Какой следующий шаг?"}
        first = client.post(
            f"/api/v1/agents/buddy/threads/{thread_id}/messages", headers=headers, json=payload
        )
        duplicate = client.post(
            f"/api/v1/agents/buddy/threads/{thread_id}/messages", headers=headers, json=payload
        )
        assert first.json()["id"] == duplicate.json()["id"]
        events = client.get(f"/api/v1/agents/buddy/threads/{thread_id}/events")
        assert events.status_code == 200
        assert "Какой" not in events.text
        cancelled = client.post(f"/api/v1/agents/buddy/threads/{thread_id}/cancel", headers=headers)
        assert cancelled.json()["status"] == "cancelled"
        rejected = client.post(
            f"/api/v1/agents/buddy/threads/{thread_id}/messages",
            headers=headers,
            json={"client_message_id": "client-2", "content": "Ещё вопрос"},
        )
        assert rejected.status_code == 409


def test_cross_thread_idor_is_not_found() -> None:
    with TestClient(create_app(Settings(app_env=AppEnvironment.TEST))) as client:
        csrf = login(client, "participant-alex")
        created = client.post("/api/v1/agents/buddy/threads", headers={"X-CSRF-Token": csrf})
        thread_id = created.json()["id"]
        login(client, "participant-maria")
        assert client.get(f"/api/v1/agents/buddy/threads/{thread_id}").status_code == 404
