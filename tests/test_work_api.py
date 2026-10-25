"""Customer and operator task publication API scenarios."""

from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.application.work import (
    AssignmentRecord,
    ContributionRecord,
    MemoryWorkStore,
    WorkService,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.work import AssignmentStatus, ContributionStatus


def client(work_store: MemoryWorkStore | None = None) -> TestClient:
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


def test_customer_detail_contains_own_brief_and_hides_it_from_other_roles() -> None:
    api = client()
    with api:
        csrf = login(api, "customer-roman")
        draft = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": csrf},
        )
        assert draft.status_code == 200
        task_id = draft.json()["id"]
        detail = api.get(f"/api/v1/customer/tasks/{task_id}")
        assert detail.status_code == 200
        assert detail.json()["problem"] == brief()["problem"]
        assert detail.json()["terms"]["version"] == 1
        assert detail.json()["applications"] == []
        summary = api.get("/api/v1/customer/tasks")
        assert summary.status_code == 200
        assert summary.json()[0]["application_count"] == 0
        assert summary.json()[0]["pending_result_count"] == 0

        login(api, "participant-alex")
        hidden = api.get(f"/api/v1/customer/tasks/{task_id}")
        assert hidden.status_code in {403, 404}
        assert hidden.json().get("problem") is None


def test_passport_has_no_practical_level_without_confirmed_case() -> None:
    api = client()
    with api:
        login(api, "participant-alex")
        passport = api.get("/api/v1/me/talent-passport")
        assert passport.status_code == 200
        assert passport.json()["skills"] == []
        assert passport.json()["cases"] == []


def test_repeat_task_creates_fresh_draft_without_work_or_published_terms() -> None:
    api = client()
    with api:
        csrf = login(api, "customer-roman")
        original = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": csrf},
        ).json()
        repeated = api.post(
            f"/api/v1/customer/tasks/{original['id']}/repeat",
            json={"task_key": "semantic-search-rd-copy"},
            headers={"X-CSRF-Token": csrf},
        )
        assert repeated.status_code == 200
        copy = repeated.json()
        assert copy["id"] != original["id"]
        assert copy["status"] == "draft"
        assert copy["title"] == original["title"]
        detail = api.get(f"/api/v1/customer/tasks/{copy['id']}").json()
        assert detail["problem"] == brief()["problem"]
        assert detail["terms"]["version"] == 1
        assert detail["applications"] == []
        assert detail["assignments"] == []
        assert detail["contributions"] == []
        assert detail["decisions"] == []

        participant_csrf = login(api, "participant-alex")
        forbidden = api.post(
            f"/api/v1/customer/tasks/{original['id']}/repeat",
            json={"task_key": "unauthorized-copy"},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert forbidden.status_code in {403, 404}


def test_repeat_task_reinvites_strong_participant_after_fresh_consent() -> None:
    from uuid import UUID

    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        task_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={
                **brief(),
                "mode": "invitation_only",
                "competency_tags": ["nlp"],
                "case_rubric": case_rubric(),
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        customer_csrf = login(api, "customer-roman")
        source_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={
                **brief(),
                "task_key": "verified-nlp-result",
                "competency_tags": ["nlp"],
                "case_rubric": case_rubric(),
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{source_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{source_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        participant_csrf = login(api, "participant-alex")
        person_id = UUID(api.get("/api/v1/me").json()["person_id"])
        assignment_id, evidence_id = uuid4(), uuid4()
        store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
            assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
        )
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                evidence_id,
                assignment_id,
                1,
                "Личный вклад подтверждён заказчиком",
                ("proof",),
                ContributionStatus.ACCEPTED,
            ),
        )
        for scope in ("talent_profile", "talent_evidence", "talent_invitations"):
            assert (
                api.put(
                    f"/api/v1/me/consents/{scope}",
                    json={"granted": True},
                    headers={"X-CSRF-Token": participant_csrf},
                ).status_code
                == 200
            )
        customer_csrf = login(api, "customer-roman")
        request_id = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Нужен NLP инженер",
                "required_tags": ["nlp"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        command = {
            "person_id": str(person_id),
            "evidence_contribution_id": str(evidence_id),
            "request_id": request_id,
        }
        invitation_path = f"/api/v1/customer/tasks/{task_id}/invitations"
        customer_csrf = login(api, "customer-roman")
        first_invitation = api.post(
            invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf}
        )
        assert first_invitation.status_code == 200
        participant_csrf = login(api, "participant-alex")
        accepted = api.post(
            f"/api/v1/me/tasks/{task_id}/invitation",
            json={"accepted": True},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert accepted.json()["status"] == "accepted"
        version = api.get(f"/api/v1/marketplace/tasks/{task_id}").json()["terms"]["version"]
        api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert (
            api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": participant_csrf},
            ).json()["status"]
            == "applied"
        )
        customer_csrf = login(api, "customer-roman")
        repeated = api.post(
            f"/api/v1/customer/tasks/{task_id}/repeat",
            json={"task_key": "nlp-repeat"},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert repeated.status_code == 200
        copy = repeated.json()
        assert copy["status"] == "draft"
        detail = api.get(f"/api/v1/customer/tasks/{copy['id']}").json()
        assert detail["applications"] == []
        assert detail["assignments"] == []
        assert detail["decisions"] == []
        assert detail["terms"]["version"] == 1
        participant_csrf = login(api, "participant-alex")
        assert (
            api.put(
                "/api/v1/me/consents/talent_invitations",
                json={"granted": False},
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 200
        )
        customer_csrf = login(api, "customer-roman")
        api.post(
            f"/api/v1/customer/tasks/{copy['id']}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{copy['id']}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{copy['id']}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{copy['id']}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        customer_csrf = login(api, "customer-roman")
        assert (
            api.post(
                f"/api/v1/customer/tasks/{copy['id']}/invitations",
                json=command,
                headers={"X-CSRF-Token": customer_csrf},
            ).status_code
            == 404
        )
        participant_csrf = login(api, "participant-alex")
        assert (
            api.post(
                f"/api/v1/me/tasks/{copy['id']}/terms-consent",
                json={"terms_version": version},
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 404
        )
        assert (
            api.put(
                "/api/v1/me/consents/talent_invitations",
                json={"granted": True},
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 200
        )
        customer_csrf = login(api, "customer-roman")
        reinvited = api.post(
            f"/api/v1/customer/tasks/{copy['id']}/invitations",
            json=command,
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert reinvited.status_code == 200
        assert reinvited.json()["status"] == "pending"
        assert api.get(f"/api/v1/customer/tasks/{copy['id']}").json()["assignments"] == []


def test_invitation_only_task_is_hidden_without_invitation() -> None:
    api = client()
    with api:
        customer_csrf = login(api, "customer-roman")
        request = {**brief(), "mode": "invitation_only"}
        created = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=request,
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert created.status_code == 200
        assert created.json()["mode"] == "invitation_only"
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
        assert (
            api.post(
                f"/api/v1/operations/tasks/{task_id}/publish",
                headers={"X-CSRF-Token": operator_csrf},
            ).status_code
            == 200
        )
        participant_csrf = login(api, "participant-alex")
        listing = api.get("/api/v1/marketplace/tasks")
        assert listing.status_code == 200
        assert task_id not in {item["task"]["id"] for item in listing.json()}
        assert api.get(f"/api/v1/marketplace/tasks/{task_id}").status_code == 404
        assert (
            api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 404
        )
        assert (
            api.post(
                f"/api/v1/me/tasks/{task_id}/terms-consent",
                json={"terms_version": 1},
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 404
        )


def test_published_case_rubric_version_survives_task_start() -> None:
    api = client()
    with api:
        customer_csrf = login(api, "customer-roman")
        created = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={**brief(), "case_rubric": case_rubric()},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert created.status_code == 200
        assert created.json()["case_rubric"]["version"] == 1
        task_id = created.json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        customer_csrf = login(api, "customer-roman")
        detail = api.get(f"/api/v1/customer/tasks/{task_id}").json()
        assert detail["task"]["status"] == "published"
        assert detail["task"]["case_rubric"]["version"] == 1
        repeat = api.post(
            f"/api/v1/customer/tasks/{task_id}/repeat",
            json={"task_key": "case-rubric-repeat"},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert repeat.status_code == 200
        assert repeat.json()["case_rubric"]["version"] == 1


def test_closed_invitation_checks_consent_evidence_and_is_idempotent() -> None:
    from uuid import UUID

    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        task_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={**brief(), "mode": "invitation_only"},
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        customer_csrf = login(api, "customer-roman")
        source_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={
                **brief(),
                "task_key": "verified-nlp-case",
                "competency_tags": ["nlp"],
                "case_rubric": case_rubric(),
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{source_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{source_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        participant_csrf = login(api, "participant-alex")
        person_id = UUID(api.get("/api/v1/me").json()["person_id"])
        evidence_id, assignment_id = uuid4(), uuid4()
        store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
            assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
        )
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                evidence_id,
                assignment_id,
                1,
                "Личный вклад подтверждён заказчиком",
                ("proof",),
                ContributionStatus.ACCEPTED,
            ),
        )
        customer_csrf = login(api, "customer-roman")
        request_id = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Нужен NLP инженер",
                "required_tags": ["nlp"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        command = {
            "person_id": str(person_id),
            "evidence_contribution_id": str(evidence_id),
            "request_id": request_id,
        }
        invitation_path = f"/api/v1/customer/tasks/{task_id}/invitations"
        customer_csrf = login(api, "customer-roman")
        assert (
            api.post(
                invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf}
            ).status_code
            == 404
        )
        participant_csrf = login(api, "participant-alex")
        for scope in ("talent_profile", "talent_evidence", "talent_invitations"):
            assert (
                api.put(
                    f"/api/v1/me/consents/{scope}",
                    json={"granted": True},
                    headers={"X-CSRF-Token": participant_csrf},
                ).status_code
                == 200
            )
        customer_csrf = login(api, "customer-roman")
        first = api.post(invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf})
        second = api.post(invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf})
        assert first.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        participant_csrf = login(api, "participant-alex")
        detail = api.get(f"/api/v1/marketplace/tasks/{task_id}")
        assert detail.json()["invitation_status"] == "pending"
        assert (
            api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": participant_csrf},
            ).status_code
            == 409
        )
        accepted = api.post(
            f"/api/v1/me/tasks/{task_id}/invitation",
            json={"accepted": True},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert accepted.json()["status"] == "accepted"
        version = detail.json()["terms"]["version"]
        api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert (
            api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": participant_csrf},
            ).json()["status"]
            == "applied"
        )
        customer_csrf = login(api, "customer-roman")
        revoked = api.post(
            f"/api/v1/customer/tasks/{task_id}/invitations/{person_id}/revoke",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revoked.json()["status"] == "revoked"
        login(api, "participant-alex")
        assert api.get(f"/api/v1/marketplace/tasks/{task_id}").status_code == 404


def test_team_request_matches_only_confirmed_relevant_cases_with_consent() -> None:
    from uuid import UUID

    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        source = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={**brief(), "competency_tags": ["Python", "NLP"], "case_rubric": case_rubric()},
            headers={"X-CSRF-Token": customer_csrf},
        ).json()
        source_id = source["id"]
        api.post(
            f"/api/v1/customer/tasks/{source_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{source_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        participant_csrf = login(api, "participant-alex")
        person_id = UUID(api.get("/api/v1/me").json()["person_id"])
        assignment_id, contribution_id = uuid4(), uuid4()
        store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
            assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
        )
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                contribution_id,
                assignment_id,
                1,
                "Решил кейс с воспроизводимым кодом",
                ("notebook",),
                ContributionStatus.ACCEPTED,
            ),
        )
        passport = api.get("/api/v1/me/talent-passport")
        assert passport.status_code == 200
        assert {item["key"] for item in passport.json()["skills"]} == {"nlp", "python"}
        assert passport.json()["cases"][0]["contribution_id"] == str(contribution_id)
        customer_csrf = login(api, "customer-roman")
        request = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Ищем NLP инженера",
                "required_tags": ["NLP"],
                "preferred_tags": ["Python"],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert request.status_code == 200
        request_id = request.json()["id"]
        matches_path = f"/api/v1/customer/team-requests/{request_id}/matches"
        assert api.get(matches_path).json() == []
        participant_csrf = login(api, "participant-alex")
        for scope in ("talent_profile", "talent_evidence"):
            api.put(
                f"/api/v1/me/consents/{scope}",
                json={"granted": True},
                headers={"X-CSRF-Token": participant_csrf},
            )
        login(api, "customer-roman")
        matches = api.get(matches_path).json()
        assert len(matches) == 1
        assert matches[0]["person_id"] == str(person_id)
        assert matches[0]["matched_required"] == ["nlp"]
        assert matches[0]["matched_preferred"] == ["python"]
        assert matches[0]["evidence"][0]["contribution_id"] == str(contribution_id)
        saved_path = f"/api/v1/customer/team-requests/{request_id}/saved/{person_id}"
        customer_csrf = login(api, "customer-roman")
        saved = api.post(saved_path, headers={"X-CSRF-Token": customer_csrf})
        duplicate = api.post(saved_path, headers={"X-CSRF-Token": customer_csrf})
        assert saved.status_code == 200
        assert saved.json()["id"] == duplicate.json()["id"]
        assert len(api.get("/api/v1/customer/saved-candidates").json()) == 1
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                contribution_id,
                assignment_id,
                1,
                "Решил кейс с воспроизводимым кодом",
                ("notebook",),
                ContributionStatus.DISPUTED,
            ),
        )
        assert api.get(matches_path).json() == []
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                contribution_id,
                assignment_id,
                1,
                "Решил кейс с воспроизводимым кодом",
                ("notebook",),
                ContributionStatus.ACCEPTED,
            ),
        )
        maria_csrf = login(api, "participant-maria")
        for scope in ("talent_profile", "talent_evidence"):
            api.put(
                f"/api/v1/me/consents/{scope}",
                json={"granted": True},
                headers={"X-CSRF-Token": maria_csrf},
            )
        login(api, "customer-roman")
        assert len(api.get(matches_path).json()) == 1
        customer_csrf = login(api, "customer-roman")
        revised = api.put(
            f"/api/v1/customer/team-requests/{request_id}",
            json={
                "title": "Ищем CV инженера",
                "required_tags": ["CV"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revised.json()["version"] == 2
        assert api.get(matches_path).json() == []
        restored = api.put(
            f"/api/v1/customer/team-requests/{request_id}",
            json={
                "title": "Ищем NLP инженера",
                "required_tags": ["NLP"],
                "preferred_tags": ["Python"],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert restored.json()["version"] == 3
        assert len(api.get(matches_path).json()) == 1
        participant_csrf = login(api, "participant-alex")
        api.put(
            "/api/v1/me/consents/talent_evidence",
            json={"granted": False},
            headers={"X-CSRF-Token": participant_csrf},
        )
        login(api, "customer-roman")
        assert api.get(matches_path).json() == []
        assert api.get("/api/v1/customer/saved-candidates").json() == []


def test_passport_exposes_fix_history_freshness_and_last_confirmed() -> None:
    from uuid import UUID

    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        source = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={**brief(), "competency_tags": ["Python", "NLP"], "case_rubric": case_rubric()},
            headers={"X-CSRF-Token": customer_csrf},
        ).json()
        source_id = source["id"]
        api.post(
            f"/api/v1/customer/tasks/{source_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{source_id}/moderate",
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{source_id}/publish", headers={"X-CSRF-Token": operator_csrf}
        )
        login(api, "participant-alex")
        person_id = UUID(api.get("/api/v1/me").json()["person_id"])
        assignment_id, revision_id, contribution_id = uuid4(), uuid4(), uuid4()
        store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
            assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
        )
        store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                revision_id,
                assignment_id,
                1,
                "Требуется доработка метрик",
                (),
                ContributionStatus.REVISION_REQUESTED,
            ),
            ContributionRecord(
                contribution_id,
                assignment_id,
                2,
                "Решил кейс с воспроизводимым кодом",
                ("notebook",),
                ContributionStatus.ACCEPTED,
            ),
        )
        passport = api.get("/api/v1/me/talent-passport")
        assert passport.status_code == 200
        data = passport.json()
        assert [case["contribution_id"] for case in data["cases"]] == [str(contribution_id)]
        assert data["cases"][0]["case_fixes"] == 1
        assert data["cases"][0]["freshness"] == "current"
        assert data["skills"][0]["practical_level"] == "confirmed"
        assert data["skills"][0]["last_confirmed_at"] is not None


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
        customer_detail = api.get(f"/api/v1/customer/tasks/{task_id}")
        assert customer_detail.status_code == 200
        assert any(item["decision"] == "accepted" for item in customer_detail.json()["decisions"])
        customer_summary = api.get("/api/v1/customer/tasks").json()[0]
        assert customer_summary["application_count"] == 2
        assert customer_summary["assignment_count"] == 1
        assert customer_summary["accepted_result_count"] == 1
        assert customer_summary["pending_result_count"] == 0

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


def _publish_case(api: TestClient, customer_csrf: str, source_id: str) -> None:
    api.post(f"/api/v1/customer/tasks/{source_id}/submit", headers={"X-CSRF-Token": customer_csrf})
    operator_csrf = login(api, "operator-pavel")
    api.post(
        f"/api/v1/operations/tasks/{source_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
    )
    api.post(
        f"/api/v1/operations/tasks/{source_id}/support",
        json={"mode": "operator"},
        headers={"X-CSRF-Token": operator_csrf},
    )
    api.post(
        f"/api/v1/operations/tasks/{source_id}/publish", headers={"X-CSRF-Token": operator_csrf}
    )


def test_match_view_is_explainable_versioned_and_deterministic() -> None:
    from uuid import UUID

    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        source = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json={**brief(), "competency_tags": ["Python", "NLP"], "case_rubric": case_rubric()},
            headers={"X-CSRF-Token": customer_csrf},
        ).json()
        source_id = source["id"]
        _publish_case(api, customer_csrf, source_id)
        matched_ids: list[str] = []
        for persona in ("participant-alex", "participant-maria"):
            csrf = login(api, persona)
            person_id = UUID(api.get("/api/v1/me").json()["person_id"])
            matched_ids.append(str(person_id))
            assignment_id, contribution_id = uuid4(), uuid4()
            store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
                assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
            )
            store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
                ContributionRecord(
                    contribution_id,
                    assignment_id,
                    1,
                    "Решил кейс с воспроизводимым кодом",
                    ("notebook",),
                    ContributionStatus.ACCEPTED,
                ),
            )
            for scope in ("talent_profile", "talent_evidence"):
                assert (
                    api.put(
                        f"/api/v1/me/consents/{scope}",
                        json={"granted": True},
                        headers={"X-CSRF-Token": csrf},
                    ).status_code
                    == 200
                )
        customer_csrf = login(api, "customer-roman")
        command = {
            "title": "Ищем NLP инженера",
            "required_tags": ["NLP"],
            "preferred_tags": ["Python"],
            "relevant_case_task_ids": [source_id],
        }
        request_id = api.post(
            "/api/v1/customer/team-requests", json=command, headers={"X-CSRF-Token": customer_csrf}
        ).json()["id"]
        matches_path = f"/api/v1/customer/team-requests/{request_id}/matches"
        matches = api.get(matches_path).json()
        assert len(matches) == 2
        person_ids = [item["person_id"] for item in matches]
        assert person_ids == sorted(person_ids)
        assert sorted(person_ids) == sorted(matched_ids)
        assert matches[0]["request_version"] == 1
        assert set(matches[0]) == {
            "person_id",
            "display_name",
            "request_version",
            "matched_required",
            "matched_preferred",
            "evidence",
        }
        assert set(matches[0]["evidence"][0]) == {
            "task_id",
            "contribution_id",
            "personal_summary",
            "competency_tags",
            "artifact_keys",
            "submitted_at",
            "reviewer_id",
            "case_fixes",
            "freshness",
        }
        revised = api.put(
            f"/api/v1/customer/team-requests/{request_id}",
            json=command,
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert revised.json()["version"] == 2
        assert api.get(matches_path).json()[0]["request_version"] == 2


def test_customer_task_object_level_blocks_foreign_customers() -> None:
    api = client()
    with api:
        csrf = login(api, "customer-roman")
        task_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": csrf},
        ).json()["id"]
        foreign_csrf = login(api, "manager-olga")
        switched = api.post(
            "/api/v1/me/active-role",
            json={"role": "customer"},
            headers={"X-CSRF-Token": foreign_csrf},
        )
        assert switched.status_code == 200
        assert api.get(f"/api/v1/customer/tasks/{task_id}").status_code == 404
        stranger = str(uuid4())
        response = api.post(
            f"/api/v1/customer/tasks/{task_id}/invitations",
            json={
                "person_id": stranger,
                "evidence_contribution_id": stranger,
                "request_id": stranger,
            },
            headers={"X-CSRF-Token": foreign_csrf},
        )
        assert response.status_code == 404


def _invitation_only_task(api: TestClient, customer_csrf: str, places: int = 1) -> str:
    task_id = api.post(
        "/api/v1/customer/projects/demo-rd-lab/tasks",
        json={**brief(), "mode": "invitation_only", "places": places},
        headers={"X-CSRF-Token": customer_csrf},
    ).json()["id"]
    _publish_case(api, customer_csrf, task_id)
    return task_id


def _published_case_task(api: TestClient, key: str) -> str:
    customer_csrf = login(api, "customer-roman")
    source_id = api.post(
        "/api/v1/customer/projects/demo-rd-lab/tasks",
        json={
            **brief(),
            "task_key": key,
            "competency_tags": ["NLP"],
            "case_rubric": case_rubric(),
        },
        headers={"X-CSRF-Token": customer_csrf},
    ).json()["id"]
    _publish_case(api, customer_csrf, source_id)
    return source_id


def _inject_case_evidence(
    store: MemoryWorkStore, api: TestClient, persona: str, source_id: str
) -> tuple[str, str]:
    from uuid import UUID

    csrf = login(api, persona)
    person_id = UUID(api.get("/api/v1/me").json()["person_id"])
    assignment_id, contribution_id = uuid4(), uuid4()
    store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
        assignment_id, UUID(source_id), person_id, uuid4(), AssignmentStatus.ACCEPTED
    )
    store._contributions[assignment_id] = (  # pyright: ignore[reportPrivateUsage]
        ContributionRecord(
            contribution_id,
            assignment_id,
            1,
            "Решил кейс с воспроизводимым кодом",
            ("proof",),
            ContributionStatus.ACCEPTED,
        ),
    )
    for scope in ("talent_profile", "talent_evidence", "talent_invitations"):
        assert (
            api.put(
                f"/api/v1/me/consents/{scope}",
                json={"granted": True},
                headers={"X-CSRF-Token": csrf},
            ).status_code
            == 200
        )
    return str(person_id), str(contribution_id)


def test_invitation_decline_expiry_and_reinvitation() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        task_id = _invitation_only_task(api, customer_csrf)
        source_id = _published_case_task(api, "invitation-source-case")
        person_id, evidence_id = _inject_case_evidence(store, api, "participant-alex", source_id)
        customer_csrf = login(api, "customer-roman")
        request_id = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Ищем NLP инженера",
                "required_tags": ["NLP"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        invitation_path = f"/api/v1/customer/tasks/{task_id}/invitations"
        command = {
            "person_id": person_id,
            "evidence_contribution_id": evidence_id,
            "request_id": request_id,
        }
        expired = api.post(
            invitation_path,
            json={**command, "expires_at": "2025-01-01T00:00:00Z"},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert expired.status_code == 409
        assert expired.json()["code"] == "INVITATION_EXPIRED"
        first = api.post(invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf})
        assert first.status_code == 200
        assert first.json()["status"] == "pending"
        login(api, "participant-alex")
        declined = api.post(
            f"/api/v1/me/tasks/{task_id}/invitation",
            json={"accepted": False},
            headers={"X-CSRF-Token": login(api, "participant-alex")},
        )
        assert declined.json()["status"] == "declined"
        assert api.get(f"/api/v1/marketplace/tasks/{task_id}").status_code == 404
        customer_csrf = login(api, "customer-roman")
        again = api.post(invitation_path, json=command, headers={"X-CSRF-Token": customer_csrf})
        assert again.status_code == 200
        assert again.json()["status"] == "pending"
        assert again.json()["id"] == first.json()["id"]
        login(api, "participant-alex")
        assert api.get(f"/api/v1/marketplace/tasks/{task_id}").status_code == 200


def test_invited_results_compare_on_single_published_rubric() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        task_id = _invitation_only_task(api, customer_csrf, places=2)
        source_id = _published_case_task(api, "closed-compare-case")
        candidates: list[tuple[str, str, str]] = []
        for persona in ("participant-alex", "participant-maria"):
            person_id, evidence_id = _inject_case_evidence(store, api, persona, source_id)
            candidates.append((persona, person_id, evidence_id))
        customer_csrf = login(api, "customer-roman")
        request_id = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Ищем NLP инженера",
                "required_tags": ["NLP"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        for persona, person_id, evidence_id in candidates:
            customer_csrf = login(api, "customer-roman")
            invited = api.post(
                f"/api/v1/customer/tasks/{task_id}/invitations",
                json={
                    "person_id": person_id,
                    "evidence_contribution_id": evidence_id,
                    "request_id": request_id,
                },
                headers={"X-CSRF-Token": customer_csrf},
            )
            assert invited.status_code == 200
            participant_csrf = login(api, persona)
            terms_version = api.get(f"/api/v1/marketplace/tasks/{task_id}").json()["terms"][
                "version"
            ]
            accepted = api.post(
                f"/api/v1/me/tasks/{task_id}/invitation",
                json={"accepted": True},
                headers={"X-CSRF-Token": participant_csrf},
            )
            assert accepted.json()["status"] == "accepted"
            api.post(
                f"/api/v1/me/tasks/{task_id}/terms-consent",
                json={"terms_version": terms_version},
                headers={"X-CSRF-Token": participant_csrf},
            )
            applied = api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": participant_csrf},
            )
            assert applied.json()["status"] == "applied"
            application_id, application_version = (
                applied.json()["id"],
                applied.json()["version"],
            )
            customer_csrf = login(api, "customer-roman")
            assignment = api.post(
                f"/api/v1/customer/applications/{application_id}/accept",
                json={"expected_version": application_version},
                headers={"X-CSRF-Token": customer_csrf},
            )
            assert assignment.status_code == 200
            assignment_id = assignment.json()["id"]
            participant_csrf = login(api, persona)
            api.post(
                f"/api/v1/me/assignments/{assignment_id}/start",
                headers={"X-CSRF-Token": participant_csrf},
            )
            submitted = api.post(
                f"/api/v1/me/assignments/{assignment_id}/contributions",
                json={
                    "personal_summary": f"Собственный вклад {persona}: ввод прототипа и замеры.",
                    "artifacts": [{"key": "repo", "uri": "https://cdn.example.com/artifact.zip"}],
                },
                headers={"X-CSRF-Token": participant_csrf},
            )
            assert submitted.status_code == 200
        customer_csrf = login(api, "customer-roman")
        source_detail = api.get(f"/api/v1/customer/tasks/{source_id}").json()
        assert source_detail["task"]["case_rubric"]["version"] == 1
        preview = api.get(f"/api/v1/customer/tasks/{task_id}/participant-preview").json()
        summaries = {item["contributions"][0]["personal_summary"] for item in preview}
        assert len(preview) == 2
        assert len(summaries) == 2
        pipeline = api.get("/api/v1/hr/pipeline")
        assert pipeline.status_code == 404
        login(api, "hr-nina")
        counts = api.get("/api/v1/hr/pipeline").json()["counts"]
        assert counts == {"invitation": 0, "interview": 0, "offer": 0, "hire": 0}


def test_application_selection_shows_honest_participant_experience() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        source_id = _published_case_task(api, "selection-case")
        _inject_case_evidence(store, api, "participant-alex", source_id)
        customer_csrf = login(api, "customer-roman")
        task_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        _publish_case(api, customer_csrf, task_id)
        customer_csrf = login(api, "customer-roman")
        terms_version = api.get(f"/api/v1/customer/tasks/{task_id}").json()["terms"]["version"]
        for persona in ("participant-alex", "participant-igor"):
            csrf = login(api, persona)
            consented = api.post(
                f"/api/v1/me/tasks/{task_id}/terms-consent",
                json={"terms_version": terms_version},
                headers={"X-CSRF-Token": csrf},
            )
            assert consented.status_code == 200
            applied = api.post(
                f"/api/v1/me/tasks/{task_id}/applications",
                headers={"X-CSRF-Token": csrf},
            )
            assert applied.status_code == 200
            assert applied.json()["status"] == "applied"

        customer_csrf = login(api, "customer-roman")
        applications = api.get(f"/api/v1/customer/tasks/{task_id}/applications").json()
        assert len(applications) == 2
        verified = {
            entry["participant_name"]: entry["verified_case_count"] for entry in applications
        }
        assert verified["Алекс Речной"] == 1
        assert verified["Игорь Лесной"] == 0
        novice = next(entry for entry in applications if entry["verified_case_count"] == 0)
        assert novice["participant_name"] == "Игорь Лесной"

        assignment = api.post(
            f"/api/v1/customer/applications/{novice['id']}/accept",
            json={"expected_version": novice["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert assignment.status_code == 200
        assert assignment.json()["status"] == "staffed"
        refreshed = api.get(f"/api/v1/customer/tasks/{task_id}/applications").json()
        accepted_entry = next(entry for entry in refreshed if entry["id"] == novice["id"])
        assert accepted_entry["status"] == "accepted"


def test_cabinet_matches_verified_candidates_only_and_foreign_task_invite_forbidden() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        source_id = _published_case_task(api, "cabinet-source-case")

        alex_id, alex_evidence = _inject_case_evidence(store, api, "participant-alex", source_id)
        from uuid import UUID

        login(api, "participant-maria")
        maria_id = UUID(api.get("/api/v1/me").json()["person_id"])
        maria_assignment, maria_contribution = uuid4(), uuid4()
        store._assignments[maria_assignment] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
            maria_assignment, UUID(source_id), maria_id, uuid4(), AssignmentStatus.ACCEPTED
        )
        store._contributions[maria_assignment] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                maria_contribution,
                maria_assignment,
                1,
                "Решил кейс без согласия",
                ("notebook",),
                ContributionStatus.ACCEPTED,
            ),
        )

        customer_csrf = login(api, "customer-roman")
        request_id = api.post(
            "/api/v1/customer/team-requests",
            json={
                "title": "Ищем NLP инженера",
                "required_tags": ["NLP"],
                "preferred_tags": [],
                "relevant_case_task_ids": [source_id],
            },
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        matches = api.get(f"/api/v1/customer/team-requests/{request_id}/matches").json()
        assert [entry["person_id"] for entry in matches] == [alex_id]
        assert matches[0]["evidence"][0]["contribution_id"] == alex_evidence

        task_id = _invitation_only_task(api, customer_csrf)
        olga = login(api, "manager-olga")
        switched = api.post(
            "/api/v1/me/active-role", json={"role": "customer"}, headers={"X-CSRF-Token": olga}
        )
        assert switched.status_code == 200
        foreign = api.post(
            f"/api/v1/customer/tasks/{task_id}/invitations",
            json={
                "person_id": alex_id,
                "evidence_contribution_id": alex_evidence,
                "request_id": request_id,
            },
            headers={"X-CSRF-Token": olga},
        )
        assert foreign.status_code == 404
        assert foreign.json()["code"] == "RESOURCE_NOT_FOUND"

        granted = api.post(
            f"/api/v1/customer/tasks/{task_id}/invitations",
            json={
                "person_id": alex_id,
                "evidence_contribution_id": alex_evidence,
                "request_id": request_id,
            },
            headers={"X-CSRF-Token": login(api, "customer-roman")},
        )
        assert granted.status_code == 200
        assert granted.json()["status"] == "pending"


def test_acceptance_flow_asks_artifact_allowlist_and_avoids_automatic_rewards() -> None:
    store = MemoryWorkStore()
    api = client(store)
    with api:
        customer_csrf = login(api, "customer-roman")
        payload = brief()
        payload["allowed_artifacts"] = ["repo", "report"]
        task_id = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=payload,
            headers={"X-CSRF-Token": customer_csrf},
        ).json()["id"]
        _publish_case(api, customer_csrf, task_id)
        customer_csrf = login(api, "customer-roman")
        detail = api.get(f"/api/v1/customer/tasks/{task_id}").json()
        assert detail["allowed_artifacts"] == ["repo", "report"]
        terms_version = detail["terms"]["version"]

        participant_csrf = login(api, "participant-alex")
        participant = api.get(f"/api/v1/marketplace/tasks/{task_id}")
        assert participant.status_code == 200
        assert participant.json()["allowed_artifacts"] == ["repo", "report"]
        consenting = api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": terms_version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert consenting.status_code == 200
        applied = api.post(
            f"/api/v1/me/tasks/{task_id}/applications", headers={"X-CSRF-Token": participant_csrf}
        )
        assert applied.status_code == 200

        accepted = api.post(
            f"/api/v1/customer/applications/{applied.json()['id']}/accept",
            json={"expected_version": applied.json()["version"]},
            headers={"X-CSRF-Token": login(api, "customer-roman")},
        )
        assert accepted.status_code == 200
        assignment_id = accepted.json()["id"]

        participant_csrf = login(api, "participant-alex")
        started = api.post(
            f"/api/v1/me/assignments/{assignment_id}/start",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert started.json()["status"] == "in_progress"
        forbidden_artifact = api.post(
            f"/api/v1/me/assignments/{assignment_id}/contributions",
            json={
                "personal_summary": (
                    "Я реализовал API поиска и приложил архив рабочего прототипа."
                ),
                "artifacts": [{"key": "zip", "uri": "https://example.test/prototypes/build.zip"}],
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert forbidden_artifact.status_code == 409
        assert forbidden_artifact.json()["code"] == "ARTIFACT_NOT_ALLOWED"

        contribution = api.post(
            f"/api/v1/me/assignments/{assignment_id}/contributions",
            json={
                "personal_summary": (
                    "Я реализовал API поиска и добавил измерение offline-метрики."
                ),
                "artifacts": [
                    {
                        "key": "repo",
                        "uri": "https://example.test/team/repository/commit/42",
                    }
                ],
            },
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert contribution.status_code == 200
        assert contribution.json()["version"] == 1

        accepted_result = api.post(
            f"/api/v1/customer/contributions/{contribution.json()['id']}/decision",
            json={
                "decision": "accepted",
                "reason": "Результат соответствует критериям приёмки.",
            },
            headers={"X-CSRF-Token": login(api, "customer-roman")},
        )
        assert accepted_result.status_code == 200
        assert accepted_result.json()["decision"] == "accepted"

        participant_csrf = login(api, "participant-alex")
        evidence = api.get("/api/v1/me/reward-evidence")
        assert evidence.status_code == 200
        assert evidence.json() == []

        credential = api.post(
            f"/api/v1/customer/contributions/{contribution.json()['id']}/credential"
        )
        assert credential.status_code in {403, 401}

        customer_csrf = login(api, "customer-roman")
        credential = api.post(
            f"/api/v1/customer/contributions/{contribution.json()['id']}/credential",
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert credential.status_code == 409
        assert credential.json()["code"] == "REVIEW_NOT_FOUND"

        metrics = {
            item["key"]: item for item in api.get("/api/v1/analytics/role").json()["metrics"]
        }
        assert metrics["customer_acceptance_rate"]["numerator"] == 1
        assert metrics["customer_acceptance_rate"]["denominator"] == 1
        assert metrics["customer_acceptance_rate"]["suppressed"] is True
        assert metrics["customer_repeat_participants"]["numerator"] == 0
        assert metrics["customer_repeat_participants"]["denominator"] == 1
        assert metrics["customer_time_to_result_hours"]["numerator"] == 1
        assert metrics["customer_time_to_result_hours"]["value"] is not None
        assert metrics["customer_time_to_result_hours"]["suppressed"] is False


def test_customer_activity_uses_only_dated_events_from_owned_tasks() -> None:
    api = client()
    with api:
        csrf = login(api, "customer-roman")
        created = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": csrf},
        )
        assert created.status_code == 200
        task_id = created.json()["id"]

        response = api.get("/api/v1/customer/analytics/activity")
        assert response.status_code == 200
        body = response.json()
        assert body["window_days"] == 84
        assert body["generated_at"]
        created_events = [
            item
            for item in body["events"]
            if item["kind"] == "project_created" and item["task_id"] == task_id
        ]
        assert len(created_events) == 1
        assert created_events[0]["task_title"] == brief()["title"]
        assert created_events[0]["occurred_at"]
        assert not any(item["kind"] == "application_received" for item in body["events"])

        login(api, "participant-alex")
        hidden = api.get("/api/v1/customer/analytics/activity")
        assert hidden.status_code in {403, 404}
