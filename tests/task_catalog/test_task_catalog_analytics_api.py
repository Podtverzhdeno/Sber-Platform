"""HTTP/CSRF contract for the participant catalog analytics sink."""

from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient

from impulse.bootstrap.app import create_app

EVENT_ID = UUID("00000000-0000-0000-0000-000000000902")
TASK_ID = UUID("00000000-0000-0000-0000-000000000701")


def test_analytics_endpoint_is_csrf_protected_and_idempotent() -> None:
    with TestClient(create_app()) as client:
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
