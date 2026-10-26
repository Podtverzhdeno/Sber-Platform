"""Cross-role evidence propagation: customer decision to participant read models.

Intentional HTTP test: no direct store mutation, so every transition uses the
same authorization, domain rules and projection contracts as the application.
"""

from __future__ import annotations

from typing import Any, cast

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def _app() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("project-journey-consistency-test-secret-2026"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(
        create_app(settings, auth_service=auth, work_service=WorkService(MemoryWorkStore()))
    )


def _login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200, response.text
    return response.json()["csrf_token"]


def _post(
    api: TestClient, path: str, csrf: str, body: dict[str, object] | None = None
) -> dict[str, Any]:
    response = api.post(path, headers={"X-CSRF-Token": csrf}, json=body)
    assert response.status_code == 200, f"{path}: {response.status_code} {response.text}"
    payload: object = response.json()
    assert isinstance(payload, dict), f"{path} must return a JSON object"
    return cast(dict[str, Any], payload)


def _get(api: TestClient, path: str) -> dict[str, Any]:
    response = api.get(path)
    assert response.status_code == 200, f"{path}: {response.status_code} {response.text}"
    payload: object = response.json()
    assert isinstance(payload, dict), f"{path} must return a JSON object"
    return cast(dict[str, Any], payload)


def test_project_acceptance_updates_workspace_portfolio_passport_and_journey() -> None:
    with _app() as api:
        customer = _login(api, "customer-roman")
        task = _post(
            api,
            "/api/v1/customer/projects/cross-section/tasks",
            customer,
            {
                "task_key": "cross-section-model-2026",
                "title": "Реализовать аналитический API с доказательствами",
                "problem": "Нужно проверить сквозную согласованность результатов между экранами.",
                "deliverable": "API, тесты и ссылка на результат.",
                "acceptance_criteria": ["API воспроизводим", "Артефакт проверяем"],
                "deadline_at": "2026-11-01T18:00:00Z",
                "data_constraints": "Синтетические данные",
                "ip_terms": "Вклад и результаты фиксируются после проверки",
                "nominated_mentor_id": None,
                "allowed_artifacts": ["repo"],
                "competency_tags": ["python", "architecture"],
                "case_rubric": {
                    "version": 1,
                    "result": "Воспроизводимый результат",
                    "reasoning": "Техническое обоснование",
                    "uncertainty": "Риски и допущения",
                    "ai_use": "Ответственное использование ИИ",
                    "defense": "Защита решения",
                },
                "compensation": {
                    "paid": True,
                    "base_amount_per_assignee": "10000.00",
                    "currency": "RUB",
                    "a_multiplier": "2.50",
                    "quantum": "0.01",
                    "rounding_mode": "half_up",
                    "policy_version": 1,
                    "payout_condition": "После принятия результата",
                },
            },
        )
        task_id = task["id"]
        _post(api, f"/api/v1/customer/tasks/{task_id}/submit", customer)
        operator = _login(api, "operator-pavel")
        _post(api, f"/api/v1/operations/tasks/{task_id}/moderate", operator)
        _post(api, f"/api/v1/operations/tasks/{task_id}/support", operator, {"mode": "operator"})
        _post(api, f"/api/v1/operations/tasks/{task_id}/publish", operator)

        participant = _login(api, "participant-alex")
        person = _get(api, "/api/v1/me")["person_id"]
        passport_before = _get(api, "/api/v1/me/talent-passport")
        assert passport_before["cases"] == []
        assert passport_before["skills"] == []
        assert _get(api, "/api/v1/me/portfolio")["contributions"] == []
        terms_version = _get(api, f"/api/v1/me/tasks/{task_id}")["terms"]["version"]
        _post(
            api,
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            participant,
            {"terms_version": terms_version},
        )
        application = _post(api, f"/api/v1/me/tasks/{task_id}/applications", participant)

        # An application is not an assignment and creates no verified evidence.
        journey_before = _get(api, "/api/v1/me/journey/snapshot")
        assert journey_before["projects"] == []
        assert journey_before["accepted_case_count"] == 0
        assert _get(api, "/api/v1/me/talent-passport")["cases"] == []

        customer = _login(api, "customer-roman")
        accepted_application = _post(
            api,
            f"/api/v1/customer/applications/{application['id']}/accept",
            customer,
            {"expected_version": application["version"]},
        )
        assignment_id = accepted_application["id"]
        customer_view = _get(api, f"/api/v1/customer/tasks/{task_id}")
        assert any(item["id"] == assignment_id for item in customer_view["assignments"])

        participant = _login(api, "participant-alex")
        participant_work = _get(api, "/api/v1/me/work")
        assert any(item["assignment"]["id"] == assignment_id for item in participant_work)
        _post(api, f"/api/v1/me/assignments/{assignment_id}/start", participant)

        contribution = _post(
            api,
            f"/api/v1/me/assignments/{assignment_id}/contributions",
            participant,
            {
                "personal_summary": "Реализовал аналитический API и воспроизводимые тесты.",
                "artifacts": [
                    {"key": "repo", "uri": "https://example.test/impulse/project/commit/42"}
                ],
            },
        )
        contribution_id = contribution["id"]
        before_decision = _get(api, "/api/v1/me/journey/snapshot")
        assert before_decision["accepted_case_count"] == 0
        assert all(
            contribution_id not in project["accepted_contribution_ids"]
            for project in before_decision["projects"]
        )
        assert _get(api, "/api/v1/me/portfolio")["contributions"] == []
        assert _get(api, "/api/v1/me/talent-passport")["cases"] == []

        customer = _login(api, "customer-roman")
        _post(
            api,
            f"/api/v1/customer/contributions/{contribution_id}/decision",
            customer,
            {
                "decision": "accepted",
                "reason": "Артефакт проверен; требования к API выполнены.",
            },
        )

        participant = _login(api, "participant-alex")
        work_after = _get(api, "/api/v1/me/work")
        assert any(
            contribution["id"] == contribution_id and contribution["status"] == "accepted"
            for item in work_after
            for contribution in item["contributions"]
        )
        passport = _get(api, "/api/v1/me/talent-passport")
        assert passport["person_id"] == person
        assert [case["contribution_id"] for case in passport["cases"]] == [contribution_id]
        assert {item["key"]: item["confirmed_case_count"] for item in passport["skills"]} == {
            "architecture": 1,
            "python": 1,
        }

        portfolio = _get(api, "/api/v1/me/portfolio")
        assert portfolio["person_id"] == person
        assert [item["contribution_id"] for item in portfolio["contributions"]] == [contribution_id]
        assert portfolio["contributions"][0]["verification_status"] == "verified"
        journey = _get(api, "/api/v1/me/journey/snapshot")
        assert journey["person_id"] == person
        assert journey["accepted_case_count"] == 1
        assert any(
            project["assignment_id"] == assignment_id
            and project["accepted_contribution_ids"] == [contribution_id]
            for project in journey["projects"]
        )
        # Acceptance alone is not a rating policy decision or an awarded grade.
        assert journey["ratings"] == []
        assert journey["verified_provider_course_count"] == 0

        _login(api, "participant-maria")
        assert _get(api, "/api/v1/me/talent-passport")["cases"] == []
        assert _get(api, "/api/v1/me/portfolio")["contributions"] == []
        assert _get(api, "/api/v1/me/journey/snapshot")["projects"] == []
