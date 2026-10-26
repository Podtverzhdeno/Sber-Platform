"""Stage reviews update checkpoints without prematurely closing the whole project."""

from __future__ import annotations

import os
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import insert, select, text

from impulse.domain.work import AcceptanceDecision
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.identity import persons
from impulse.infrastructure.models.work import (
    applications,
    assignments,
    contributions,
    projects,
    tasks,
)
from impulse.infrastructure.work_store import SqlWorkStore

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_two_checkpoint_reviews_close_project_only_after_final_review() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required")
    db = Database(url)
    learner, customer = uuid4(), uuid4()
    project_id, task_id, application_id, assignment_id = (uuid4() for _ in range(4))
    suffix = uuid4().hex
    try:
        async with db.session() as session:
            await session.execute(
                insert(persons),
                [
                    {"id": learner, "display_name": "Learner", "external_key": f"l-{suffix}"},
                    {"id": customer, "display_name": "Customer", "external_key": f"c-{suffix}"},
                ],
            )
            await session.execute(
                insert(projects).values(
                    id=project_id, project_key=f"p-{suffix}", title="QA project"
                )
            )
            await session.execute(
                insert(tasks).values(
                    id=task_id,
                    project_id=project_id,
                    customer_id=customer,
                    task_key=f"t-{suffix}",
                    status="published",
                    payload={
                        "checkpoints": [
                            {"key": "prototype", "title": "Prototype", "status": "planned"},
                            {"key": "report", "title": "Report", "status": "planned"},
                        ]
                    },
                )
            )
            await session.execute(
                insert(applications).values(
                    id=application_id,
                    task_id=task_id,
                    person_id=learner,
                    accepted_terms_version=1,
                    status="accepted",
                )
            )
            await session.execute(
                insert(assignments).values(
                    id=assignment_id,
                    task_id=task_id,
                    person_id=learner,
                    application_id=application_id,
                    status="submitted",
                )
            )

        store = SqlWorkStore(db)
        for index, key in enumerate(("prototype", "report"), start=1):
            contribution_id = uuid4()
            async with db.session() as session:
                await session.execute(
                    insert(contributions).values(
                        id=contribution_id,
                        assignment_id=assignment_id,
                        contribution_version=index,
                        summary=f"Evidence for {key}",
                        status="submitted",
                    )
                )
                await session.execute(
                    text(
                        "INSERT INTO checkpoint_submissions "
                        "(contribution_id, assignment_id, checkpoint_key) "
                        "VALUES (:contribution, :assignment, :checkpoint)"
                    ),
                    {
                        "contribution": contribution_id,
                        "assignment": assignment_id,
                        "checkpoint": key,
                    },
                )
            await store.decide_contribution(
                contribution_id,
                customer,
                AcceptanceDecision.ACCEPTED,
                "Customer checked and accepted this checkpoint",
                None,
                None,
            )
            async with db.sessions() as session:
                status = await session.scalar(
                    select(assignments.c.status).where(assignments.c.id == assignment_id)
                )
                payload = await session.scalar(select(tasks.c.payload).where(tasks.c.id == task_id))
            expected_status = "in_progress" if index == 1 else "accepted"
            assert status == expected_status
            assert isinstance(payload, dict)
            raw_stages = cast(object, payload["checkpoints"])
            assert isinstance(raw_stages, list)
            stage_rows = cast(list[dict[str, str]], raw_stages)
            assert [stage["status"] for stage in stage_rows] == (
                ["accepted", "planned"] if index == 1 else ["accepted", "accepted"]
            )
    finally:
        await db.close()
