"""Consent-filtered teammate quick card RBAC for workspace tasks."""

import asyncio
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.identity import (
    DemoAuthService,
    MemoryIdentityStore,
    demo_personas,
)
from impulse.application.work import (
    AssignmentRecord,
    ContributionRecord,
    MemoryWorkStore,
    WorkService,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.identity import ConsentScope
from impulse.domain.work import AssignmentStatus, ContributionStatus

_PERSONAS: dict[str, UUID] = {record.key: record.person_id for record in demo_personas()}
AUTIN = _PERSONAS["participant-alex"]
MARIA = _PERSONAS["participant-maria"]
MARIA_NAME = next(record.display_name for record in demo_personas() if record.person_id == MARIA)


def client() -> tuple[TestClient, MemoryWorkStore, MemoryIdentityStore]:
    settings = Settings(
        app_env=AppEnvironment.TEST,
        demo_mode=True,
        session_secret=SecretStr("quick-card-test-secret-long-enough"),
    )
    identity_store = MemoryIdentityStore(demo_personas())
    auth = DemoAuthService(
        identity_store,
        secret=settings.session_signing_secret(),
        ttl_seconds=settings.session_ttl_seconds,
    )
    work_store = MemoryWorkStore()
    api = TestClient(
        create_app(
            settings,
            auth_service=auth,
            work_service=WorkService(work_store),
        )
    )
    return api, work_store, identity_store


def seed_assignment(
    store: MemoryWorkStore,
    *,
    task_id: UUID,
    person_id: UUID,
    status: AssignmentStatus,
) -> UUID:
    assignment_id = uuid4()
    store._assignments[assignment_id] = AssignmentRecord(  # pyright: ignore[reportPrivateUsage]
        assignment_id, task_id, person_id, uuid4(), status
    )
    return assignment_id


def quick_card(api: TestClient, task_id: UUID, person_id: UUID, csrf: str):
    return api.get(
        f"/api/v1/me/tasks/{task_id}/team/{person_id}/quick-card",
        headers={"X-CSRF-Token": csrf},
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_quick_card_gates_hidden_fields_or_reveals_with_consent() -> None:
    api, work_store, identity_store = client()
    with api:
        task_id = uuid4()
        seed_assignment(
            work_store, task_id=task_id, person_id=AUTIN, status=AssignmentStatus.IN_PROGRESS
        )
        seed_assignment(
            work_store, task_id=task_id, person_id=MARIA, status=AssignmentStatus.SUBMITTED
        )
        asyncio.run(identity_store.set_consent(MARIA, ConsentScope.PUBLIC_PROFILE, False))
        csrf = login(api, "participant-alex")

        hidden = quick_card(api, task_id, MARIA, csrf)
        assert hidden.status_code == 200
        body = hidden.json()
        assert body["assignment_status"] == "submitted"
        assert body["contribution_status"] is None
        assert body["availability"] == "on_review"
        assert body["project_role"] == "Исполнитель"
        assert body["responsibility"] == "Личный вклад ещё не зафиксирован"
        assert body["display_name"] == MARIA_NAME
        assert body["portfolio_available"] is False
        assert body["profile"]["city"] is None
        assert body["profile"]["university"] is None
        assert body["profile"]["telegram"] is None
        assert body["profile"]["about"] is None
        assert body["profile"]["skills"] == []

        asyncio.run(identity_store.set_consent(MARIA, ConsentScope.PUBLIC_PROFILE, True))
        revealed = quick_card(api, task_id, MARIA, csrf)
        assert revealed.status_code == 200
        body = revealed.json()
        assert body["profile"]["city"] == ""
        assert body["profile"]["telegram"] == ""
        assert body["portfolio_available"] is True
        assert body["profile"]["skills"]
        for skill in body["profile"]["skills"]:
            assert set(skill) == {"title", "origin", "verified"}


def test_quick_card_requires_membership_for_requester_and_target() -> None:
    api, work_store, _ = client()
    with api:
        foreign_task, within_task = uuid4(), uuid4()
        seed_assignment(
            work_store, task_id=within_task, person_id=AUTIN, status=AssignmentStatus.STAFFED
        )
        seed_assignment(
            work_store, task_id=within_task, person_id=MARIA, status=AssignmentStatus.IN_PROGRESS
        )
        csrf = login(api, "participant-alex")

        foreign = quick_card(api, foreign_task, MARIA, csrf)
        assert foreign.status_code == 404

        stranger = uuid4()
        target_missing = quick_card(api, within_task, stranger, csrf)
        assert target_missing.status_code == 404

        own = quick_card(api, within_task, AUTIN, csrf)
        assert own.status_code == 200
        assert own.json()["assignment_status"] == "staffed"
        assert own.json()["availability"] == "available"


def test_quick_card_reports_latest_contribution_status() -> None:
    api, work_store, _ = client()
    with api:
        task_id = uuid4()
        assignment = seed_assignment(
            work_store, task_id=task_id, person_id=MARIA, status=AssignmentStatus.SUBMITTED
        )
        work_store._contributions[assignment] = (  # pyright: ignore[reportPrivateUsage]
            ContributionRecord(
                id=uuid4(),
                assignment_id=assignment,
                version=2,
                personal_summary="Повторная отправка после правок",
                artifact_keys=("personal-proof",),
                status=ContributionStatus.SUBMITTED,
            ),
        )
        seed_assignment(
            work_store, task_id=task_id, person_id=AUTIN, status=AssignmentStatus.IN_PROGRESS
        )
        csrf = login(api, "participant-alex")
        card = quick_card(api, task_id, MARIA, csrf)
        assert card.status_code == 200
        assert card.json()["contribution_status"] == "submitted"
        assert card.json()["responsibility"] == "Повторная отправка после правок"
