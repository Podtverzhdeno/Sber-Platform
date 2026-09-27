"""Customer and operator task publication API scenarios."""

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import MemoryWorkStore, WorkService
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("work-api-test-secret-long-enough"),
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
            work_service=WorkService(MemoryWorkStore()),
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
    }


def test_task_without_nominated_mentor_waits_for_support_before_publish() -> None:
    api = client()
    with api:
        customer_csrf = login(api, "customer-roman")
        draft = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert draft.status_code == 200
        assert draft.json()["status"] == "draft"
        assert draft.json()["nominated_mentor_id"] is None
        task_id = draft.json()["id"]

        submitted = api.post(
            f"/api/v1/customer/tasks/{task_id}/submit",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert submitted.json()["status"] == "submitted"

        operator_csrf = login(api, "operator-pavel")
        moderated = api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert moderated.json()["status"] == "awaiting_support"

        blocked = api.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert blocked.status_code == 409
        assert blocked.json()["code"] == "TASK_NOT_PUBLISHABLE"
        assert "support" in blocked.json()["field_errors"]

        supported = api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator", "assignee_id": None},
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert supported.json()["status"] == "ready_to_publish"
        published = api.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        assert published.json()["status"] == "published"

        participant_csrf = login(api, "participant-alex")
        detail = api.get(f"/api/v1/marketplace/tasks/{task_id}")
        assert detail.status_code == 200
        accepted_version = detail.json()["terms"]["version"]
        assert detail.json()["terms"]["support_mode"] == "operator"

        customer_csrf = login(api, "customer-roman")
        revised = api.post(
            f"/api/v1/customer/tasks/{task_id}/terms",
            json={
                "deadline_at": "2026-11-05T18:00:00Z",
                "deliverable": "Обновлённый research document и MVP.",
                "acceptance_criteria": ["MVP воспроизводим", "Метрика согласована"],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revised.json()["version"] == accepted_version + 1

        participant_csrf = login(api, "participant-alex")
        stale = api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": accepted_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert stale.status_code == 409
        assert stale.json()["code"] == "TERMS_CHANGED"
        current = api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": revised.json()["version"]},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert current.json()["accepted_terms_version"] == revised.json()["version"]

        alex_application = api.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert alex_application.json()["status"] == "applied"

        maria_csrf = login(api, "participant-maria")
        api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": revised.json()["version"]},
            headers={"X-CSRF-Token": maria_csrf},
        )
        maria_application = api.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": maria_csrf},
        )

        customer_csrf = login(api, "customer-roman")
        candidates = api.get(f"/api/v1/customer/tasks/{task_id}/applications")
        assert len(candidates.json()) == 2
        accepted = api.post(
            f"/api/v1/customer/applications/{alex_application.json()['id']}/accept",
            json={"expected_version": alex_application.json()["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert accepted.json()["status"] == "staffed"

        stale_acceptance = api.post(
            f"/api/v1/customer/applications/{alex_application.json()['id']}/accept",
            json={"expected_version": alex_application.json()["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert stale_acceptance.status_code == 409
        assert stale_acceptance.json()["code"] == "STALE_APPLICATION"
        full = api.post(
            f"/api/v1/customer/applications/{maria_application.json()['id']}/accept",
            json={"expected_version": maria_application.json()["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert full.status_code == 409
        assert full.json()["code"] == "TASK_FULL"

        checkpoint = api.post(
            f"/api/v1/customer/tasks/{task_id}/checkpoints",
            json={"key": "rd-review", "title": "Проверка research document"},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert checkpoint.json()["status"] == "planned"
        team_artifact = api.post(
            f"/api/v1/customer/tasks/{task_id}/team-artifacts",
            json={"key": "team-repository", "uri": "https://example.test/team/repository"},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert team_artifact.status_code == 200

        participant_csrf = login(api, "participant-alex")
        started = api.post(
            f"/api/v1/me/assignments/{accepted.json()['id']}/start",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert started.json()["status"] == "in_progress"
        missing_personal = api.post(
            f"/api/v1/me/assignments/{accepted.json()['id']}/contributions",
            json={
                "personal_summary": "Сделал MVP",
                "artifacts": [
                    {
                        "key": "team-repository",
                        "uri": "https://example.test/team/repository",
                    }
                ],
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert missing_personal.status_code == 409
        assert missing_personal.json()["code"] == "PERSONAL_CONTRIBUTION_REQUIRED"
        contribution = api.post(
            f"/api/v1/me/assignments/{accepted.json()['id']}/contributions",
            json={
                "personal_summary": "Я реализовал API поиска и добавил измерение offline-метрики.",
                "artifacts": [
                    {
                        "key": "personal-api-proof",
                        "uri": "https://example.test/team/repository/commit/42",
                    }
                ],
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert contribution.status_code == 200
        assert contribution.json()["version"] == 1
        assert contribution.json()["artifact_keys"] == ["personal-api-proof"]


def test_incomplete_customer_brief_returns_missing_field_map() -> None:
    api = client()
    with api:
        csrf = login(api, "customer-roman")
        payload = brief()
        payload["acceptance_criteria"] = []
        draft = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=payload,
            headers={"X-CSRF-Token": csrf},
        )
        response = api.post(
            f"/api/v1/customer/tasks/{draft.json()['id']}/submit",
            headers={"X-CSRF-Token": csrf},
        )
    assert response.status_code == 409
    assert response.json()["code"] == "INCOMPLETE_TASK_BRIEF"
    assert list(response.json()["field_errors"]) == ["acceptance_criteria"]
