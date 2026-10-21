"""Skill drill-down boundaries (openspec 22.9).

Ключевые правила, которые контракт проверяет поверх существующих API:
- контекстная рекомендация Buddy никогда не вызывает модель
  (`model_called is False`) и не меняет уровень навыка, evidence или траекторию;
- payload рекомендации прозрачен только для собственного
  actor-scoped контекста участника: данные других персон не проходят;
- линия доказательств для drill-down содержит counted/excluded anchors с
  `observed_at` (история), а снапшот роста публикует версию формулы readiness
  и блок freshness для отображения в UI.
"""

from __future__ import annotations

import asyncio
import json
from typing import cast

import pytest
from fastapi.testclient import TestClient

from impulse.application.development import (
    DevelopmentService,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
    RoadmapRecord,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import RoadmapMilestone, TrackAttempt, TrackStatus


def login(client: TestClient, persona: str) -> None:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200


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


@pytest.mark.spec("participant-experience/skill-drilldown")
def test_recommendation_never_calls_model_or_changes_skill_levels() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    _install_roadmap(store)
    with TestClient(app) as api:
        login(api, "participant-alex")
        evidence_before = api.get("/api/v1/me/competency-evidence").json()
        reports_before = api.get("/api/v1/me/competencies").json()
        attempt_before = asyncio.run(store.attempts(demo_id("participant-alex")))
        payload = api.get("/api/v1/agents/buddy/suggestion").json()
        assert payload["ai_model_available"] is False
        suggestion = payload["suggestion"]
        assert suggestion is not None
        assert suggestion["model_called"] is False
        assert suggestion["auto_enrolled"] is False
        assert asyncio.run(store.attempts(demo_id("participant-alex"))) == attempt_before
        assert api.get("/api/v1/me/competency-evidence").json() == evidence_before
        assert api.get("/api/v1/me/competencies").json() == reports_before


@pytest.mark.spec("participant-experience/skill-drilldown")
def test_suggestion_context_stays_actor_scoped_between_participants() -> None:
    store = MemoryDevelopmentStore()
    app = create_app(
        Settings(app_env=AppEnvironment.TEST),
        development_service=DevelopmentService(store, MemoryCertificateStore()),
    )
    _install_roadmap(store)
    asyncio.run(
        store.replace_attempts(
            demo_id("participant-alex"),
            (
                TrackAttempt(
                    track_key="python",
                    attempt_number=1,
                    status=TrackStatus.ACTIVE,
                    completed_milestones=frozenset({"foundation"}),
                ),
            ),
        )
    )
    with TestClient(app) as api:
        login(api, "participant-alex")
        alex_payload = api.get("/api/v1/agents/buddy/suggestion").json()
        assert alex_payload["suggestion"] is None
        assert alex_payload["dismissed"] is False
        assert alex_payload["suggestions"] == []
        login(api, "participant-maria")
        maria_payload = api.get("/api/v1/agents/buddy/suggestion").json()
        assert maria_payload["suggestion"] is not None
        assert maria_payload["suggestions"]
        maria_raw = json.dumps(maria_payload, ensure_ascii=False)
        assert str(demo_id("participant-alex")) not in maria_raw
        assert api.get("/api/v1/me/competency-evidence").json() == []


@pytest.mark.spec("participant-experience/skill-drilldown")
def test_skill_lineage_exposes_observed_history_for_drilldown() -> None:
    app = create_app(Settings(app_env=AppEnvironment.TEST))
    development = cast(DevelopmentService, app.state.development_service)
    assert isinstance(development.store, MemoryDevelopmentStore)
    _install_roadmap(development.store)
    with TestClient(app) as api:
        login(api, "participant-alex")
        reports = api.get("/api/v1/me/competencies").json()
        role = next(item for item in reports if item["framework_key"] == "role:product-engineer")
        specification = next(
            skill for skill in role["skills"] if skill["skill_key"] == "specification"
        )
        assert specification["level"] == "уверенный"
        assert specification["explanation"].startswith("Уровень")
        anchors = specification["anchors"]
        assert anchors
        assert all(row["observed_at"] for row in anchors)
        assert all(row["counted"] for row in anchors)
        assert all(row["source_kind"] == "course" for row in anchors)
        assert specification["excluded"] == []
        delivery = next(skill for skill in role["skills"] if skill["skill_key"] == "delivery")
        assert delivery["excluded"]
        assert all(row["observed_at"] for row in delivery["excluded"])
        assert all(row["counted"] is False for row in delivery["excluded"])
        snapshot = api.get("/api/v1/me/growth/snapshot").json()
        assert snapshot["definitions"]["readiness"].startswith("impulse-growth-readiness-v")
        trajectory = next(
            item for item in snapshot["trajectories"] if item["track_key"] == "python"
        )
        assert any(
            point["skill_key"] == "specification" for point in trajectory["readiness_skills"]
        )
        assert "freshness" in snapshot
