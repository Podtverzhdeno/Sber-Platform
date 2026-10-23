"""HTTP/CSRF contract for the participant catalog analytics sink."""

from __future__ import annotations

from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from synthetic_fixtures import FIXTURES

from impulse.application.task_catalog import TaskRecommendationProjection
from impulse.application.task_catalog_analytics import (
    MemoryCatalogAnalyticsStore,
    TaskCatalogAnalyticsService,
)
from impulse.application.task_catalog_page import TaskCatalogPageService
from impulse.bootstrap.app import create_app
from impulse.domain.identity import ActorContext

EVENT_ID = UUID("00000000-0000-0000-0000-000000000902")
TASK_ID = FIXTURES[0].projection.task_id
UNAVAILABLE_TASK_ID = UUID("00000000-0000-0000-0000-000000000701")


def _app_with_visible_task() -> FastAPI:
    app = create_app()

    async def provider(_actor: ActorContext) -> tuple[TaskRecommendationProjection, ...]:
        return (FIXTURES[0].projection,)

    app.state.task_catalog_service = TaskCatalogPageService(provider)
    return app


def test_analytics_endpoint_is_csrf_protected_and_idempotent() -> None:
    with TestClient(_app_with_visible_task()) as client:
        login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert login.status_code == 200
        csrf = login.json()["csrf_token"]
        payload = {
            "event_id": str(EVENT_ID),
            "event_name": "application_result",
            "task_id": str(TASK_ID),
            "result": "success",
            "algorithm_version": "task-match-v1",
            "snapshot_version": "task-snapshot-1",
            "terms_version": 3,
        }
        path = "/api/v1/me/task-recommendations/analytics/events"
        assert client.post(path, json=payload).status_code == 403
        first = client.post(path, json=payload, headers={"X-CSRF-Token": csrf})
        second = client.post(path, json=payload, headers={"X-CSRF-Token": csrf})
        assert first.status_code == 202
        assert second.status_code == 202
        assert first.json()["duplicate"] is False
        assert second.json()["duplicate"] is True

        changed = {**payload, "snapshot_version": "task-snapshot-2"}
        conflict = client.post(path, json=changed, headers={"X-CSRF-Token": csrf})
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "ANALYTICS_EVENT_CONFLICT"


def test_analytics_rejects_an_unavailable_task_without_recording_its_id() -> None:
    app = create_app()
    store = MemoryCatalogAnalyticsStore()
    app.state.task_catalog_analytics_service = TaskCatalogAnalyticsService(store)
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/demo-login", json={"persona_key": "participant-alex"})
        assert login.status_code == 200
        response = client.post(
            "/api/v1/me/task-recommendations/analytics/events",
            json={
                "event_id": str(EVENT_ID),
                "event_name": "task_select",
                "task_id": str(UNAVAILABLE_TASK_ID),
            },
            headers={"X-CSRF-Token": login.json()["csrf_token"]},
        )

    assert response.status_code == 404
    assert response.json()["code"] == "RESOURCE_NOT_FOUND"
    assert str(UNAVAILABLE_TASK_ID) not in response.text
    assert store.events == ()
