"""Customer-signed project credential HTTP scenarios (rating-credentials spec)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def client() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("project-credential-test-secret-long"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(create_app(settings, auth_service=auth))


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200, response.json()
    return response.json()["csrf_token"]


def brief(nominated_mentor_id: str) -> dict[str, object]:
    return {
        "task_key": "semantic-search-rd",
        "title": "Проверить гипотезу семантического поиска",
        "problem": "Пользователю сложно найти подходящую программу.",
        "deliverable": "Research document и MVP поиска.",
        "acceptance_criteria": ["Есть offline-метрика", "MVP воспроизводим"],
        "deadline_at": "2026-11-01T18:00:00Z",
        "data_constraints": "Только синтетические данные.",
        "ip_terms": "Результат доступен заказчику после приёмки.",
        "nominated_mentor_id": nominated_mentor_id,
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


def review_payload(grade: str) -> dict[str, object]:
    from impulse.application.reward import DEFAULT_REVIEW_RUBRIC

    return {
        "rubric_id": str(DEFAULT_REVIEW_RUBRIC.rubric_id),
        "grade": grade,
        "draft_origin": "human",
        "explanation": "Проверяю личный вклад по критериям rubric.",
        "assessments": [
            {
                "criterion_key": criterion.key,
                "finding": f"Факт по критерию: {criterion.title}.",
                "evidence_refs": [f"artifact:{criterion.key}"],
            }
            for criterion in DEFAULT_REVIEW_RUBRIC.criteria
        ],
    }


def _submit_and_publish_task(api: TestClient, task_id: str) -> None:
    customer_csrf = login(api, "customer-roman")
    submitted = api.post(
        f"/api/v1/customer/tasks/{task_id}/submit",
        headers={"X-CSRF-Token": customer_csrf},
    )
    assert submitted.status_code == 200, submitted.json()
    operator_csrf = login(api, "operator-pavel")
    moderated = api.post(
        f"/api/v1/operations/tasks/{task_id}/moderate",
        headers={"X-CSRF-Token": operator_csrf},
    )
    assert moderated.status_code == 200, moderated.json()
    supported = api.post(
        f"/api/v1/operations/tasks/{task_id}/support",
        json={"mode": "operator", "assignee_id": None},
        headers={"X-CSRF-Token": operator_csrf},
    )
    assert supported.status_code == 200, supported.json()
    published = api.post(
        f"/api/v1/operations/tasks/{task_id}/publish",
        headers={"X-CSRF-Token": operator_csrf},
    )
    assert published.status_code == 200, published.json()


def _apply_and_accept(api: TestClient, task_id: str) -> str:
    participant_csrf = login(api, "participant-alex")
    detail = api.get(f"/api/v1/marketplace/tasks/{task_id}")
    assert detail.status_code == 200, detail.json()
    version = detail.json()["terms"]["version"]
    consented = api.post(
        f"/api/v1/me/tasks/{task_id}/terms-consent",
        json={"terms_version": version},
        headers={"X-CSRF-Token": participant_csrf},
    )
    assert consented.status_code == 200
    application = api.post(
        f"/api/v1/me/tasks/{task_id}/applications",
        headers={"X-CSRF-Token": participant_csrf},
    )
    assert application.status_code == 200
    customer_csrf = login(api, "customer-roman")
    accepted = api.post(
        f"/api/v1/customer/applications/{application.json()['id']}/accept",
        json={"expected_version": 1},
        headers={"X-CSRF-Token": customer_csrf},
    )
    assert accepted.status_code == 200, accepted.json()
    return accepted.json()["id"]


def _submit_contribution(api: TestClient, assignment_id: str) -> str:
    participant_csrf = login(api, "participant-alex")
    assert (
        api.post(
            f"/api/v1/me/assignments/{assignment_id}/start",
            headers={"X-CSRF-Token": participant_csrf},
        ).status_code
        == 200
    )
    contribution = api.post(
        f"/api/v1/me/assignments/{assignment_id}/contributions",
        json={
            "personal_summary": "Я реализовал API поиска и добавил измерение offline-метрики.",
            "artifacts": [
                {"key": "personal-api-proof", "uri": "https://example.test/repo/commit/42"}
            ],
        },
        headers={"X-CSRF-Token": participant_csrf},
    )
    assert contribution.status_code == 200, contribution.json()
    return contribution.json()["id"]


def _publish_review(api: TestClient, contribution_id: str, grade: str) -> str:
    mentor_csrf = login(api, "mentor-elena")
    draft = api.post(
        f"/api/v1/mentor/contributions/{contribution_id}/reviews",
        json=review_payload(grade),
        headers={"X-CSRF-Token": mentor_csrf},
    )
    assert draft.status_code == 200, draft.json()
    review_id = draft.json()["id"]
    proposed = api.post(
        f"/api/v1/mentor/reviews/{review_id}/propose",
        json={"expected_version": draft.json()["version"]},
        headers={"X-CSRF-Token": mentor_csrf},
    )
    confirmed = api.post(
        f"/api/v1/mentor/reviews/{review_id}/confirm",
        json={"expected_version": proposed.json()["version"]},
        headers={"X-CSRF-Token": mentor_csrf},
    )
    published = api.post(
        f"/api/v1/mentor/reviews/{review_id}/publish",
        json={"expected_version": confirmed.json()["version"]},
        headers={"X-CSRF-Token": mentor_csrf},
    )
    assert published.status_code == 200, published.json()
    return review_id


def test_project_credential_lifecycle() -> None:
    api = client()
    with api:
        mentor_id = next(item.person_id for item in demo_personas() if item.key == "mentor-elena")
        customer_csrf = login(api, "customer-roman")
        draft = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(str(mentor_id)),
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert draft.status_code == 200, draft.json()
        task_id = draft.json()["id"]

        _submit_and_publish_task(api, task_id)
        assignment_id = _apply_and_accept(api, task_id)
        _submit_contribution(api, assignment_id)

        participant_csrf = login(api, "participant-alex")
        work = api.get("/api/v1/me/work")
        assert work.status_code == 200
        item = work.json()[0]
        contribution_id = item["contributions"][-1]["id"]
        assert item["contributions"][-1]["status"] == "submitted"

        customer_csrf = login(api, "customer-roman")
        not_accepted = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert not_accepted.status_code == 409
        assert not_accepted.json()["code"] == "CONTRIBUTION_NOT_ACCEPTED"

        decision = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/decision",
            json={"decision": "accepted", "reason": "Результат соответствует критериям."},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert decision.status_code == 200

        missing_review = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert missing_review.status_code == 409
        assert missing_review.json()["code"] == "REVIEW_NOT_FOUND"

        _publish_review(api, contribution_id, "B")
        customer_csrf = login(api, "customer-roman")
        below_threshold = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert below_threshold.status_code == 409
        assert below_threshold.json()["code"] == "REVIEW_NOT_FIVE_PLUS"

        _publish_review(api, contribution_id, "A")
        customer_csrf = login(api, "customer-roman")
        signed = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert signed.status_code == 200, signed.json()
        document = signed.json()
        assert document["holder_name"] == "Алекс Речной"
        assert document["customer_name"] == "Роман Заказчик"
        assert document["task_key"] == "semantic-search-rd"
        assert document["project_key"] == "demo-rd-lab"
        assert document["artifact_keys"] == ["personal-api-proof"]
        assert document["grade_label"] == "Оценка A · соответствует 5+"
        assert len(document["competencies"]) == 3
        assert all(cell["evidence_refs"] for cell in document["competencies"])
        assert document["payment_status"] == "Оплачено"
        assert "10000" not in str(document["competencies"])
        assert document["status"] == "valid"
        assert document["superseded_by"] is None

        repeat = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert repeat.status_code == 200
        assert repeat.json()["verification_id"] == document["verification_id"]

        participant_csrf = login(api, "participant-alex")
        listed = api.get(
            "/api/v1/me/project-credentials", headers={"X-CSRF-Token": participant_csrf}
        )
        assert listed.status_code == 200
        assert [item["verification_id"] for item in listed.json()] == [document["verification_id"]]

        granted_consent = api.put(
            "/api/v1/me/consents/public_profile",
            json={"granted": True},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert granted_consent.status_code == 200
        public_page = api.get(f"/api/v1/project-credentials/{document['verification_id']}")
        assert public_page.status_code == 200
        assert public_page.json()["grade_label"] == "Оценка A · соответствует 5+"

        revoked_consent = api.put(
            "/api/v1/me/consents/public_profile",
            json={"granted": False},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert revoked_consent.status_code == 200
        hidden = api.get(f"/api/v1/project-credentials/{document['verification_id']}")
        assert hidden.status_code == 404
        assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"

        missing = api.get("/api/v1/project-credentials/proj-unknown")
        assert missing.status_code == 404

        forbidden = api.post(
            f"/api/v1/customer/contributions/{contribution_id}/credential",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert forbidden.status_code == 403
        assert forbidden.json()["code"] == "FORBIDDEN"
