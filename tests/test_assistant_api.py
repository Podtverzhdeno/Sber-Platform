"""AI assistant gates: closed brief never reaches an external gateway."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.ai.gateway import FakeGateway, FakeOutcome
from impulse.ai.suggestions import SuggestionService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client(gateway: FakeGateway | None = None, *, brief_ai: bool = True) -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("assistant-test-secret-long-enough"),
        openrouter_api_key=SecretStr("assistant-test-key-not-real"),
        ai_customer_brief_enabled=brief_ai,
    )
    service = SuggestionService(gateway) if gateway is not None else None
    return TestClient(create_app(settings, ai_suggestion_service=service))


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def draft_command() -> dict[str, object]:
    return {
        "brief": "Нужно приложение для поиска статей",
        "data_class": "public",
        "correlation_id": "assistant-1",
        "draft_version": 7,
        "fields": {
            "problem": "Исследователи долго ищут статьи",
            "deliverable": "",
            "criterion": "",
        },
    }


def structured_draft() -> FakeOutcome:
    return FakeOutcome.structured_response(
        {
            "problem": "Найти релевантные статьи по запросу исследователя",
            "deliverable": "Прототип поиска с метаданными",
            "acceptance_criteria": ["Precision@10 >= 0.7", "Запуск на открытых данных"],
            "disclaimer": "draft_requires_human_publish",
        }
    )


def test_closed_brief_never_reaches_external_gateway() -> None:
    gateway = FakeGateway([structured_draft()])
    api = client(gateway)
    with api:
        csrf = login(api, "customer-roman")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json={
                "brief": "Внутреннее ТЗ с коммерческимиslack-обсуждениями",
                "data_class": "internal_business",
                "correlation_id": "assistant-closed-1",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["kind"] == "manual_template"
        assert body["gateway_called"] is False
        assert body["editable"] is True
        assert "шаблон" in body["notice"]
        assert gateway.invocations == []


def test_ai_draft_is_returned_editable_but_never_publishes() -> None:
    gateway = FakeGateway([structured_draft()])
    api = client(gateway)
    with api:
        csrf = login(api, "customer-roman")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json=draft_command(),
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["editable"] is True
        assert body["gateway_called"] is True
        assert body["problem"].startswith("Найти")
        assert body["acceptance_criteria"][0].startswith("Precision@10")
        assert body["disclaimer"] == "draft_requires_human_publish"
        assert body["suggestion_id"]
        assert body["draft_version"] == 7
        patches = {item["target_field"]: item for item in body["patches"]}
        assert patches["problem"] == {
            "target_field": "problem",
            "before": "Исследователи долго ищут статьи",
            "field_version": 7,
            "proposed_text": "Найти релевантные статьи по запросу исследователя",
            "reason": "Уточнить проблему и целевую аудиторию решения.",
            "source_version": "customer-brief-v1",
            "prompt_version": "customer-brief-prompt-v1",
        }
        assert patches["deliverable"]["before"] == ""
        assert patches["criterion"]["proposed_text"].startswith("Precision@10")


def test_demo_synthetic_brief_is_allowed_by_the_same_explicit_gate() -> None:
    gateway = FakeGateway([structured_draft()])
    api = client(gateway)
    command = draft_command()
    command["data_class"] = "demo_synthetic"
    with api:
        csrf = login(api, "customer-roman")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json=command,
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        assert response.json()["gateway_called"] is True
        assert len(gateway.invocations) == 1


def test_assistant_off_is_safe_manual_template_without_call() -> None:
    gateway = FakeGateway([structured_draft()])
    api = client(gateway, brief_ai=False)
    with api:
        csrf = login(api, "customer-roman")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json=draft_command(),
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        assert response.json()["kind"] == "manual_template"
        assert response.json()["gateway_called"] is False
        assert gateway.invocations == []


def test_other_role_cannot_request_customer_drafts() -> None:
    api = client()
    with api:
        csrf = login(api, "participant-alex")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json=draft_command(),
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 404


def test_malformed_gateway_error_keeps_workspace_safe() -> None:
    api = client(FakeGateway([FakeOutcome.malformed()]), brief_ai=True)
    with api:
        csrf = login(api, "customer-roman")
        response = api.post(
            "/api/v1/me/assistant/customer-brief",
            json=draft_command(),
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 503


def test_timeout_and_quota_have_distinct_safe_states() -> None:
    for outcome, status, code, retryable in (
        (FakeOutcome.timeout(), 503, "ASSISTANT_TIMEOUT", True),
        (FakeOutcome.http_error(429), 429, "ASSISTANT_QUOTA_EXCEEDED", True),
        (FakeOutcome.http_error(402), 429, "ASSISTANT_QUOTA_EXCEEDED", False),
    ):
        api = client(FakeGateway([outcome]), brief_ai=True)
        with api:
            csrf = login(api, "customer-roman")
            response = api.post(
                "/api/v1/me/assistant/customer-brief",
                json=draft_command(),
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == status
            assert response.json()["code"] == code
            assert response.json()["retryable"] is retryable
