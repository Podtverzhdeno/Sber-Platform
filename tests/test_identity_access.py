"""OpenSpec identity-access scenarios and security regression tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.api.errors import ApiError
from impulse.application.access import load_authorized
from impulse.application.identity import DemoAuthService, MemoryIdentityStore, demo_personas
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.identity import (
    ROLE_SCOPES,
    ActorContext,
    ProtectedObject,
    Role,
    can_read,
    can_write,
)


def _test_settings() -> Settings:
    return Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("test-session-secret-with-more-than-32-chars"),
        session_ttl_seconds=600,
    )


def _test_client_with_clock() -> tuple[TestClient, list[datetime]]:
    clock = [datetime(2026, 9, 27, 12, 0, tzinfo=UTC)]
    settings = _test_settings()
    service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
        now=lambda: clock[0],
    )
    return TestClient(create_app(settings, auth_service=service)), clock


@pytest.mark.spec("identity-access/Несколько рабочих ролей")
def test_demo_login_me_and_role_switch_cannot_expand_scope() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        login = client.post("/api/v1/auth/demo-login", json={"persona_key": "manager-olga"})
        assert login.status_code == 200
        body = login.json()
        assert body["assigned_roles"] == ["manager", "customer"]
        assert body["active_role"] == "manager"
        csrf = body["csrf_token"]

        switched = client.post(
            "/api/v1/me/active-role",
            json={"role": "customer"},
            headers={"X-CSRF-Token": csrf},
        )
        assert switched.status_code == 200
        assert switched.json()["scopes"] == sorted(ROLE_SCOPES[Role.CUSTOMER])
        assert client.get("/api/v1/me").json()["active_role"] == "customer"

        rejected = client.post(
            "/api/v1/me/active-role",
            json={"role": "operator"},
            headers={"X-CSRF-Token": csrf},
        )
        assert rejected.status_code == 403
        assert rejected.json()["code"] == "ROLE_NOT_ASSIGNED"


def test_signed_cookie_csrf_logout_and_tampering() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        response = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        cookie = response.headers["set-cookie"]
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie
        assert "Path=/" in cookie
        csrf = response.json()["csrf_token"]

        missing_csrf = client.post("/api/v1/auth/logout")
        assert missing_csrf.status_code == 403
        assert missing_csrf.json()["code"] == "CSRF_INVALID"

        original = client.cookies.get("impulse_session")
        assert original is not None
        client.cookies.set("impulse_session", f"{original}tampered")
        tampered = client.get("/api/v1/me")
        assert tampered.status_code == 401

        client.cookies.set("impulse_session", original)
        logout = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        assert logout.status_code == 204
        assert client.get("/api/v1/me").status_code == 401


def test_production_cookie_sets_secure_flag() -> None:
    settings = Settings(
        app_env=AppEnvironment.PRODUCTION,
        demo_mode=True,
        database_url=SecretStr("postgresql://unused.test/impulse"),
        session_secret=SecretStr("production-session-secret-with-more-than-32-chars"),
    )
    service = DemoAuthService(
        MemoryIdentityStore(demo_personas()),
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    with TestClient(create_app(settings, auth_service=service)) as client:
        response = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
    assert "Secure" in response.headers["set-cookie"]


def test_expired_server_session_is_rejected() -> None:
    client, clock = _test_client_with_clock()
    with client:
        assert (
            client.post(
                "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
            ).status_code
            == 200
        )
        clock[0] += timedelta(seconds=601)
        response = client.get("/api/v1/me")
        assert response.status_code == 401
        assert response.json()["code"] == "AUTH_REQUIRED"


@pytest.mark.spec("identity-access/Согласие на публичность")
def test_independent_consent_revoke_updates_visible_projection() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        login = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-maria"}
        ).json()
        csrf = login["csrf_token"]
        grant_trophy = client.put(
            "/api/v1/me/consents/public_trophies",
            json={"granted": True},
            headers={"X-CSRF-Token": csrf},
        )
        grant_hr = client.put(
            "/api/v1/me/consents/hr_profile",
            json={"granted": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert grant_trophy.status_code == grant_hr.status_code == 200

        revoke = client.put(
            "/api/v1/me/consents/public_trophies",
            json={"granted": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert revoke.status_code == 200
        assert revoke.json()["granted_scopes"] == ["hr_profile"]
        assert client.get("/api/v1/me").json()["consent_scopes"] == ["hr_profile"]


def test_talent_visibility_evidence_and_invitations_are_independent() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        csrf = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-maria"}
        ).json()["csrf_token"]
        for scope in ("talent_profile", "talent_evidence", "talent_invitations"):
            response = client.put(
                f"/api/v1/me/consents/{scope}",
                json={"granted": True},
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200
        revoke = client.put(
            "/api/v1/me/consents/talent_evidence",
            json={"granted": False},
            headers={"X-CSRF-Token": csrf},
        )
        assert revoke.status_code == 200
        assert "talent_evidence" not in revoke.json()["granted_scopes"]
        assert "talent_profile" in revoke.json()["granted_scopes"]
        assert "talent_invitations" in revoke.json()["granted_scopes"]


def test_profile_preferences_and_skill_provenance_survive_new_session() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        login = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        ).json()
        csrf = login["csrf_token"]
        initial = client.get("/api/v1/me/profile")
        assert initial.status_code == 200
        assert {item["origin"] for item in initial.json()["skills"]} >= {
            "imported",
            "verified_course",
            "verified_project",
        }

        updated = client.put(
            "/api/v1/me/profile",
            headers={"X-CSRF-Token": csrf},
            json={
                "display_name": "Алекс Речной-Петров",
                "city": "Амман",
                "university": "МГТУ",
                "study_year": "4 курс",
                "primary_track": "Python-разработчик",
                "email": "alex@example.test",
                "telegram": "@alex_data",
                "about": "Развиваю backend и аналитику.",
                "locale": "en-US",
                "theme": "system",
                "timezone": "Asia/Amman",
                "skills": ["FastAPI", "Визуализация данных"],
            },
        )
        assert updated.status_code == 200
        payload = updated.json()
        self_reported = [item for item in payload["skills"] if item["origin"] == "self_reported"]
        assert {item["title"] for item in self_reported} == {
            "FastAPI",
            "Визуализация данных",
        }
        assert all(item["verified"] is False for item in self_reported)
        assert any(item["verified"] is True for item in payload["skills"])

        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        relogin = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert relogin.status_code == 200
        assert relogin.json()["display_name"] == "Алекс Речной-Петров"
        me = client.get("/api/v1/me").json()
        assert me["display_name"] == "Алекс Речной-Петров"
        assert me["locale"] == "en-US"
        assert me["timezone"] == "Asia/Amman"
        refreshed = client.get("/api/v1/me/profile").json()
        assert refreshed["locale"] == "en-US"
        assert refreshed["theme"] == "system"
        assert refreshed["timezone"] == "Asia/Amman"


def test_profile_update_rejects_other_roles_and_invalid_timezone() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        customer = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "customer-roman"}
        ).json()
        assert client.get("/api/v1/me/profile").status_code == 403
        forbidden = client.put(
            "/api/v1/me/profile",
            headers={"X-CSRF-Token": customer["csrf_token"]},
            json={"display_name": "Роман", "timezone": "Europe/Moscow"},
        )
        assert forbidden.status_code == 403

        participant = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-maria"}
        ).json()
        invalid = client.put(
            "/api/v1/me/profile",
            headers={"X-CSRF-Token": participant["csrf_token"]},
            json={"display_name": "Мария", "timezone": "Mars/Olympus"},
        )
        assert invalid.status_code == 422
        assert invalid.json()["code"] == "PROFILE_TIMEZONE_UNSUPPORTED"


def test_buddy_gate_default_on_and_persists_opt_out() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        login = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-maria"}
        ).json()
        default = client.get("/api/v1/me/profile")
        assert default.status_code == 200
        assert default.json()["buddy_enabled"] is True
        client.put(
            "/api/v1/me/profile",
            headers={"X-CSRF-Token": login["csrf_token"]},
            json={"display_name": "Мария Северова", "buddy_enabled": False},
        )
        refreshed = client.get("/api/v1/me/profile").json()
        assert refreshed["buddy_enabled"] is False
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": login["csrf_token"]})
        client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-maria"})
        after_relogin = client.get("/api/v1/me/profile").json()
        assert after_relogin["buddy_enabled"] is False


def test_hr_visibility_matrix_defaults_and_per_category_persistence() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        login = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        ).json()
        csrf = login["csrf_token"]
        granted = client.put(
            "/api/v1/me/consents/hr_profile",
            headers={"X-CSRF-Token": csrf},
            json={"granted": True},
        )
        assert granted.status_code == 200
        defaults = client.get("/api/v1/me/visibility").json()["visibility"]
        assert defaults == {
            "hr_basic": True,
            "hr_skills": True,
            "hr_projects": True,
            "hr_achievements": True,
            "hr_learning": True,
            "hr_contacts": False,
        }
        for scope, visible in (
            ("hr_skills", False),
            ("hr_projects", False),
            ("hr_achievements", True),
            ("hr_learning", False),
            ("hr_contacts", True),
            ("hr_basic", True),
        ):
            response = client.put(
                f"/api/v1/me/visibility/{scope}",
                headers={"X-CSRF-Token": csrf},
                json={"visible": visible},
            )
            assert response.status_code == 200
        matrix = client.get("/api/v1/me/visibility").json()["visibility"]
        assert matrix["hr_skills"] is False
        assert matrix["hr_projects"] is False
        assert matrix["hr_learning"] is False
        assert matrix["hr_contacts"] is True
        client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        relogin = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        client.get("/api/v1/me/visibility").json()
        assert relogin.status_code == 200
        persisted = client.get("/api/v1/me/visibility").json()["visibility"]
        assert persisted["hr_contacts"] is True
        assert persisted["hr_learning"] is False
        for scope in ("hr_skills", "hr_projects", "hr_achievements", "hr_learning", "hr_contacts"):
            forbidden_code = client.put(
                f"/api/v1/me/visibility/{scope}",
                headers={"X-CSRF-Token": relogin.json()["csrf_token"]},
                json={"visible": False},
            ).status_code
            assert forbidden_code == 200


def test_hr_visibility_requires_master_consent_and_participant_role() -> None:
    client, _clock = _test_client_with_clock()
    with client:
        customer = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "customer-roman"}
        ).json()
        assert (
            client.put(
                "/api/v1/me/visibility/hr_skills",
                headers={"X-CSRF-Token": customer["csrf_token"]},
                json={"visible": True},
            ).status_code
            == 403
        )

        alex = client.post(
            "/api/v1/auth/demo-login", json={"persona_key": "participant-alex"}
        ).json()
        locked = client.put(
            "/api/v1/me/visibility/hr_contacts",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"visible": True},
        )
        assert locked.status_code == 409
        assert locked.json()["code"] == "HR_VISIBILITY_LOCKED"

        revoke = client.put(
            "/api/v1/me/consents/hr_profile",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"granted": False},
        )
        assert revoke.status_code == 200
        still_locked = client.put(
            "/api/v1/me/visibility/hr_projects",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"visible": True},
        )
        assert still_locked.status_code == 409

        unknown = client.put(
            "/api/v1/me/visibility/hr_unknown",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"visible": True},
        )
        assert unknown.status_code == 404

        grant = client.put(
            "/api/v1/me/consents/hr_profile",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"granted": True},
        )
        assert grant.status_code == 200
        opened = client.put(
            "/api/v1/me/visibility/hr_projects",
            headers={"X-CSRF-Token": alex["csrf_token"]},
            json={"visible": True},
        )
        assert opened.status_code == 200


def actor(role: Role) -> ActorContext:
    person_id = UUID(int=list(Role).index(role) + 1)
    return ActorContext(
        person_id=person_id,
        display_name=role.value,
        active_role=role,
        assigned_roles=(role,),
        scopes=ROLE_SCOPES[role],
        program_key="test",
        consent_scopes=frozenset(),
    )


@pytest.mark.parametrize(
    "role",
    [Role.PARTICIPANT, Role.MENTOR, Role.CUSTOMER, Role.MANAGER, Role.HR, Role.OPERATOR],
)
def test_object_policy_matrix_covers_all_six_roles_and_foreign_objects(role: Role) -> None:
    current = actor(role)
    own = ProtectedObject(
        owner_id=current.person_id,
        mentor_id=current.person_id,
        customer_id=current.person_id,
        manager_id=current.person_id,
        hr_person_ids=frozenset({current.person_id}),
        operator_visible=True,
    )
    foreign = ProtectedObject(
        owner_id=uuid4(),
        mentor_id=uuid4(),
        customer_id=uuid4(),
        manager_id=uuid4(),
        hr_person_ids=frozenset({uuid4()}),
        operator_visible=False,
    )
    assert can_read(current, own)
    assert not can_read(current, foreign)
    assert can_write(current, own) is (role not in {Role.MANAGER, Role.HR})


@pytest.mark.parametrize(
    "role",
    [Role.PROGRAM_OWNER, Role.ACCESS_ADMIN, Role.UNIVERSITY_COORDINATOR],
)
def test_second_wave_roles_have_no_object_access_before_feature_enablement(role: Role) -> None:
    current = actor(role)
    resource = ProtectedObject(owner_id=current.person_id)
    assert not can_read(current, resource)
    assert not can_write(current, resource)


@pytest.mark.asyncio
async def test_unknown_and_forbidden_objects_have_identical_error() -> None:
    current = actor(Role.PARTICIPANT)

    async def absent() -> tuple[str, ProtectedObject] | None:
        return None

    async def forbidden() -> tuple[str, ProtectedObject] | None:
        return "secret", ProtectedObject(owner_id=uuid4())

    errors: list[ApiError] = []
    for loader in (absent, forbidden):
        with pytest.raises(ApiError) as captured:
            await load_authorized(loader, current, can_read)
        errors.append(captured.value)
    assert [(item.status_code, item.code, item.message) for item in errors] == [
        (404, "RESOURCE_NOT_FOUND", "Resource not found."),
        (404, "RESOURCE_NOT_FOUND", "Resource not found."),
    ]


def test_unknown_and_forbidden_api_responses_are_indistinguishable() -> None:
    current = actor(Role.PARTICIPANT)
    app = create_app(_test_settings())

    @app.get("/test/resources/{case}")
    async def protected(case: str) -> str:
        async def loader() -> tuple[str, ProtectedObject] | None:
            if case == "unknown":
                return None
            return "sensitive", ProtectedObject(owner_id=uuid4())

        return await load_authorized(loader, current, can_read)

    headers = {"X-Request-ID": "fixed-request-id"}
    with TestClient(app) as client:
        unknown = client.get("/test/resources/unknown", headers=headers)
        forbidden = client.get("/test/resources/forbidden", headers=headers)
    assert unknown.status_code == forbidden.status_code == 404
    assert unknown.json() == forbidden.json()
