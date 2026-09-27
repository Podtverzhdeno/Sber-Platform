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


@pytest.mark.parametrize("role", list(Role))
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
