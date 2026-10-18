"""Participant task detail acceptance scenarios."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings

TEST_SECRET = SecretStr("task-detail-test-secret-long-enough")


def client(work_store: MemoryWorkStore | None = None) -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=TEST_SECRET,
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
        "task_key": "detail-rd",
        "title": "Проверить гипотезу семантического поиска",
        "problem": "Пользователю сложно найти подходящую программу.",
        "deliverable": "Research document и MVP поиска.",
        "acceptance_criteria": ["Есть offline-метрика", "MVP воспроизводим"],
        "deadline_at": "2026-11-01T18:00:00Z",
        "data_constraints": "Только синтетические данные.",
        "ip_terms": "Результат доступен заказчику после приёмки.",
        "nominated_mentor_id": None,
        "compensation": {
            "paid": False,
            "a_multiplier": "2.50",
            "quantum": "0.01",
            "rounding_mode": "half_up",
            "policy_version": 1,
            "payout_condition": "После принятия личного вклада и публикации оценки человеком.",
        },
    }


def publish_open_task(api: TestClient) -> str:
    customer_csrf = login(api, "customer-roman")
    created = api.post(
        "/api/v1/customer/projects/demo-rd-lab/tasks",
        json=brief(),
        headers={"X-CSRF-Token": customer_csrf},
    )
    assert created.status_code == 200
    task_id = created.json()["id"]

    assert (
        api.post(
            f"/api/v1/customer/tasks/{task_id}/submit",
            headers={"X-CSRF-Token": customer_csrf},
        ).status_code
        == 200
    )
    operator_csrf = login(api, "operator-pavel")
    assert (
        api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        ).status_code
        == 200
    )
    assert (
        api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        ).status_code
        == 200
    )
    published = api.post(
        f"/api/v1/operations/tasks/{task_id}/publish",
        headers={"X-CSRF-Token": operator_csrf},
    )
    assert published.status_code == 200
    return task_id


def test_task_detail_exposes_brief_terms_customer_and_history() -> None:
    api = client()
    with api:
        task_id = publish_open_task(api)

        login(api, "participant-alex")
        detail = api.get(f"/api/v1/me/tasks/{task_id}")
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["task"]["id"] == task_id
        assert payload["problem"] == brief()["problem"]
        assert payload["deliverable"] == brief()["deliverable"]
        assert payload["acceptance_criteria"] == brief()["acceptance_criteria"]
        assert payload["data_constraints"] == brief()["data_constraints"]
        assert payload["ip_terms"] == brief()["ip_terms"]
        last_version = payload["terms"]["version"]
        assert last_version >= 1
        history_versions = [row["version"] for row in payload["terms_history"]]
        assert history_versions == sorted(history_versions)
        assert history_versions[-1] == last_version
        assert payload["customer"]["display_name"] == "Роман Заказчик"
        assert payload["support"] is None
        assert payload["membership"] is None
        assert payload["team"] == []
        assert payload["checkpoints"] == []
        assert payload["personal"] == []
        assert payload["feedback"] == []


def test_task_detail_reveals_team_and_membership_after_assignment() -> None:
    api = client()
    with api:
        task_id = publish_open_task(api)

        participant_csrf = login(api, "participant-alex")
        terms_version = api.get(f"/api/v1/marketplace/tasks/{task_id}").json()["terms"]["version"]
        consent = api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": terms_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert consent.status_code == 200
        applied = api.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert applied.status_code == 200
        application_id = applied.json()["id"]

        assignments_before = api.get(f"/api/v1/me/tasks/{task_id}").json()["team"]
        assert assignments_before == []

        accepted = api.post(
            f"/api/v1/customer/applications/{application_id}/accept",
            json={"expected_version": 1},
            headers={"X-CSRF-Token": login(api, "customer-roman")},
        )
        assert accepted.status_code == 200
        assert accepted.json()["task_id"] == task_id

        login(api, "participant-alex")
        detail = api.get(f"/api/v1/me/tasks/{task_id}")
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["accepted_terms_version"] == terms_version
        assert payload["membership"]["person_id"] == payload["team"][0]["person_id"]
        assert payload["team"][0]["display_name"] == "Алекс Речной"
        assert payload["checkpoints"] == []
        assert payload["personal"] == []
        assert payload["feedback"] == []


def test_task_detail_hides_private_sections_from_unassigned_participants() -> None:
    api = client()
    with api:
        task_id = publish_open_task(api)

        login(api, "participant-maria")
        detail = api.get(f"/api/v1/me/tasks/{task_id}").json()
        assert detail["accepted_terms_version"] is None
        assert detail["membership"] is None
        assert detail["team"] == []
        assert detail["checkpoints"] == []
        assert detail["personal"] == []


def test_task_detail_is_not_found_for_unknown_task() -> None:
    api = client()
    with api:
        login(api, "participant-alex")
        missing = api.get("/api/v1/me/tasks/9e0a10f0-1111-4222-8333-444455556666")
        assert missing.status_code == 404


def test_task_detail_requires_session() -> None:
    assert client().get("/api/v1/me/tasks/9e0a10f0-1111-4222-8333-444455556666").status_code == 401
