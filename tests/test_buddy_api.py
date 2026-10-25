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


def test_chat_history_is_owner_scoped_and_model_gate_stays_server_side() -> None:
    from pydantic import SecretStr

    from impulse.ai.gateway import ModelOutputKind, ModelResult

    class StubOpenRouter:
        def __init__(self, **kwargs: object) -> None:
            assert isinstance(kwargs["api_key"], SecretStr)
            assert kwargs["api_key"].get_secret_value() == "test-only-key"

        async def invoke(self, *args: object, **kwargs: object) -> ModelResult:
            return ModelResult(
                kind=ModelOutputKind.TEXT,
                model_id="openrouter/free",
                provider="openrouter",
                request_id="test-buddy",
                text="Разбей проект на этапы. Открой Bootcamp и проверь аналитику.",
            )

    from unittest.mock import patch

    settings = Settings(
        app_env=AppEnvironment.TEST,
        ai_buddy_enabled=True,
        openrouter_api_key=SecretStr("test-only-key"),
    )
    with patch("impulse.api.v1.buddy.OpenRouterGateway", StubOpenRouter):
        with TestClient(create_app(settings)) as client:
            csrf = login(client, "participant-alex")
            created = client.post("/api/v1/agents/buddy/threads", headers={"X-CSRF-Token": csrf})
            assert created.status_code == 201
            thread_id = created.json()["id"]
            response = client.post(
                f"/api/v1/agents/buddy/threads/{thread_id}/reply",
                headers={"X-CSRF-Token": csrf},
                json={"client_message_id": "idem-1", "content": "Объясни мой следующий шаг"},
            )
            assert response.status_code == 200, response.text
            messages = response.json()["messages"]
            assert [message["role"] for message in messages] == ["user", "assistant"]
            assert messages[1]["content"].startswith("Разбей проект")
            assert (
                client.post(
                    f"/api/v1/agents/buddy/threads/{thread_id}/reply",
                    headers={"X-CSRF-Token": csrf},
                    json={"client_message_id": "idem-1", "content": "Объясни мой следующий шаг"},
                ).json()["messages"]
                == messages
            )
            history = client.get("/api/v1/agents/buddy/threads")
            assert history.status_code == 200
            assert any(item["id"] == thread_id for item in history.json())
            assert "test-only-key" not in history.text
            login(client, "participant-maria")
            assert client.get(f"/api/v1/agents/buddy/threads/{thread_id}").status_code == 404
            assert not any(
                item["id"] == thread_id
                for item in client.get("/api/v1/agents/buddy/threads").json()
            )


def test_model_disabled_returns_explicit_error_without_fake_answer() -> None:
    with TestClient(create_app(Settings(app_env=AppEnvironment.TEST))) as client:
        csrf = login(client, "participant-alex")
        thread_id = client.post(
            "/api/v1/agents/buddy/threads", headers={"X-CSRF-Token": csrf}
        ).json()["id"]
        response = client.post(
            f"/api/v1/agents/buddy/threads/{thread_id}/reply",
            headers={"X-CSRF-Token": csrf},
            json={"client_message_id": "off-1", "content": "Что делать дальше?"},
        )
        assert response.status_code == 503
        assert client.get(f"/api/v1/agents/buddy/threads/{thread_id}").json()["messages"] == []
