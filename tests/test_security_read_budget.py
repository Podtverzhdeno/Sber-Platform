"""Ordinary screen navigation must not exhaust the search-specific budget.

Request-level rate limits are still active for auth, search, agent and write
traffic. These tests ensure read-model fans-out cannot masquerade as search.
"""

from fastapi.testclient import TestClient
from starlette.types import Receive, Scope, Send
from pydantic import SecretStr

from impulse.api.security import RequestRateLimiter, SecurityMiddleware
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings


def test_classifies_read_models_separately_from_search_and_agent_calls() -> None:
    classify = SecurityMiddleware.category
    assert classify("/api/v1/me/journey/snapshot", "GET") == "read"
    assert classify("/api/v1/me/rating/standings", "GET") == "read"
    assert classify("/api/v1/me/talent-passport", "GET") == "read"
    assert classify("/api/v1/me/analytics/journey", "GET") == "read"
    assert classify("/api/v1/me/journey/snapshot", "HEAD") == "read"
    assert classify("/api/v1/search?query=python", "GET") == "search"
    assert classify("/api/v1/agents/buddy/suggestion", "GET") == "agents"
    assert classify("/api/v1/auth/demo-login", "POST") == "auth"
    assert classify("/api/v1/me/bootcamp/impulse-study/lesson/0/complete", "POST") == "write"


def test_search_and_agent_limits_remain_strict_and_isolated() -> None:
    async def app(_scope: Scope, _receive: Receive, _send: Send) -> None:
        return

    middleware = SecurityMiddleware(app)
    limits = middleware.limiter.rules
    assert limits["search"].limit == 60
    assert limits["auth"].limit == 20
    assert limits["agents"].limit == 30
    assert limits["write"].limit == 120
    assert 60 < limits["read"].limit <= 240
    limiter = RequestRateLimiter(limits)
    for _ in range(limits["search"].limit):
        assert limiter.allow("search", "owner", now=100)
    assert not limiter.allow("search", "owner", now=100)
    # A burst in the search bucket must not consume the same person's reads.
    for _ in range(100):
        assert limiter.allow("read", "owner", now=100)
    # A sustained read burst remains bounded and resets after a minute.
    for _ in range(limits["read"].limit - 100):
        assert limiter.allow("read", "owner", now=100)
    assert not limiter.allow("read", "owner", now=100)
    assert limiter.allow("read", "owner", now=161)


def test_sixty_plus_browser_screen_reads_do_not_get_rate_limited() -> None:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        database_url=None,
        session_secret=SecretStr("cross-screen-rate-budget-test-secret"),
    )
    with TestClient(create_app(settings)) as client:
        for _ in range(85):
            response = client.get("/health/live")
            assert response.status_code == 200, response.text
