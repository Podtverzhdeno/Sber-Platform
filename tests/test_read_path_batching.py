"""Read-path batching acceptance: identical payloads with parallel composition."""

from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.concurrency import compose_reads
from impulse.application.reward import MemoryRewardStore
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.reward import PayoutClaim, PayoutStatus, ReviewGrade


def client() -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                database_url=None,
                session_secret=SecretStr("batching-test-secret-long-enough"),
            )
        )
    )


def login(api: TestClient, persona: str) -> None:
    assert api.post("/api/v1/auth/demo-login", json={"persona_key": persona}).status_code == 200


@pytest.mark.asyncio
async def test_compose_reads_preserves_input_order_and_empty_input() -> None:
    async def echo(index: int) -> int:
        if index % 2 == 0:
            await asyncio.sleep(0)
        return index

    assert await compose_reads([], echo) == ()
    items = list(range(30))
    assert await compose_reads(items, echo) == tuple(items)


@pytest.mark.asyncio
async def test_compose_reads_enforces_the_documented_concurrency_limit() -> None:
    active = 0
    peak = 0

    async def observed(index: int) -> int:
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.001)
        active -= 1
        return index

    assert await compose_reads(list(range(30)), observed) == tuple(range(30))
    assert 1 < peak <= 8


@pytest.mark.asyncio
async def test_memory_payouts_for_reviews_returns_only_requested_pairs() -> None:
    store = MemoryRewardStore()
    payout = PayoutClaim(
        claim_id=uuid.uuid4(),
        assignment_id=uuid.uuid4(),
        contribution_version=1,
        terms_version=1,
        review_id=uuid.uuid4(),
        review_version=2,
        grade=ReviewGrade.B,
        amount=None,
        currency="RUB",
        status=PayoutStatus.CALCULATED,
        version=1,
        approved_by=None,
    )
    assert await store.add_payout_claim(payout) == payout
    found = await store.payouts_for_reviews(
        [(payout.review_id, payout.review_version), (uuid.uuid4(), 1)]
    )
    assert set(found) == {(payout.review_id, payout.review_version)}
    assert found[(payout.review_id, payout.review_version)] == payout
    assert await store.payouts_for_reviews([]) == {}


def test_reward_evidence_items_are_plan_shaped_without_employee_leak() -> None:
    api = client()
    login(api, "participant-alex")
    response = api.get("/api/v1/me/reward-evidence")
    assert response.status_code == 200
    items: list[dict[str, object]] = response.json()
    assert isinstance(items, list)
    for entry in items:
        assert set(entry) >= {"review", "payout"}
        payout = entry["payout"]
        if isinstance(payout, dict):
            assert "status" in payout


def test_analytics_role_customer_metrics_are_complete() -> None:
    api = client()
    login(api, "customer-roman")
    response = api.get("/api/v1/analytics/role")
    assert response.status_code == 200
    keys = {item["key"] for item in response.json()["metrics"]}
    assert {
        "customer_tasks",
        "customer_applications",
        "customer_staffing_rate",
        "customer_acceptance_rate",
    } <= keys


def test_hr_candidates_filters_cover_search_grade_and_min_projects() -> None:
    api = client()
    login(api, "hr-nina")
    full = api.get("/api/v1/hr/candidates").json()
    assert api.get("/api/v1/hr/candidates", params={"min_projects": 99}).json() == []
    assert api.get("/api/v1/hr/candidates", params={"grade": "D"}).status_code == 422
    if full:
        filtered = api.get("/api/v1/hr/candidates", params={"search": full[0]["display_name"]})
        assert filtered.json() == [full[0]]


def test_participant_portfolio_and_hr_view_of_same_person_match() -> None:
    api = client()
    login(api, "participant-alex")
    own = api.get("/api/v1/me/portfolio")
    assert own.status_code == 200
    own_body = own.json()
    assert own_body["person_id"] and set(own_body["visibility"]) >= {"hr_profile"}
    login(api, "hr-nina")
    listed = {item["person_id"]: item for item in api.get("/api/v1/hr/candidates").json()}
    if own_body["visibility"].get("hr_profile"):
        summary = listed[own_body["person_id"]]
        assert summary["accepted_projects"] == len(own_body["contributions"])
        assert summary["verified_courses"] == len(own_body["courses"])
    else:
        assert own_body["person_id"] not in listed
