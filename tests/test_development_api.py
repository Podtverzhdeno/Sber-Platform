"""Participant tracks, roadmap, Bootcamp and streak API scenarios."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.development import (
    DevelopmentService,
    EnrollmentRecord,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
    RoadmapRecord,
    demo_course_certificate,
)
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.development import (
    CompletionStatus,
    RoadmapMilestone,
    TrackAttempt,
    TrackStatus,
)


def _client() -> tuple[TestClient, MemoryDevelopmentStore]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("development-api-test-secret-long-enough"),
    )
    auth = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    store = MemoryDevelopmentStore()
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(store),
    )
    return TestClient(app), store


def _login(client: TestClient, persona_key: str = "participant-alex") -> str:
    response = client.post("/api/v1/auth/demo-login", json={"persona_key": persona_key})
    assert response.status_code == 200
    token = response.json()["csrf_token"]
    assert isinstance(token, str)
    return token


@pytest.mark.spec("career-roadmap/second-and-third-track")
def test_two_tracks_and_explicit_third_track_freeze() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        initial = client.get("/api/v1/development/tracks")
        assert initial.json()["active_count"] == 1

        second = client.post(
            "/api/v1/me/tracks",
            json={"track_key": "data"},
            headers={"X-CSRF-Token": csrf},
        )
        assert second.status_code == 200
        assert second.json()["active_count"] == 2

        needs_choice = client.post(
            "/api/v1/me/tracks",
            json={"track_key": "product"},
            headers={"X-CSRF-Token": csrf},
        )
        assert needs_choice.status_code == 409
        assert needs_choice.json()["code"] == "TRACK_SLOT_REQUIRED"

        switched = client.post(
            "/api/v1/me/tracks",
            json={"track_key": "product", "freeze_track_key": "python"},
            headers={"X-CSRF-Token": csrf},
        )
        statuses = {item["key"]: item["status"] for item in switched.json()["tracks"]}
        assert switched.status_code == 200
        assert statuses == {
            "data": "active",
            "ml": None,
            "product": "active",
            "python": "frozen",
        }


@pytest.mark.spec("career-roadmap/version-preserves-completion")
def test_roadmap_api_preserves_completed_step_across_policy_version() -> None:
    client, store = _client()
    alex_id = demo_personas()[0].person_id
    import asyncio

    asyncio.run(
        store.replace_attempts(
            alex_id,
            (
                TrackAttempt(
                    "python",
                    1,
                    TrackStatus.ACTIVE,
                    frozenset({"foundation"}),
                ),
            ),
        )
    )
    store.install_roadmap(
        RoadmapRecord(
            "python",
            2,
            (
                RoadmapMilestone(
                    "foundation",
                    1,
                    "Основа",
                    "Подготовить базу.",
                    "Python",
                    "course",
                    "python-base",
                ),
                RoadmapMilestone(
                    "api",
                    2,
                    "API",
                    "Собрать первый сервис.",
                    "FastAPI",
                    "course",
                    "fastapi",
                ),
            ),
        )
    )
    with client:
        _login(client)
        response = client.get("/api/v1/me/roadmaps")
    assert response.status_code == 200
    roadmap = response.json()[0]
    assert roadmap["policy_version"] == 2
    assert roadmap["milestones"][0]["completed"] is True
    assert roadmap["next_step"]["key"] == "api"
    assert roadmap["next_step"]["purpose"] == "Собрать первый сервис."


@pytest.mark.spec("bootcamp-learning/reported-not-verified")
def test_course_catalog_reported_completion_and_streak_deduplication() -> None:
    client, _store = _client()
    with client:
        csrf = _login(client)
        catalog = client.get("/api/v1/development/courses")
        assert catalog.status_code == 200
        assert all(item["recommendation_reason"] for item in catalog.json())
        unavailable = next(item for item in catalog.json() if item["availability"] == "unavailable")
        assert unavailable["source_url"].startswith("https://")
        assert "не подключён" in unavailable["access_note"]

        reported = client.post(
            "/api/v1/me/courses/python-base/completion",
            headers={"X-CSRF-Token": csrf},
        )
        assert reported.status_code == 200
        assert reported.json()["status"] == "reported"
        assert reported.json()["rating_eligible"] is False

        for occurred_at in (
            "2026-09-27T18:00:00Z",
            "2026-09-27T19:00:00Z",
        ):
            streak = client.post(
                "/api/v1/me/courses/python-base/learning-days",
                json={"occurred_at": occurred_at},
                headers={"X-CSRF-Token": csrf},
            )
        assert streak.json()["current_days"] == 1
        assert len(streak.json()["qualified_dates"]) == 1

        next_day = client.post(
            "/api/v1/me/courses/python-base/learning-days",
            json={"occurred_at": "2026-09-28T18:00:00Z"},
            headers={"X-CSRF-Token": csrf},
        )
        assert next_day.json()["current_days"] == 2


def test_non_participant_cannot_read_participant_development() -> None:
    client, _store = _client()
    with client:
        _login(client, "mentor-elena")
        response = client.get("/api/v1/development/tracks")
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def _certificate_client() -> tuple[
    TestClient,
    MemoryDevelopmentStore,
    MemoryIdentityStore,
    MemoryCertificateStore,
]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("development-api-test-secret-long-enough"),
    )
    identity_store = MemoryIdentityStore(demo_personas())
    auth = DemoAuthService(
        identity_store,
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    dev_store = MemoryDevelopmentStore()
    certificates = MemoryCertificateStore()
    app = create_app(
        settings,
        auth_service=auth,
        development_service=DevelopmentService(dev_store, certificates),
    )
    return TestClient(app), dev_store, identity_store, certificates


@pytest.mark.spec("bootcamp-learning/certificate-issue")
def test_certificate_requires_verified_completion() -> None:
    client, store, _identity, _certificates = _certificate_client()
    with client:
        csrf = _login(client)
        unverified = client.post(
            "/api/v1/me/bootcamp/certificates/python-base",
            headers={"X-CSRF-Token": csrf},
        )
        assert unverified.status_code == 409
        assert unverified.json()["code"] == "CERTIFICATE_NOT_VERIFIED"

        unknown = client.post(
            "/api/v1/me/bootcamp/certificates/nope",
            headers={"X-CSRF-Token": csrf},
        )
        assert unknown.status_code == 404

        store.enroll_as(demo_personas()[0].person_id)
        store.install_enrollments((EnrollmentRecord("openspec-sdd", CompletionStatus.REPORTED),))
        reported = client.post(
            "/api/v1/me/bootcamp/certificates/openspec-sdd",
            headers={"X-CSRF-Token": csrf},
        )
        assert reported.status_code == 409
        assert reported.json()["code"] == "CERTIFICATE_NOT_VERIFIED"


@pytest.mark.spec("bootcamp-learning/certificate-issue")
def test_certificate_issue_idempotent_and_only_supplied_fields() -> None:
    client, store, _identity, _certificates = _certificate_client()
    with client:
        csrf = _login(client)
        store.enroll_as(demo_personas()[0].person_id)
        store.install_enrollments((EnrollmentRecord("openspec-sdd", CompletionStatus.VERIFIED),))
        first = client.post(
            "/api/v1/me/bootcamp/certificates/openspec-sdd",
            headers={"X-CSRF-Token": csrf},
        )
        assert first.status_code == 200
        document = first.json()
        assert document["course_title"] == "OpenSpec и SDD"
        assert document["preview_marking"] == "Демонстрационный образец"
        assert len(document["competencies"]) == 2
        assert document["period"] == "2026"

        repeat = client.post(
            "/api/v1/me/bootcamp/certificates/openspec-sdd",
            headers={"X-CSRF-Token": csrf},
        )
        assert repeat.status_code == 200
        assert repeat.json()["verification_id"] == document["verification_id"]

        listed = client.get("/api/v1/me/bootcamp/certificates")
        assert listed.status_code == 200
        assert [item["verification_id"] for item in listed.json()] == [document["verification_id"]]


@pytest.mark.spec("bootcamp-learning/public-verification-page")
def test_public_verification_requires_holder_consent() -> None:
    import asyncio

    from impulse.bootstrap.demo_seed import demo_id
    from impulse.domain.identity import ConsentScope

    client, _store, identity, certificates = _certificate_client()
    alex_id = demo_personas()[0].person_id
    certificates.install_course_certificate(
        demo_course_certificate(alex_id, demo_id("certificate:participant-alex:openspec-sdd"))
    )
    asyncio.run(identity.set_consent(alex_id, ConsentScope.PUBLIC_PROFILE, True))
    with client:
        granted = client.get("/api/v1/bootcamp/certificates/demo-cert-openspec-sdd")
        assert granted.status_code == 200
        document = granted.json()
        assert document["holder_name"] == "Алекс Речной"
        assert document["verification_id"] == "demo-cert-openspec-sdd"
        assert document["preview_marking"] == "Демонстрационный образец"

        asyncio.run(identity.set_consent(alex_id, ConsentScope.PUBLIC_PROFILE, False))
        revoked = client.get("/api/v1/bootcamp/certificates/demo-cert-openspec-sdd")
        assert revoked.status_code == 404
        assert revoked.json()["code"] == "RESOURCE_NOT_FOUND"

        missing = client.get("/api/v1/bootcamp/certificates/unknown-id")
        assert missing.status_code == 404


def test_certificates_rbac_requires_participant_role() -> None:
    client, _store, _identity, _certificates = _certificate_client()
    with client:
        _login(client, "mentor-elena")
        listed = client.get("/api/v1/me/bootcamp/certificates")
        assert listed.status_code == 403
        assert listed.json()["code"] == "FORBIDDEN"
