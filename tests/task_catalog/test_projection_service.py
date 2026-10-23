"""In-memory integration of the canonical store → catalog projection path."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from impulse.api.errors import ApiError
from impulse.application.development import (
    DevelopmentService,
    MemoryCertificateStore,
    MemoryDevelopmentStore,
)
from impulse.application.identity import MemoryIdentityStore, demo_personas
from impulse.application.task_catalog import ApplicationState, CustomerVerification
from impulse.application.task_catalog_matching import TaskCatalogProjectionService
from impulse.application.work import (
    CatalogStage,
    MemoryWorkStore,
    TaskCatalogMetadata,
    TaskRecord,
    TermsRecord,
    WorkService,
)
from impulse.bootstrap.demo_seed import demo_id
from impulse.domain.development import TrackAttempt, TrackStatus
from impulse.domain.identity import ActorContext, Role
from impulse.domain.reward import CompensationTerms, RoundingMode
from impulse.domain.work import TaskAggregate, TaskBrief, TaskStatus


@pytest.mark.asyncio
async def test_canonical_projection_separates_plan_terms_and_participant_snapshots() -> None:
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
                customer_id=demo_id("manager-olga"),
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
            places=1,
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
    terms_record = TermsRecord(
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
    await store.add_terms(terms_record)
    work = WorkService(store)
    identity = MemoryIdentityStore(demo_personas())
    work.consent_store = identity
    development_store = MemoryDevelopmentStore()
    development = DevelopmentService(development_store, MemoryCertificateStore())
    service = TaskCatalogProjectionService(
        work,
        development,
        identity,
        demo_mode=True,
        now_provider=lambda: now,
    )
    actor = ActorContext(
        person_id=uuid4(),
        display_name="Synthetic participant",
        active_role=Role.PARTICIPANT,
        assigned_roles=(Role.PARTICIPANT,),
        scopes=frozenset(),
        program_key="impulse-demo",
        consent_scopes=frozenset(),
    )

    pairs = await service.pairs(actor)

    assert len(pairs) == 1
    item, terms = pairs[0]
    assert item.task_id == task_id
    assert terms.acceptance_criteria == ("Reproducible result",)

    foreign_actor = replace(actor, program_key="another-program")
    assert await service.pairs(foreign_actor) == ()
    with pytest.raises(ApiError) as foreign_detail:
        await work.task_detail(foreign_actor, task_id)
    assert foreign_detail.value.status_code == 404
    assert foreign_detail.value.message == "Resource not found."
    # An explicit customer record wins over the environment-wide demo fallback.
    assert item.customer.verification is CustomerVerification.UNVERIFIED
    verified_identity = MemoryIdentityStore(
        tuple(
            replace(persona, customer_verification="verified")
            if persona.key == "manager-olga"
            else persona
            for persona in demo_personas()
        )
    )
    verified_projection = TaskCatalogProjectionService(
        work,
        development,
        verified_identity,
        demo_mode=True,
        now_provider=lambda: now,
    )
    assert (await verified_projection.projections(actor))[0].customer.verification is (
        CustomerVerification.VERIFIED
    )
    assert [stage.position for stage in item.stage_plan.stages] == [1, 2, 3, 4, 5]
    assert all(stage.state.value == "planned" for stage in item.stage_plan.stages)
    assert any(benefit.condition == "Feedback after acceptance" for benefit in item.benefits)
    assert item.skill_impact[0].verification_required is True
    assert item.match.missing_factors == ("FORMAT_FIT",)
    assert item.match.percent != Decimal("100")  # No participant evidence is invented.

    previous_snapshot = item.match.source_snapshot_version
    previous_percent = item.match.percent
    await development_store.replace_attempts(
        actor.person_id,
        (TrackAttempt("data", 1, TrackStatus.ACTIVE),),
    )
    changed = (await service.projections(actor))[0]
    assert changed.match.source_snapshot_version != previous_snapshot
    assert changed.match.percent != previous_percent
    assert changed.match.reasons[0].source_refs[0].ref == changed.match.source_snapshot_version

    current_task = await store.get(task_id)
    assert current_task is not None
    await store.save(
        replace(
            current_task,
            catalog=replace(current_task.catalog, portfolio_permission="none"),
        )
    )
    without_portfolio = (await service.projections(actor))[0]
    assert all(benefit.benefit_type != "portfolio" for benefit in without_portfolio.benefits)

    await store.accept_terms(actor.person_id, task_id, terms_record.version)
    application = await store.apply(
        actor.person_id,
        task_id,
        terms_record.version,
        "assigned-catalog-0001",
    )
    assignment = await store.accept_application(
        application.id,
        expected_version=application.version,
        places=1,
    )
    assigned_item = (await service.projections(actor))[0]
    assert assigned_item.application_state is ApplicationState.ASSIGNED
    assert assigned_item.assignment_id == assignment.id

    await store.add_terms(replace(terms_record, version=2, deadline_at=now - timedelta(seconds=1)))
    expired_assigned_item = (await service.projections(actor))[0]
    assert expired_assigned_item.application_state is ApplicationState.ASSIGNED
    assert expired_assigned_item.eligibility.reason_codes == (
        "TASK_DEADLINE_PASSED",
        "TASK_FULL",
    )
    with pytest.raises(ApiError) as expired:
        await work.apply(actor, task_id, "expired-application-0001")
    assert expired.value.code == "TASK_DEADLINE_PASSED"
