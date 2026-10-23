"""In-memory integration of the canonical store → catalog projection path."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from impulse.application.development import (
    DevelopmentService,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
)
from impulse.application.identity import MemoryIdentityStore, demo_personas
from impulse.application.task_catalog_matching import TaskCatalogProjectionService
from impulse.application.work import (
    CatalogStage,
    MemoryWorkStore,
    TaskCatalogMetadata,
    TaskRecord,
    TermsRecord,
    WorkService,
)
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import CompensationTerms, RoundingMode
from impulse.domain.work import TaskAggregate, TaskBrief, TaskStatus


@pytest.mark.asyncio
async def test_canonical_store_projection_keeps_stage_and_conditional_benefit_facts() -> None:
    now = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
    task_id = uuid4()
    store = MemoryWorkStore()
    await store.create(
        TaskRecord(
            project_key="synthetic-project",
            task_key="synthetic-task",
            title="Synthetic catalog task",
            aggregate=TaskAggregate(
                task_id=task_id,
                customer_id=uuid4(),
                status=TaskStatus.PUBLISHED,
                brief=TaskBrief(
                    problem="Validate a reproducible result with synthetic data.",
                    deliverable="Repository and report",
                    acceptance_criteria=("Reproducible result",),
                    deadline_at=now + timedelta(days=14),
                    data_constraints="Synthetic data only",
                    ip_terms="Participant authorship is preserved",
                ),
            ),
            places=2,
            competency_tags=("python",),
            catalog=TaskCatalogMetadata(
                direction_keys=("python",),
                duration_minutes=300,
                work_format="remote",
                stage_plan=tuple(
                    # The projection must derive positions instead of trusting client data.
                    CatalogStage(key=f"stage-{index}", title=f"Stage {index}", summary="Planned")
                    for index in range(1, 6)
                ),
                benefit_descriptions=("Feedback after acceptance",),
                portfolio_permission="conditional",
            ),
        )
    )
    await store.add_terms(
        TermsRecord(
            task_id=task_id,
            version=1,
            deadline_at=now + timedelta(days=14),
            deliverable="Repository and report",
            acceptance_criteria=("Reproducible result",),
            support_mode="mentor",
            compensation=CompensationTerms(
                paid=False,
                base_amount_per_assignee=None,
                currency=None,
                a_multiplier=Decimal("2"),
                quantum=Decimal("0.01"),
                rounding_mode=RoundingMode.HALF_UP,
                policy_version=1,
                payout_condition="No monetary compensation; feedback requires acceptance.",
            ),
        )
    )
    work = WorkService(store)
    development = DevelopmentService(MemoryDevelopmentStore(), MemoryCertificateStore())
    service = TaskCatalogProjectionService(
        work,
        development,
        MemoryIdentityStore(demo_personas()),
        demo_mode=True,
        now_provider=lambda: now,
    )
    actor = ActorContext(
        person_id=uuid4(),
        display_name="Synthetic participant",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="synthetic",
        consent_scopes=frozenset(),
    )

    items = await service.projections(actor)

    assert len(items) == 1
    item = items[0]
    assert item.task_id == task_id
    assert [stage.position for stage in item.stage_plan.stages] == [1, 2, 3, 4, 5]
    assert all(stage.state.value == "planned" for stage in item.stage_plan.stages)
    assert any(benefit.condition == "Feedback after acceptance" for benefit in item.benefits)
    assert item.skill_impact[0].verification_required is True
    assert item.match.missing_factors == ("FORMAT_FIT",)
    assert item.match.percent != Decimal("100")  # No participant evidence is invented.
