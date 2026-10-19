"""Tests for the Skill Passport gap in GET /me/growth/next-step (openspec 22.2).

Ключевые правила, которые запрещают в контракте:
- уровень навыка считается ТОЛЬКО из проверенных (counted) источников;
- чужие источники не поднимают уровень и не попадают в counted_sources;
- пока evidence не проверен, карта не обещает повышение уровня (fallback честный);
- когда подходящей задачи нет — карта говорит это прямо.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.competencies import CompetencyService
from impulse.application.development import (
    DevelopmentService,
    MemoryDevelopmentStore,
    RoadmapRecord,
)
from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.competencies import CompetencySkill, FrameworkDomain, FrameworkVersion
from impulse.domain.development import RoadmapMilestone
from impulse.domain.passport import (
    FALLBACK_NO_COVERING_STEP,
    FALLBACK_TARGET_REACHED,
    UNKNOWN_LEVEL,
)


def _test_settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("passport-gap-test-secret-32-chars!"),
        session_ttl_seconds=600,
    )


def _client() -> tuple[TestClient, MemoryDevelopmentStore, CompetencyService]:
    settings = _test_settings()
    service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    app = create_app(settings, auth_service=service)
    client = TestClient(app)
    development = cast(DevelopmentService, app.state.development_service)
    store = development.store
    assert isinstance(store, MemoryDevelopmentStore)
    competency = cast(CompetencyService, app.state.competency_service)
    return client, store, competency


def _login(client: TestClient) -> None:
    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200


def _setup_roadmap(store: MemoryDevelopmentStore, *, skill: str = "python") -> None:
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
                    skill,
                    "course",
                    "openspec-sdd",
                ),
            ),
        )
    )
    store.enroll_as(demo_id("participant-alex"))


def _framework(sources: tuple[tuple[str, str], ...]) -> FrameworkVersion:
    return FrameworkVersion(
        "role:python-engineer",
        FrameworkDomain.ROLE,
        1,
        "Инженер Python",
        datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
        (CompetencySkill("python", "Python", sources),),
    )


def _record(
    competency: CompetencyService,
    kind: str,
    ref: str,
    level: str,
    *,
    competency_key: str = "python",
) -> None:
    alex = demo_id("participant-alex")
    asyncio.run(
        competency.record_source_transition(
            alex, competency_key, source_kind=kind, source_ref=ref, level=level
        )
    )


FULL_SOURCES = (
    ("course", "openspec-sdd"),
    ("checkpoint", "python-quality-check"),
    ("project", "semantic-search-rd"),
)


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_reports_honest_gap_without_framework() -> None:
    client, store, _competency = _client()
    _login(client)
    _setup_roadmap(store, skill="Python")
    response = client.get("/api/v1/me/growth/next-step")
    assert response.status_code == 200
    payload = response.json()
    skill = payload["skill"]
    assert skill is not None
    assert skill["policy_version"] == 1
    assert skill["skill_key"] is None
    assert skill["requested_skill"] == "Python"
    assert skill["current_level"] == UNKNOWN_LEVEL
    assert skill["current_known"] is False
    assert skill["counted_sources"] == []
    assert skill["missing_evidence"] == []
    assert "отсутствует во фреймворке" in skill["explanation"]
    assert skill["fallback"] is not None and "фреймворк" in skill["fallback"]


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_gap_matches_by_framework_key() -> None:
    client, store, competency = _client()
    _login(client)
    _setup_roadmap(store, skill="python")
    asyncio.run(competency.publish_framework(_framework(FULL_SOURCES)))
    response = client.get("/api/v1/me/growth/next-step")
    payload = response.json()
    skill = payload["skill"]
    assert skill is not None
    assert skill["skill_key"] == "python"
    assert skill["title"] == "Python"
    assert skill["current_level"] == UNKNOWN_LEVEL
    assert skill["missing_evidence"] == [
        "course:openspec-sdd",
        "checkpoint:python-quality-check",
        "project:semantic-search-rd",
    ]
    # ближайший шаг — курс openspec-sdd, он закрывает первый недостающий источник
    best = payload["next_available"]
    assert best is not None and best["target_key"] == "openspec-sdd"
    assert skill["fallback"] is None
    assert "закрывает требуемый источник course:openspec-sdd" in skill["explanation"]


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_never_raises_level_without_verified_evidence() -> None:
    client, store, competency = _client()
    _login(client)
    _setup_roadmap(store, skill="python")
    asyncio.run(competency.publish_framework(_framework(FULL_SOURCES)))
    # «наблюдение» из источника, не привязанного к навыку во фреймворке
    _record(competency, "theme", "python-theme", "уверенный")
    response = client.get("/api/v1/me/growth/next-step")
    skill = response.json()["skill"]
    assert skill is not None
    assert skill["current_level"] == UNKNOWN_LEVEL
    assert skill["current_known"] is False
    assert skill["counted_sources"] == []
    assert skill["missing_evidence"] == [
        "course:openspec-sdd",
        "checkpoint:python-quality-check",
        "project:semantic-search-rd",
    ]
    assert skill["fallback"] is None
    assert "не может обещать повышение" not in skill["explanation"]


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_level_follows_verified_course_only() -> None:
    client, store, competency = _client()
    _login(client)
    _setup_roadmap(store, skill="python")
    asyncio.run(competency.publish_framework(_framework(FULL_SOURCES)))
    _record(competency, "course", "openspec-sdd", "базовый")
    response = client.get("/api/v1/me/growth/next-step")
    skill = response.json()["skill"]
    assert skill is not None
    assert skill["current_level"] == "базовый"
    assert skill["current_known"] is True
    assert skill["counted_sources"] == ["course:openspec-sdd"]
    assert skill["missing_evidence"] == [
        "checkpoint:python-quality-check",
        "project:semantic-search-rd",
    ]
    # курс уже пройден, оставшиеся источники не закрыты активными шагами
    assert skill["fallback"] == FALLBACK_NO_COVERING_STEP
    assert "не обещает повышение уровня" in skill["explanation"]


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_honest_fallback_when_target_reached() -> None:
    client, store, competency = _client()
    _login(client)
    _setup_roadmap(store, skill="python")
    asyncio.run(competency.publish_framework(_framework((("course", "openspec-sdd"),))))
    _record(competency, "course", "openspec-sdd", "уверенный")
    response = client.get("/api/v1/me/growth/next-step")
    skill = response.json()["skill"]
    assert skill is not None
    assert skill["current_level"] == "уверенный"
    assert skill["target_level"] == "уверенный"
    assert skill["missing_evidence"] == []
    assert "Целевой уровень" in skill["explanation"]
    assert skill["fallback"] == FALLBACK_TARGET_REACHED


@pytest.mark.spec("participant-experience/skill-passport-gap")
def test_next_step_skill_block_absent_without_steps() -> None:
    client, _store, competency = _client()
    _login(client)
    asyncio.run(competency.publish_framework(_framework(FULL_SOURCES)))
    response = client.get("/api/v1/me/growth/next-step")
    assert response.status_code == 200
    payload = response.json()
    skill = payload["skill"]
    if payload["steps"]:
        assert skill is not None and skill["policy_version"] == 1
    else:
        assert skill is None
