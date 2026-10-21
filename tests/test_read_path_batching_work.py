"""Work-store read batching acceptance: identical payloads with batched queries."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from impulse.application.work import (
    AssignmentRecord,
    ContributionRecord,
    MemoryWorkStore,
    TaskRecord,
    TermsRecord,
)
from impulse.bootstrap.app import create_app
from impulse.bootstrap.settings import AppEnvironment, Settings
from impulse.domain.reward import CompensationTerms, RoundingMode
from impulse.domain.work import (
    AcceptanceDecision,
    AssignmentStatus,
    TaskAggregate,
    TaskBrief,
    TaskMode,
    TaskStatus,
)


def client() -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env=AppEnvironment.TEST,
                demo_mode=True,
                database_url=None,
                session_secret=SecretStr("batching-work-test-secret-long-enough"),
            )
        )
    )


def login(api: TestClient, persona: str) -> str:
    response = api.post("/api/v1/auth/demo-login", json={"persona_key": persona})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def task_record(
    task_id: UUID | None = None, status: TaskStatus = TaskStatus.PUBLISHED
) -> TaskRecord:
    identifier = task_id or uuid4()
    return TaskRecord(
        project_key="demo-rd-lab",
        task_key=f"batching-{identifier.hex[:8]}",
        title="Батчинг бюдж чтения",
        aggregate=TaskAggregate(
            task_id=identifier,
            customer_id=UUID(int=1),
            brief=TaskBrief(problem="p", deliverable="d", data_constraints="c"),
            status=status,
        ),
        mode=TaskMode.OPEN,
    )


def terms(task_id: UUID, version: int = 1) -> TermsRecord:
    return TermsRecord(
        task_id,
        version,
        datetime.now(UTC),
        "deliverable",
        ("criteria",),
        "operator",
        CompensationTerms(
            paid=True,
            base_amount_per_assignee=Decimal("10000.00"),
            currency="RUB",
            b_multiplier=Decimal("1.5"),
            a_multiplier=Decimal("2.50"),
            quantum=Decimal("0.01"),
            rounding_mode=RoundingMode.HALF_UP,
            policy_version=1,
            payout_condition="После принятия личного вклада.",
        ),
    )


def assignment(
    task_id: UUID, person_id: UUID, assignment_id: UUID | None = None
) -> AssignmentRecord:
    return AssignmentRecord(
        assignment_id or uuid4(),
        task_id,
        person_id,
        uuid4(),
        AssignmentStatus.STAFFED,
        datetime.now(UTC),
    )


async def test_memory_tasks_for_ids_returns_only_existing_tasks() -> None:
    store = MemoryWorkStore()
    first = task_record()
    second = task_record()
    await store.create(first)
    await store.create(second)
    found = await store.tasks_for_ids((first.aggregate.task_id, second.aggregate.task_id, uuid4()))
    assert set(found) == {first.aggregate.task_id, second.aggregate.task_id}
    assert found[first.aggregate.task_id] == first
    assert await store.tasks_for_ids(()) == {}


async def test_memory_latest_terms_for_tasks_returns_latest_version() -> None:
    store = MemoryWorkStore()
    task_id = uuid4()
    record = task_record(task_id)
    await store.create(record)
    await store.add_terms(terms(task_id, 0))
    await store.add_terms(terms(task_id, 0))
    other = uuid4()
    await store.add_terms(terms(other, 0))
    found = await store.latest_terms_for_tasks((task_id, other))
    assert found[task_id].version == 2
    assert found[other].version == 1
    assert task_id not in await store.latest_terms_for_tasks(())
    missing = await store.latest_terms_for_tasks((uuid4(),))
    assert missing == {}


async def test_memory_accepted_terms_versions_filters_by_person_and_task() -> None:
    store = MemoryWorkStore()
    person_id = uuid4()
    task_id = uuid4()
    await store.accept_terms(person_id, task_id, 2)
    await store.accept_terms(uuid4(), task_id, 3)
    found = await store.accepted_terms_versions(person_id, (task_id, uuid4()))
    assert found == {task_id: 2}
    assert await store.accepted_terms_versions(person_id, ()) == {}


async def test_memory_invitations_for_person_tasks_filters_by_person() -> None:
    store = MemoryWorkStore()
    person_id = uuid4()
    task_id = uuid4()
    await store.invite(task_id, person_id, 1, datetime.now(UTC))
    await store.invite(uuid4(), person_id, 1, datetime.now(UTC))
    found = await store.invitations_for_person_tasks(person_id, (task_id, uuid4()))
    assert set(found) == {task_id}
    assert await store.invitations_for_person_tasks(person_id, ()) == {}


def brief() -> dict[str, object]:
    return {
        "task_key": "semantic-search-rd",
        "title": "Батчинг чтения витрины работ",
        "problem": "Пользователю сложно найти подходящую программу.",
        "deliverable": "Research document и MVP поиска.",
        "acceptance_criteria": ["Есть offline-метрика", "MVP воспроизводим"],
        "deadline_at": "2026-11-01T18:00:00Z",
        "data_constraints": "Только синтетические данные.",
        "ip_terms": "Результат доступен заказчику после приёмки.",
        "nominated_mentor_id": None,
        "compensation": {
            "paid": True,
            "base_amount_per_assignee": "10000.00",
            "currency": "RUB",
            "a_multiplier": "2.50",
            "quantum": "0.01",
            "rounding_mode": "half_up",
            "policy_version": 1,
            "payout_condition": "После принятия личного вклада и публикации оценки человеком.",
        },
    }


def test_marketplace_and_work_loads_stay_identical_with_batched_reads() -> None:
    api = client()
    with api:
        customer_csrf = login(api, "customer-roman")
        created = api.post(
            "/api/v1/customer/projects/demo-rd-lab/tasks",
            json=brief(),
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert created.status_code == 200
        task_id = created.json()["id"]
        api.post(
            f"/api/v1/customer/tasks/{task_id}/submit", headers={"X-CSRF-Token": customer_csrf}
        )
        operator_csrf = login(api, "operator-pavel")
        api.post(
            f"/api/v1/operations/tasks/{task_id}/moderate", headers={"X-CSRF-Token": operator_csrf}
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/support",
            json={"mode": "operator"},
            headers={"X-CSRF-Token": operator_csrf},
        )
        api.post(
            f"/api/v1/operations/tasks/{task_id}/publish",
            headers={"X-CSRF-Token": operator_csrf},
        )
        participant_csrf = login(api, "participant-alex")
        listing = api.get("/api/v1/marketplace/tasks")
        assert listing.status_code == 200
        entry = next(item for item in listing.json() if item["task"]["id"] == task_id)
        assert entry["invitation_status"] is None
        assert entry["accepted_terms_version"] is None
        version = entry["terms"]["version"]
        consent = api.post(
            f"/api/v1/me/tasks/{task_id}/terms-consent",
            json={"terms_version": version},
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert consent.status_code == 200
        applied = api.post(
            f"/api/v1/me/tasks/{task_id}/applications",
            headers={"X-CSRF-Token": participant_csrf},
        )
        assert applied.json()["status"] == "applied"
        detail = api.get(f"/api/v1/marketplace/tasks/{task_id}")
        assert detail.status_code == 200
        assert detail.json()["accepted_terms_version"] == version
        customer_csrf = login(api, "customer-roman")
        accepted = api.post(
            f"/api/v1/customer/applications/{applied.json()['id']}/accept",
            json={"expected_version": applied.json()["version"]},
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert accepted.status_code == 200
        participant_csrf = login(api, "participant-alex")
        refreshed = api.get("/api/v1/marketplace/tasks")
        assert refreshed.status_code == 200
        refreshed_entry = next(item for item in refreshed.json() if item["task"]["id"] == task_id)
        assert refreshed_entry["accepted_terms_version"] == version
        work = api.get("/api/v1/me/work")
        assert work.status_code == 200
        items = [item for item in work.json() if item["assignment"]["task_id"] == task_id]
        assert len(items) == 1
        item = items[0]
        assert item["assignment"]["id"] == accepted.json()["id"]
        assert item["terms"] == refreshed_entry["terms"]
        assert item["contributions"] == []
        assert item["decisions"] == []


async def test_memory_contributions_and_acceptances_grouped_batch() -> None:
    store = MemoryWorkStore()
    task_id = uuid4()
    await store.create(task_record(task_id))
    await store.add_terms(terms(task_id))
    first = await store.apply(UUID(int=1), task_id, 1)
    second = await store.apply(UUID(int=2), task_id, 1)
    first_assignment = await store.start_assignment(
        (await store.accept_application(first.id, 1, 2)).id
    )
    second_assignment = await store.start_assignment(
        (await store.accept_application(second.id, 1, 2)).id
    )
    first_contributions: list[ContributionRecord] = []
    second_contributions: list[ContributionRecord] = []
    for target, bucket in (
        (first_assignment, first_contributions),
        (second_assignment, second_contributions),
    ):
        bucket.append(await store.submit_contribution(target.id, "summary", ()))
    missing_assignment_id = uuid4()
    submissions = await store.contributions_for_assignments(
        (first_assignment.id, second_assignment.id, missing_assignment_id)
    )
    assert set(submissions) == {
        first_assignment.id,
        second_assignment.id,
        missing_assignment_id,
    }
    assert [item.version for item in submissions[first_assignment.id]] == [1]
    assert [item.version for item in submissions[second_assignment.id]] == [1]
    assert submissions[missing_assignment_id] == ()
    empty = assignment(task_id, uuid4())
    grouped = await store.contributions_for_assignments((first_assignment.id, empty.id))
    assert len(grouped[first_assignment.id]) == 1
    assert grouped[empty.id] == ()
    await store.decide_contribution(
        first_contributions[0].id,
        UUID(int=9),
        AcceptanceDecision.ACCEPTED,
        "Подтверждено проверкой",
        None,
        UUID(int=9),
    )
    decisions = await store.acceptances_for_contributions(
        (
            first_contributions[0].id,
            second_contributions[0].id,
            uuid4(),
        )
    )
    assert set(decisions) == {first_contributions[0].id}
    assert decisions[first_contributions[0].id].decision is AcceptanceDecision.ACCEPTED
    assert await store.acceptances_for_contributions(()) == {}
