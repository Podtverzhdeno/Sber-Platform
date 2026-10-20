"""Idempotent application withdrawal and re-apply rules for published tasks."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client(work_store: MemoryWorkStore | None = None) -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("work-withdraw-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(
        create_app(
            settings,
            auth_service=auth,
            work_service=WorkService(work_store or MemoryWorkStore()),
        )
    )


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def brief() -> dict[str, object]:
    return {
        "task_key": "semantic-search-rd",
        "title": "Проверить гипотезу семантического поиска",
        "problem": "Пользователю сложно найти подходящую программу.",
        "deliverable": "Research document и MVP поиска.",
        "acceptance_criteria": ["Есть offline-метрика", "MVP воспроизводим"],
        "deadline_at": "2026-11-01T18:00:00Z",
        "data_constraints": "Только синтетические данные.",
        "ip_terms": "Результат доступен заказчику после приёмки.",
        "nominated_mentor_id": None,
        "compensation": {
            "paid": True,
            "base_amount_per_assignee": "10000.00",
            "currency": "RUB",
            "a_multiplier": "2.50",
            "quantum": "0.01",
            "rounding_mode": "half_up",
            "policy_version": 1,
            "payout_condition": "После принятия личного вклада и публикации оценки человеком.",
        },
    }


def case_rubric() -> dict[str, object]:
    return {
        "version": 1,
        "result": "Рабочий и воспроизводимый результат",
        "reasoning": "Обоснование выбора подхода",
        "uncertainty": "Открытые вопросы и допущения",
        "ai_use": "Осмысленное использование ИИ",
        "defense": "Защита решения перед командой",
    }


def _publish_case(api: TestClient, customer_csrf: str, task_id: str) -> None:
    api.post(f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf})
    operator_csrf = login(api, "operator-pavel")
    api.post(
        f"/api/v1/operations/tasks/{task_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
    )
    api.post(
        f"/api/v1/operations/tasks/{task_id}/support",
        json={"mode": "operator"},
        headers={"X-CSRF-Token": operator_csrf},
    )
    api.post(f"/api/v1/operations/tasks/{task_id}/publish", headers={"X-CSRF-Token": operator_csrf})


def _published_case_task(api: TestClient) -> str:
    customer_csrf = login(api, "customer-roman")
    task_id = api.post(
        "/api/v1/customer/projects/demo-rd-lab/tasks",
        json={
            **brief(),
            "task_key": "withdraw-target-case",
            "competency_tags": ["NLP"],
            "case_rubric": case_rubric(),
        },
        headers={"X-CSRF-Token": customer_csrf},
    ).json()["id"]
    _publish_case(api, customer_csrf, task_id)
    return task_id


def _apply(api: TestClient, task_id: str, persona: str = "participant-alex") -> dict[str, object]:
    customer_csrf = login(api, "customer-roman")
    terms_version = api.get(
        f"/api/v1/customer/tasks/{task_id}", headers={"X-CSRF-Token": customer_csrf}
    ).json()["terms"]["version"]
    csrf = login(api, persona)
    consented = api.post(
        f"/api/v1/me/tasks/{task_id}/terms-consent",
        json={"terms_version": terms_version},
        headers={"X-CSRF-Token": csrf},
    )
    assert consented.status_code == 200
    applied = api.post(f"/api/v1/me/tasks/{task_id}/applications", headers={"X-CSRF-Token": csrf})
    assert applied.status_code == 200
    return applied.json()


def _withdraw(api: TestClient, application_id: str, persona: str = "participant-alex"):
    return api.post(
        f"/api/v1/me/applications/{application_id}/withdraw",
        headers={"X-CSRF-Token": login(api, persona)},
    )


def test_withdraw_is_idempotent_and_reapply_revives_application() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = _published_case_task(api)
        applied = _apply(api, task_id)
        application_id = str(applied["id"])

        first = _withdraw(api, application_id)
        assert first.status_code == 200
        withdrawn = first.json()
        assert withdrawn["status"] == "withdrawn"
        assert withdrawn["version"] == 2

        repeat = _withdraw(api, application_id)
        assert repeat.status_code == 200
        assert repeat.json() == withdrawn

        customer_csrf = login(api, "customer-roman")
        history = api.get(
            f"/api/v1/customer/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": customer_csrf},
        ).json()
        assert [entry["status"] for entry in history] == ["withdrawn"]

        fresh = _apply(api, task_id)
        assert fresh["status"] == "applied"
        assert fresh["id"] == application_id
        assert fresh["version"] == 3

        login(api, "customer-roman")
        reopened = api.get(f"/api/v1/customer/tasks/{task_id}/applications").json()
        assert [entry["status"] for entry in reopened] == ["applied"]
        assert reopened[0]["id"] == application_id

        cleared = _withdraw(api, application_id)
        assert cleared.status_code == 200
        assert cleared.json()["version"] == 4
        login(api, "customer-roman")
        refreshed = api.get(f"/api/v1/customer/tasks/{task_id}/applications").json()
        assert [entry["status"] for entry in refreshed] == ["withdrawn"]


def test_withdraw_forbidden_after_accept_and_stale_accept_is_raced_safe() -> None:
    api = client()
    with api:
        task_id = _published_case_task(api)
        applied = _apply(api, task_id)
        application_id = str(applied["id"])

        _withdraw(api, application_id)
        customer_csrf = login(api, "customer-roman")
        raced = api.post(
            f"/api/v1/customer/applications/{application_id}/accept",
            json={"expected_version": applied["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert raced.status_code == 409
        assert raced.json()["code"] in {"STALE_APPLICATION", "INVALID_APPLICATION_TRANSITION"}

        retried = _apply(api, task_id)
        customer_csrf = login(api, "customer-roman")
        accepted = api.post(
            f"/api/v1/customer/applications/{retried['id']}/accept",
            json={"expected_version": retried["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "staffed"

        forbidden = _withdraw(api, str(retried["id"]))
        assert forbidden.status_code == 409
        assert forbidden.json()["code"] == "ACCEPTED_WITHDRAW_FORBIDDEN"

        customer_csrf = login(api, "customer-roman")
        refreshed = api.get(
            f"/api/v1/customer/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": customer_csrf},
        ).json()
        latest = next(entry for entry in refreshed if entry["id"] == str(retried["id"]))
        assert latest["status"] == "accepted"


def test_withdraw_blocks_foreign_application_and_demands_participant_role() -> None:
    api = client()
    with api:
        task_id = _published_case_task(api)
        applied = _apply(api, task_id, persona="participant-alex")
        application_id = str(applied["id"])

        stranger = _withdraw(api, application_id, persona="participant-igor")
        assert stranger.status_code == 404
        assert stranger.json()["code"] == "RESOURCE_NOT_FOUND"

        customer_csrf = login(api, "customer-roman")
        response = api.post(
            f"/api/v1/me/applications/{application_id}/withdraw",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert response.status_code == 403
        assert response.json()["code"] == "FORBIDDEN"
