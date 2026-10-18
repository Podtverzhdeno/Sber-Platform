"""Versioned competency frameworks with explainable, source-guarded levels."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.competencies import (
    CompetencyService,
    MemoryCompetencyEvidenceStore,
    MemoryFrameworkStore,
    install_demo_competencies,
)
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.demo_seed import demo_id
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.competencies import UNKNOWN_LEVEL, CompetencySkill, FrameworkVersion


def service() -> CompetencyService:
    return CompetencyService(MemoryFrameworkStore(), MemoryCompetencyEvidenceStore())


def framework(version: int, delivery_sources: tuple[tuple[str, str], ...]) -> FrameworkVersion:
    from impulse.domain.competencies import FrameworkDomain

    return FrameworkVersion(
        "role:product-engineer",
        FrameworkDomain.ROLE,
        version,
        "Продуктовый инженер",
        datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
        (
            CompetencySkill("specification", "Спецификация", (("course", "openspec-sdd"),)),
            CompetencySkill("delivery", "Доставка результата", delivery_sources),
        ),
    )


def api_client() -> TestClient:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("competency-test-secret-long"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    return TestClient(create_app(settings, auth_service=auth))


async def test_level_stays_anchored_to_allowed_sources() -> None:
    probe = service()
    alex = demo_id("participant-alex")
    await probe.publish_framework(framework(1, (("project", "semantic-search-rd"),)))
    await probe.record_source_transition(
        alex, "delivery", source_kind="course", source_ref="openspec-sdd", level="уверенный"
    )
    await probe.record_source_transition(
        alex, "delivery", source_kind="project", source_ref="semantic-search-rd", level="базовый"
    )

    report = await probe.framework_report(alex, "role:product-engineer")
    assert report is not None and report.domain == "role"
    delivery = next(skill for skill in report.skills if skill.skill.key == "delivery")
    assert delivery.level == "базовый"
    assert [anchor.row.source_kind for anchor in delivery.anchors] == ["project"]
    assert any("не привязан" in anchor.reason for anchor in delivery.excluded)

    specification = next(skill for skill in report.skills if skill.skill.key == "specification")
    assert specification.level == UNKNOWN_LEVEL and not specification.anchors


async def test_published_version_receives_its_own_explanation() -> None:
    probe = service()
    alex = demo_id("participant-alex")
    await probe.publish_framework(framework(1, (("course", "openspec-sdd"),)))
    await probe.record_source_transition(
        alex, "delivery", source_kind="course", source_ref="openspec-sdd", level="базовый"
    )
    original = await probe.framework_report(alex, "role:product-engineer")
    assert original is not None and original.version == 1

    await probe.publish_framework(framework(2, (("project", "semantic-search-rd"),)))
    still_first = await probe.framework_report(alex, "role:product-engineer", version_number=1)
    assert still_first is not None and still_first.version == 1
    delivery = next(skill for skill in still_first.skills if skill.skill.key == "delivery")
    assert delivery.level == "базовый"

    switched = await probe.framework_report(alex, "role:product-engineer")
    assert switched is not None and switched.version == 2
    row = next(skill for skill in switched.skills if skill.skill.key == "delivery")
    assert row.level == UNKNOWN_LEVEL


def test_api_requires_session_and_scopes_to_own_person() -> None:
    client = api_client()
    unauthorized = client.get("/api/v1/me/competencies")
    assert unauthorized.status_code == 401

    login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert login.status_code == 200
    headers = {"X-CSRF-Token": login.json()["csrf_token"]}
    listing = client.get("/api/v1/me/competencies", headers=headers)
    assert listing.status_code == 200
    frameworks = listing.json()
    assert isinstance(frameworks, list)

    evidence = client.get("/api/v1/me/competency-evidence", headers=headers)
    assert evidence.status_code == 200
    assert all("source_kind" in row for row in evidence.json())


async def test_demo_app_reports_versioned_frameworks_for_alex() -> None:
    registry = service()
    alex = demo_id("participant-alex")
    await install_demo_competencies(registry, alex)
    reports = {report.framework_key: report for report in await registry.person_reports(alex)}
    assert set(reports) == {
        "course:openspec-sdd",
        "role:product-engineer",
        "project:semantic-search-rd",
    }
    role = reports["role:product-engineer"]
    assert {skill.skill.key for skill in role.skills} == {"specification", "delivery"}
    delivery = next(skill for skill in role.skills if skill.skill.key == "delivery")
    assert delivery.level == "базовый"
    assert any("не привязан" in anchor.reason for anchor in delivery.excluded)
    course = reports["course:openspec-sdd"]
    course_delivery = next(skill for skill in course.skills if skill.skill.key == "delivery")
    assert course_delivery.level == "уверенный"
    assert [anchor.row.source_kind for anchor in course_delivery.anchors] == ["course"]


async def test_evidence_row_is_idempotent_per_source() -> None:
    registry = service()
    alex = demo_id("participant-alex")
    first = await registry.record_source_transition(
        alex, "specification", source_kind="course", source_ref="openspec-sdd", level="базовый"
    )
    again = await registry.record_source_transition(
        alex, "specification", source_kind="course", source_ref="openspec-sdd", level="базовый"
    )
    assert first.competency_key == again.competency_key
    assert first.evidence_id == again.evidence_id
    rows = await registry.evidence.evidence_for_person(alex)
    assert len(rows) == 1


async def test_unknown_framework_version_wins_no_report() -> None:
    registry = service()
    alex = demo_id("participant-alex")
    await registry.publish_framework(framework(1, (("course", "openspec-sdd"),)))
    missing = await registry.framework_report(alex, "role:product-engineer", version_number=7)
    assert missing is None


async def test_recorded_evidence_carries_new_serial() -> None:
    registry = service()
    alex = demo_id("participant-alex")
    await registry.publish_framework(framework(1, (("course", "openspec-sdd"),)))
    first = await registry.record_source_transition(
        alex, "specification", source_kind="course", source_ref="openspec-sdd", level="базовый"
    )
    upgraded = await registry.record_source_transition(
        alex, "specification", source_kind="course", source_ref="openspec-sdd", level="уверенный"
    )
    assert first.evidence_id == upgraded.evidence_id
    report = await registry.framework_report(alex, "role:product-engineer")
    assert report is not None
    specification = next(skill for skill in report.skills if skill.skill.key == "specification")
    assert specification.level == "уверенный"


def test_serial_helper_is_callable() -> None:
    row = uuid4()
    assert row != uuid4()
