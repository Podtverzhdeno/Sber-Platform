"""Customer and operator task publication API scenarios."""
# ruff: noqa: RUF001

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
        assert detail.json()["terms"]["compensation"] == {
            "paid": True,
            "base_amount_per_assignee": "10000.00",
            "currency": "RUB",
            "b_multiplier": "1.5",
            "a_multiplier": "2.50",
            "b_total": "15000.00",
            "a_total": "25000.00",
            "quantum": "0.01",
            "rounding_mode": "half_up",
            "policy_version": 1,
            "payout_condition": "После принятия личного вклада и публикации оценки человеком.",
        }

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
        assert contribution.json()["status"] == "submitted"

        customer_csrf = login(api, "customer-roman")
        revision = api.post(
            f"/api/v1/customer/contributions/{contribution.json()['id']}/decision",
            json={
                "decision": "revision_requested",
                "reason": "Нужно приложить воспроизводимый отчёт с результатами метрики.",
                "deadline_at": "2026-11-10T18:00:00Z",
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revision.status_code == 200
        assert revision.json()["decision"] == "revision_requested"
        assert revision.json()["owner_id"] == accepted.json()["person_id"]

        participant_csrf = login(api, "participant-alex")
        restarted = api.post(
            f"/api/v1/me/assignments/{accepted.json()['id']}/start",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert restarted.json()["status"] == "in_progress"
        revised_contribution = api.post(
            f"/api/v1/me/assignments/{accepted.json()['id']}/contributions",
            json={
                "personal_summary": (
                    "Я дополнил API воспроизводимым отчётом и проверил расчёт метрики на фикстурах."
                ),
                "artifacts": [
                    {
                        "key": "personal-metric-report",
                        "uri": "https://example.test/team/repository/report/43",
                    }
                ],
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert revised_contribution.json()["version"] == 2

        customer_csrf = login(api, "customer-roman")
        accepted_result = api.post(
            f"/api/v1/customer/contributions/{revised_contribution.json()['id']}/decision",
            json={
                "decision": "accepted",
                "reason": "Результат соответствует критериям и отчёт воспроизводится.",
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert accepted_result.status_code == 200
        assert accepted_result.json()["decision"] == "accepted"
        assert accepted_result.json()["deadline_at"] is None

        participant_csrf = login(api, "participant-alex")
        dispute = api.post(
            f"/api/v1/me/contributions/{revised_contribution.json()['id']}/authorship-disputes",
            json={
                "reason": (
                    "Другой участник заявил авторство моего отчёта; прикладываю ссылки на коммиты."
                ),
                "deadline_at": "2026-11-12T18:00:00Z",
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert dispute.status_code == 200
        assert dispute.json()["status"] == "open"
        assert dispute.json()["owner"] == "operations"
        assert dispute.json()["review_blocked"] is True
        assert dispute.json()["payout_blocked"] is True
        visible = api.get(f"/api/v1/me/disputes/{dispute.json()['id']}")
        assert visible.status_code == 200
        assert visible.json()["deadline_at"] == "2026-11-12T18:00:00Z"
        my_work = api.get("/api/v1/me/work")
        assert my_work.status_code == 200
        assert my_work.json()[0]["assignment"]["id"] == accepted.json()["id"]
        assert [item["version"] for item in my_work.json()[0]["contributions"]] == [1, 2]
        assert [item["decision"] for item in my_work.json()[0]["decisions"]] == [
            "revision_requested",
            "accepted",
        ]

        login(api, "participant-maria")
        hidden = api.get(f"/api/v1/me/disputes/{dispute.json()['id']}")
        assert hidden.status_code == 404
        assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"

        login(api, "customer-roman")
        preview = api.get(f"/api/v1/customer/tasks/{task_id}/participant-preview")
        assert preview.status_code == 200
        assert preview.json()[0]["assignment"]["person_id"] == accepted.json()["person_id"]
        assert preview.json()[0]["contributions"][-1]["status"] == "disputed"


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


def test_manager_overview_contains_only_safe_owned_projection() -> None:
    api = client()
    with api:
        csrf = login(api, "manager-olga")
        switched = api.post(
            "/api/v1/me/active-role",
            json={"role": "customer"},
            headers={"X-CSRF-Token": csrf},
        )
        assert switched.status_code == 200
        draft = api.post(
            "/api/v1/customer/projects/manager-initiative/tasks",
            json={**brief(), "task_key": "manager-owned-task"},
            headers={"X-CSRF-Token": csrf},
        )
        assert draft.status_code == 200
        switched = api.post(
            "/api/v1/me/active-role",
            json={"role": "manager"},
            headers={"X-CSRF-Token": csrf},
        )
        assert switched.status_code == 200
        response = api.get("/api/v1/manager/overview")

    assert response.status_code == 200
    assert response.json()["task_count"] == 1
    assert response.json()["initiatives"][0]["project_key"] == "manager-initiative"
    serialized = response.text.lower()
    assert "chat" not in serialized
    assert "review" not in serialized
    assert "payout" not in serialized
