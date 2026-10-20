"""Versioned deadline discussion API: propose keeps the deadline, approval moves it."""

from typing import Any

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client(work_store: MemoryWorkStore) -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("deadline-discussion-test-secret-long"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work = WorkService(work_store)
    return TestClient(
        create_app(
            settings,
            auth_service=auth,
            work_service=work,
        )
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def brief() -> dict[str, object]:
    return {
        "task_key": "deadline-discussion-case",
        "title": "Интеграция поиска с индексом документов",
        "problem": "Поиск не находит документы по смыслу.",
        "deliverable": "MVP семантического индекса.",
        "acceptance_criteria": ["Offline-метрика выше baseline", "Демо воспроизводимо"],
        "deadline_at": "2026-11-01T18:00:00Z",
        "data_constraints": "Синтетические данные.",
        "ip_terms": "Результат доступен заказчику.",
        "nominated_mentor_id": None,
        "compensation": {
            "paid": True,
            "base_amount_per_assignee": "10000.00",
            "currency": "RUB",
            "a_multiplier": "2.50",
            "quantum": "0.01",
            "rounding_mode": "half_up",
            "policy_version": 1,
            "payout_condition": "После приёмки личного вклада.",
        },
    }


def case_rubric() -> dict[str, object]:
    return {
        "version": 1,
        "result": "Рабочий и воспроизводимый результат",
        "reasoning": "Обоснование выбора подхода",
        "uncertainty": "Открытые вопросы и допущения",
        "ai_use": "Осмысленное использование ИИ",
        "defense": "Интеграция работает на демо",
    }


def publish_case(api: TestClient, customer_csrf: str, task_id: str) -> None:
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


def create_published_task(api: TestClient) -> str:
    customer_csrf = login(api, "customer-roman")
    task_id = api.post(
        "/api/v1/customer/projects/demo-rd-lab/tasks",
        json={
            **brief(),
            "task_key": "deadline-discussion-case",
            "competency_tags": ["NLP"],
            "case_rubric": case_rubric(),
        },
        headers={"X-CSRF-Token": customer_csrf},
    ).json()["id"]
    publish_case(api, customer_csrf, task_id)
    return task_id


def apply_for(api: TestClient, task_id: str, persona: str) -> str:
    customer_csrf = login(api, "customer-roman")
    terms_version = api.get(
        f"/api/v1/customer/tasks/{task_id}", headers={"X-CSRF-Token": customer_csrf}
    ).json()["terms"]["version"]
    csrf = login(api, persona)
    api.post(
        f"/api/v1/me/tasks/{task_id}/terms-consent",
        json={"terms_version": terms_version},
        headers={"X-CSRF-Token": csrf},
    )
    applied = api.post(f"/api/v1/me/tasks/{task_id}/applications", headers={"X-CSRF-Token": csrf})
    assert applied.status_code == 200
    return str(applied.json()["id"])


def accept_application(api: TestClient, task_id: str) -> dict[str, object]:
    customer_csrf = login(api, "customer-roman")
    applications = api.get(
        f"/api/v1/customer/tasks/{task_id}/applications",
        headers={"X-CSRF-Token": customer_csrf},
    ).json()
    application = next(item for item in applications if item["status"] == "applied")
    accepted = api.post(
        f"/api/v1/customer/applications/{application['id']}/accept",
        json={"expected_version": application["version"]},
        headers={"X-CSRF-Token": customer_csrf},
    )
    assert accepted.status_code == 200
    return accepted.json()


def current_terms(api: TestClient, task_id: str) -> dict[str, Any]:
    customer_csrf = login(api, "customer-roman")
    return api.get(
        f"/api/v1/customer/tasks/{task_id}", headers={"X-CSRF-Token": customer_csrf}
    ).json()["terms"]


def propose(
    api: TestClient,
    assignment_id: str,
    deadline: str,
    reason: str,
    base_terms_version: int,
    persona: str = "participant-alex",
):
    csrf = login(api, persona)
    return api.post(
        f"/api/v1/me/assignments/{assignment_id}/deadline-requests",
        json={
            "proposed_deadline_at": deadline,
            "reason": reason,
            "impact": "",
            "base_terms_version": base_terms_version,
        },
        headers={"X-CSRF-Token": csrf},
    )


def decide(
    api: TestClient,
    request_id: str,
    approve: bool,
    comment: str | None = None,
    persona: str = "customer-roman",
):
    csrf = login(api, persona)
    return api.post(
        f"/api/v1/customer/deadline-requests/{request_id}/decision",
        json={"approve": approve, "comment": comment},
        headers={"X-CSRF-Token": csrf},
    )


def test_proposal_keeps_deadline_until_human_decision() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        assert apply_for(api, task_id, "participant-alex")
        assignment = accept_application(api, task_id)
        assignment_id = str(assignment["id"])
        before = current_terms(api, task_id)
        base_version = before["version"]

        refreshed = propose(
            api,
            assignment_id,
            "2026-11-08T18:00:00Z",
            "Интеграция заняла больше времени.",
            base_version,
        )
        assert refreshed.status_code == 201
        body = refreshed.json()
        assert body["status"] == "pending"
        assert body["base_terms_version"] == base_version

        unchanged = current_terms(api, task_id)
        assert unchanged["version"] == before["version"]
        assert unchanged["deadline_at"] == before["deadline_at"]
        assert unchanged["compensation"] == before["compensation"]


def test_proposal_is_stale_once_terms_move_on() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        apply_for(api, task_id, "participant-alex")
        assignment = accept_application(api, task_id)
        assignment_id = str(assignment["id"])
        base_version = current_terms(api, task_id)["version"]

        customer_csrf = login(api, "customer-roman")
        revised = api.post(
            f"/api/v1/customer/tasks/{task_id}/terms",
            json={
                "deadline_at": "2026-11-15T18:00:00Z",
                "deliverable": "MVP семантического индекса.",
                "acceptance_criteria": ["Offline-метрика выше baseline"],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revised.status_code == 200
        next_version = revised.json()["version"]
        assert next_version == base_version + 1

        stale = propose(
            api,
            assignment_id,
            "2026-11-22T18:00:00Z",
            "Актуализация после переноса сроков.",
            base_version,
        )
        assert stale.status_code == 409
        assert stale.json()["code"] == "STALE_DEADLINE_CHANGE"

        refreshed = propose(
            api,
            assignment_id,
            "2026-11-22T18:00:00Z",
            "Актуализация после переноса сроков.",
            next_version,
        )
        assert refreshed.status_code == 201
        assert refreshed.json()["base_terms_version"] == next_version


def test_approval_bumps_terms_version_and_moves_deadline() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        apply_for(api, task_id, "participant-alex")
        assignment = accept_application(api, task_id)
        assignment_id = str(assignment["id"])
        base_version = current_terms(api, task_id)["version"]

        proposed = propose(
            api, assignment_id, "2026-11-08T18:00:00Z", "Нужна дополнительная неделя.", base_version
        )
        assert proposed.status_code == 201
        request_id = proposed.json()["id"]

        customer_feed = api.get(
            "/api/v1/me/notifications",
            headers={"X-CSRF-Token": login(api, "customer-roman")},
        ).json()
        assert any(item["kind"] == "deadline" for item in customer_feed["items"])

        decided = decide(api, request_id, True, "Согласовано с командой.")
        assert decided.status_code == 200
        body = decided.json()
        assert body["status"] == "approved"
        assert body["decision_comment"] == "Согласовано с командой."

        after = current_terms(api, task_id)
        assert after["version"] == base_version + 1
        assert after["deadline_at"] == "2026-11-08T18:00:00Z"

        mine = api.get(
            f"/api/v1/me/assignments/{assignment_id}/deadline-requests",
            headers={"X-CSRF-Token": login(api, "participant-alex")},
        ).json()
        assert [item["status"] for item in mine] == ["approved"]

        participant_feed = api.get(
            "/api/v1/me/notifications",
            headers={"X-CSRF-Token": login(api, "participant-alex")},
        ).json()
        assert any(item["kind"] == "deadline" for item in participant_feed["items"])


def test_rejection_keeps_deadline_and_comment_recorded() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        apply_for(api, task_id, "participant-alex")
        assignment = accept_application(api, task_id)
        assignment_id = str(assignment["id"])
        base_version = current_terms(api, task_id)["version"]

        proposed = propose(
            api, assignment_id, "2026-12-01T18:00:00Z", "Слишком плотная неделя.", base_version
        )
        assert proposed.status_code == 201
        request_id = proposed.json()["id"]

        rejected = decide(api, request_id, False, "Демо ждёт контакт.")
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"

        after = current_terms(api, task_id)
        assert after["version"] == base_version
        assert after["deadline_at"] == "2026-11-01T18:00:00Z"


def test_double_decision_role_and_foreign_assignment_guards() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        apply_for(api, task_id, "participant-alex")
        assignment = accept_application(api, task_id)
        assignment_id = str(assignment["id"])
        base_version = current_terms(api, task_id)["version"]

        proposed = propose(
            api, assignment_id, "2026-11-10T18:00:00Z", "Просьба команды.", base_version
        )
        assert proposed.status_code == 201
        request_id = proposed.json()["id"]

        duplicate = propose(
            api, assignment_id, "2026-11-11T18:00:00Z", "Второй запрос.", base_version
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "DEADLINE_CHANGE_PENDING"

        foreign = decide(api, request_id, True, None, persona="manager-olga")
        assert foreign.status_code == 403

        decided = decide(api, request_id, False, None)
        assert decided.status_code == 200
        assert decided.json()["status"] == "rejected"

        again = decide(api, request_id, True, None)
        assert again.status_code == 409
        assert again.json()["code"] == "INVALID_DEADLINE_CHANGE_TRANSITION"


def test_participant_without_assignment_cannot_discuss_deadline() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        task_id = create_published_task(api)
        assert apply_for(api, task_id, "participant-maria")

        ghost_assignment = "00000000-0000-0000-0000-000000000000"
        foreign = propose(
            api,
            ghost_assignment,
            "2026-11-10T18:00:00Z",
            "Попытка без назначения.",
            1,
            persona="participant-maria",
        )
        assert foreign.status_code == 404
