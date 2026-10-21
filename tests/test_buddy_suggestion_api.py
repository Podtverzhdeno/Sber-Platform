"""Tests for the explainable Buddy suggestion home card (openspec 22.3).

Ключевые правила, которые контракт запрещает нарушать:
- рекомендация никогда не вызывает модель и не требует доступного провайдера;
- совет не создаёт запись на курс, не меняет траекторию, не двигает уровень;
- dismiss скрывает карту без потери доменного следующего шага и Growth snapshot;
- давно нет проверенного Bootcamp checkpoint — совет ведёт к первому незавершённому.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from impulse.application.development import (
    CourseCertificate,
    DevelopmentService,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
    RoadmapRecord,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import RoadmapMilestone


def login(client: TestClient, persona: str) -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _install_roadmap(store: MemoryDevelopmentStore) -> None:
    store.install_roadmap(
        RoadmapRecord(
            track_key="python",
            policy_version=3,
            milestones=(
                RoadmapMilestone(
                    "foundation",
                    1,
                    "Освоить основу",
                    "Создать базу для первой практической задачи.",
                    "Python-разработчик",
                    "course",
                    "openspec-sdd",
                ),
            ),
        )
    )


def _install_three_step_roadmap(store: MemoryDevelopmentStore) -> None:
    store.install_roadmap(
        RoadmapRecord(
            track_key="python",
            policy_version=4,
            milestones=tuple(
                RoadmapMilestone(
                    f"checkpoint-{index}",
                    index,
                    f"Checkpoint {index}",
                    "Проверяемый шаг активной траектории.",
                    "Python-разработчик",
                    "course",
                    "openspec-sdd",
                )
                for index in range(1, 4)
            ),
        )
    )


def _last_checkpoint_days_ago(days: int) -> CourseCertificate:
    registry_person = demo_id("participant-alex")
    return CourseCertificate(
        certificate_id=uuid4(),
        verification_id=f"stale-cert-{days}",
        person_id=registry_person,
        holder_name="Алекс Речной",
        course_key="openspec-sdd",
        course_title="OpenSpec и SDD",
        specialization="Python / Data / Product / ML",
        program_version="1.0.0",
        period="2026",
        workload_hours=24,
        result="Подтверждённое завершение Bootcamp-курса",
        competencies=(),
        issued_at=datetime.now(UTC) - timedelta(days=days),
    )


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_suggestion_is_deterministic_domain_next_without_model() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_roadmap(store)
    with TestClient(app) as client:
        login(client, "participant-alex")
        response = client.get("/api/v1/agents/buddy/suggestion")
        assert response.status_code == 200
        payload = response.json()
        assert payload["policy_version"] == 1
        assert payload["dismissed"] is False
        suggestion = payload["suggestion"]
        assert suggestion is not None
        assert suggestion["version"] == 1
        assert suggestion["generated_at"] is not None
        assert suggestion["model_called"] is False
        assert suggestion["auto_enrolled"] is False
        assert payload["ai_model_available"] is False
        assert suggestion["kind"] == "domain_next"
        assert suggestion["observation"]
        assert suggestion["gap"]
        assert suggestion["benefit"]
        assert suggestion["explanation"]
        assert suggestion["source_categories"]
        action = suggestion["action"]
        assert action is not None and action["ref"]
        again = client.get("/api/v1/agents/buddy/suggestion")
        assert again.status_code == 200
        assert again.json()["suggestion"] is not None
        assert again.json()["suggestion"]["suggestion_id"] == suggestion["suggestion_id"]


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_bootcamp_idle_is_honest_after_long_no_checkpoint() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    certificates = development.certificates
    assert isinstance(certificates, MemoryCertificateStore)
    certificates.install_course_certificate(_last_checkpoint_days_ago(60))
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_roadmap(store)
    with TestClient(app) as client:
        login(client, "participant-alex")
        payload = client.get("/api/v1/agents/buddy/suggestion").json()
        suggestion = payload["suggestion"]
        assert suggestion is not None
        assert suggestion["kind"] == "bootcamp_idle"
        assert suggestion["idle_days"] >= 21
        assert "давно" in suggestion["observation"]
        assert "трайектории" in suggestion["gap"] or "траектории" in suggestion["gap"]
        action = suggestion["action"]
        assert action is not None
        assert action["kind"] == "checkpoint"
        assert action["ref"].startswith("checkpoint:")
        assert "Skill Passport" in suggestion["benefit"]
        assert "checkpoint" in suggestion["source_categories"]
        assert "Модель не вызывается" in suggestion["explanation"]


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_no_verified_checkpoint_still_honest_with_days_none() -> None:
    store = MemoryDevelopmentStore()
    _install_roadmap(store)
    app = create_app(
        Settings(app_env=AppEnvironment.TEST),
        development_service=DevelopmentService(store, MemoryCertificateStore()),
    )
    with TestClient(app) as client:
        login(client, "participant-alex")
        payload = client.get("/api/v1/agents/buddy/suggestion").json()
        suggestion = payload["suggestion"]
        assert suggestion is not None
        assert suggestion["kind"] == "bootcamp_idle"
        assert suggestion["idle_days"] is None
        assert "нет проверенного checkpoint" in suggestion["observation"]


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_suggestion_never_enrolls_or_changes_trajectory() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    assert isinstance(development.store, MemoryDevelopmentStore)
    store = development.store
    _install_roadmap(store)
    store.enroll_as(demo_id("participant-alex"))
    with TestClient(app) as client:
        csrf = login(client, "participant-alex")
        before_attempts = asyncio.run(store.attempts(demo_id("participant-alex")))
        payload = client.get("/api/v1/agents/buddy/suggestion").json()
        suggestion = payload["suggestion"]
        assert suggestion is not None
        response = client.post(
            "/api/v1/agents/buddy/suggestion/dismiss",
            headers={"X-CSRF-Token": csrf},
            json={"suggestion_id": suggestion["suggestion_id"]},
        )
        assert response.status_code == 204
        assert asyncio.run(store.enrollments(demo_id("participant-alex"))) == ()
        assert asyncio.run(store.attempts(demo_id("participant-alex"))) == before_attempts


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_dismiss_hides_card_without_growth_loss_and_is_idempotent() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_roadmap(store)
    with TestClient(app) as client:
        csrf = login(client, "participant-alex")
        first = client.get("/api/v1/agents/buddy/suggestion")
        suggestion = first.json()["suggestion"]
        assert suggestion is not None
        dismissal = client.post(
            "/api/v1/agents/buddy/suggestion/dismiss",
            headers={"X-CSRF-Token": csrf},
            json={"suggestion_id": suggestion["suggestion_id"]},
        )
        assert dismissal.status_code == 204
        again = client.get("/api/v1/agents/buddy/suggestion").json()
        assert again["dismissed"] is True
        assert again["suggestion"] is None
        retry = client.post(
            "/api/v1/agents/buddy/suggestion/dismiss",
            headers={"X-CSRF-Token": csrf},
            json={"suggestion_id": suggestion["suggestion_id"]},
        )
        assert retry.status_code == 204
        assert client.get("/api/v1/agents/buddy/suggestion").json()["suggestion"] is None


@pytest.mark.spec("participant-experience/buddy-explainable-suggestion")
def test_suggestion_requires_participant_role() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    with TestClient(app) as client:
        login(client, "customer-roman")
        assert client.get("/api/v1/agents/buddy/suggestion").status_code == 403
        wrong_method = client.post(
            "/api/v1/agents/buddy/suggestion/dismiss",
            headers={"X-CSRF-Token": login(client, "customer-roman")},
            json={"suggestion_id": "x"},
        )
        assert wrong_method.status_code == 403


@pytest.mark.spec("agent-buddy/action-cards")
def test_returns_up_to_three_typed_cards_and_resolves_exact_target_without_writes() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_three_step_roadmap(store)
    person_id = demo_id("participant-alex")
    with TestClient(app) as client:
        login(client, "participant-alex")
        before_attempts = asyncio.run(store.attempts(person_id))
        before_enrollments = asyncio.run(store.enrollments(person_id))
        payload = client.get("/api/v1/agents/buddy/suggestion").json()
        assert len(payload["suggestions"]) == 3
        assert payload["suggestion"] == payload["suggestions"][0]
        assert len({item["suggestion_id"] for item in payload["suggestions"]}) == 3
        for item in payload["suggestions"]:
            action = item["action"]
            assert action["target_kind"] == "course"
            assert action["target_id"] == "openspec-sdd"
            assert action["checkpoint_id"].startswith("checkpoint-")
            assert action["canonical_path"].startswith("/workspace/2?course=openspec-sdd")
            assert action["effect_state"] == "projected"
            assert action["points"] is None
            assert item["partial"] is True
            assert item["coverage_note"]
        first = payload["suggestions"][0]
        resolved = client.get(
            "/api/v1/agents/buddy/suggestion/target",
            params={"suggestion_id": first["suggestion_id"]},
        )
        assert resolved.status_code == 200
        assert resolved.json()["target"]["canonical_path"] == first["action"]["canonical_path"]
        assert asyncio.run(store.attempts(person_id)) == before_attempts
        assert asyncio.run(store.enrollments(person_id)) == before_enrollments


@pytest.mark.spec("agent-buddy/recommendation-feedback")
def test_snooze_and_irrelevant_feedback_change_ranking_preferences_only() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_three_step_roadmap(store)
    person_id = demo_id("participant-alex")
    with TestClient(app) as client:
        csrf = login(client, "participant-alex")
        before_attempts = asyncio.run(store.attempts(person_id))
        initial = client.get("/api/v1/agents/buddy/suggestion").json()["suggestions"]
        snoozed_id = initial[0]["suggestion_id"]
        response = client.post(
            "/api/v1/agents/buddy/suggestion/feedback",
            headers={"X-CSRF-Token": csrf},
            json={"suggestion_id": snoozed_id, "action": "snooze"},
        )
        assert response.status_code == 204
        after_snooze = client.get("/api/v1/agents/buddy/suggestion").json()["suggestions"]
        assert snoozed_id not in {item["suggestion_id"] for item in after_snooze}
        irrelevant_id = after_snooze[0]["suggestion_id"]
        response = client.post(
            "/api/v1/agents/buddy/suggestion/feedback",
            headers={"X-CSRF-Token": csrf},
            json={"suggestion_id": irrelevant_id, "action": "irrelevant"},
        )
        assert response.status_code == 204
        after_irrelevant = client.get("/api/v1/agents/buddy/suggestion").json()["suggestions"]
        assert irrelevant_id not in {item["suggestion_id"] for item in after_irrelevant}
        assert asyncio.run(store.attempts(person_id)) == before_attempts


@pytest.mark.spec("agent-buddy/stale-object-recheck")
def test_target_recheck_rejects_object_removed_after_card_generation() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_roadmap(store)
    with TestClient(app) as client:
        login(client, "participant-alex")
        suggestion_id = client.get("/api/v1/agents/buddy/suggestion").json()["suggestion"][
            "suggestion_id"
        ]
        store.install_roadmap(RoadmapRecord(track_key="python", policy_version=5, milestones=()))
        response = client.get(
            "/api/v1/agents/buddy/suggestion/target",
            params={"suggestion_id": suggestion_id},
        )
        assert response.status_code == 409
        assert response.json()["code"] == "SUGGESTION_STALE"
