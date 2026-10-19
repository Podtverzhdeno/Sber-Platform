"""Origin, headers, request limits, rate buckets, and independent AI kill switches."""

import pytest
from fastapi.testclient import TestClient

from impulse.ai.gateway import ModelGatewayError, ModelPurpose
from impulse.ai.kill_switch import AgentKillSwitches
from impulse.api.security import RateRule, RequestRateLimiter
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def test_security_headers_unsafe_origin_and_oversized_payload() -> None:
    settings = Settings.model_validate(
        {
            "app_env": AppEnvironment.TEST,
            "allowed_origin": "https://impulse.example",
            "max_request_bytes": 1024,
        }
    )
    with TestClient(create_app(settings)) as client:
        live = client.get("/health/live")
        assert "unsafe-inline" not in live.headers["content-security-policy"]
        assert live.headers["x-frame-options"] == "DENY"
        unsafe = client.post(
            "/api/v1/auth/demo-login",
            headers={"Origin": "https://evil.example"},
            json={"persona_key": "participant-alex"},
        )
        assert unsafe.status_code == 403
        oversized = client.post(
            "/api/v1/auth/demo-login",
            content=b"x" * 1025,
            headers={"Content-Type": "application/json"},
        )
        assert oversized.status_code == 413


def test_same_origin_requests_are_accepted_without_allowed_origin_list() -> None:
    settings = Settings.model_validate(
        {
            "app_env": AppEnvironment.TEST,
            "session_secret": "security-controls-secret-long-enough",
            "demo_mode": True,
        }
    )
    with TestClient(create_app(settings)) as client:
        production_like = client.post(
            "/api/v1/auth/demo-login",
            headers={"Origin": "https://testserver"},
            json={"persona_key": "participant-alex"},
        )
        assert production_like.status_code == 200
        localhost_same = client.post(
            "/api/v1/auth/demo-login",
            headers={"Origin": "http://127.0.0.1:4173", "Host": "127.0.0.1:4173"},
            json={"persona_key": "participant-alex"},
        )
        assert localhost_same.status_code == 200
        localhost_other_port = client.post(
            "/api/v1/auth/demo-login",
            headers={"Origin": "http://127.0.0.1:4173", "Host": "127.0.0.1:8000"},
            json={"persona_key": "participant-alex"},
        )
        assert localhost_other_port.status_code == 403


def test_rate_limit_buckets_are_independent_by_category_and_actor() -> None:
    limiter = RequestRateLimiter({"auth": RateRule(1), "search": RateRule(1)})
    assert limiter.allow("auth", "actor-a", now=1)
    assert not limiter.allow("auth", "actor-a", now=2)
    assert limiter.allow("search", "actor-a", now=2)
    assert limiter.allow("auth", "actor-b", now=2)


def test_each_ai_kill_switch_is_independent_and_manual_path_survives() -> None:
    switches = AgentKillSwitches({purpose: True for purpose in ModelPurpose})
    switches.set_enabled(ModelPurpose.BUDDY, False)
    with pytest.raises(ModelGatewayError):
        switches.ensure_enabled(ModelPurpose.BUDDY)
    switches.ensure_enabled(ModelPurpose.MENTOR_REVIEW)
    assert switches.degraded_state(ModelPurpose.BUDDY)["status"] == "manual_available"
