"""PostgreSQL adapter for customer task drafting and publication."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from impulse.api.errors import ApiError
from impulse.application.work import (
    AcceptanceRecord,
    ApplicationRecord,
    AssignmentRecord,
    CandidateReservation,
    CheckpointRecord,
    ContributionRecord,
    DisputeRecord,
    InvitationRecord,
    TaskRecord,
    TeamArtifactRecord,
    TeamRequestRecord,
    TermsRecord,
    WorkStore,
)
from impulse.domain.reward import CompensationTerms, RoundingMode
from impulse.domain.work import (
    AcceptanceDecision,
    ApplicationStatus,
    AssignmentStatus,
    CaseRubric,
    ContributionStatus,
    SupportAssignment,
    SupportMode,
    TaskAggregate,
    TaskBrief,
    TaskMode,
    TaskPolicyError,
    TaskStatus,
    accept_application,
    decide_contribution,
    open_authorship_dispute,
    start_assignment,
    submit_assignment,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.reward import compensation_terms
from impulse.infrastructure.models.work import (
    acceptances,
    appeals,
    applications,
    assignments,
    candidate_reservations,
    contributions,
    projects,
    task_invitations,
    task_terms_versions,
    tasks,
    team_request_versions,
)
from impulse.infrastructure.models.work import (
    artifacts as artifact_table,
)
from impulse.infrastructure.persistence import StaleVersionError, mutate_with_history


def _payload(record: TaskRecord) -> dict[str, object]:
    aggregate = record.aggregate
    return {
        "title": record.title,
        "places": record.places,
        "mode": record.mode.value,
        "competency_tags": list(record.competency_tags),
        "case_rubric": (
            {
                "version": record.case_rubric.version,
                "result": record.case_rubric.result,
                "reasoning": record.case_rubric.reasoning,
                "uncertainty": record.case_rubric.uncertainty,
                "ai_use": record.case_rubric.ai_use,
                "defense": record.case_rubric.defense,
            }
            if record.case_rubric
            else None
        ),
        "brief": {
            "problem": aggregate.brief.problem,
            "deliverable": aggregate.brief.deliverable,
            "acceptance_criteria": list(aggregate.brief.acceptance_criteria),
            "deadline_at": (
                aggregate.brief.deadline_at.isoformat()
                if aggregate.brief.deadline_at is not None
                else None
            ),
            "data_constraints": aggregate.brief.data_constraints,
            "ip_terms": aggregate.brief.ip_terms,
        },
        "nominated_mentor_id": (
            str(aggregate.nominated_mentor_id)
            if aggregate.nominated_mentor_id is not None
            else None
        ),
        "support": (
            {
                "mode": aggregate.support.mode.value,
                "assignee_id": (
                    str(aggregate.support.assignee_id)
                    if aggregate.support.assignee_id is not None
                    else None
                ),
            }
            if aggregate.support is not None
            else None
        ),
    }


def _record(row: Any) -> TaskRecord:
    payload = dict(row.payload)
    brief_data = dict(payload.get("brief", {}))
    deadline_raw = brief_data.get("deadline_at")
    support_data = payload.get("support")
    support = None
    if isinstance(support_data, dict):
        support_payload = cast(dict[str, object], support_data)
        assignee_raw = support_payload.get("assignee_id")
        support = SupportAssignment(
            SupportMode(str(support_payload["mode"])),
            UUID(str(assignee_raw)) if assignee_raw else None,
        )
    nominated_raw = payload.get("nominated_mentor_id")
    return TaskRecord(
        project_key=row.project_key,
        task_key=row.task_key,
        title=str(payload.get("title", row.task_key)),
        aggregate=TaskAggregate(
            task_id=row.id,
            customer_id=row.customer_id,
            brief=TaskBrief(
                problem=str(brief_data.get("problem", "")),
                deliverable=str(brief_data.get("deliverable", "")),
                acceptance_criteria=tuple(
                    str(item) for item in brief_data.get("acceptance_criteria", [])
                ),
                deadline_at=(datetime.fromisoformat(str(deadline_raw)) if deadline_raw else None),
                data_constraints=str(brief_data.get("data_constraints", "")),
                ip_terms=str(brief_data.get("ip_terms", "")),
            ),
            status=TaskStatus(
                TaskStatus.PUBLISHED.value
                if row.status in {"accepted", "in_progress"}
                else row.status
            ),
            nominated_mentor_id=UUID(str(nominated_raw)) if nominated_raw else None,
            support=support,
        ),
        places=int(payload.get("places", 1)),
        mode=TaskMode(str(payload.get("mode", TaskMode.OPEN.value))),
        competency_tags=tuple(str(item) for item in payload.get("competency_tags", [])),
        case_rubric=(
            CaseRubric(**dict(payload["case_rubric"]))
            if isinstance(payload.get("case_rubric"), dict)
            else None
        ),
    )


class SqlWorkStore(WorkStore):
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _select():
        return select(
            tasks.c.id,
            tasks.c.customer_id,
            tasks.c.task_key,
            tasks.c.status,
            tasks.c.payload,
            projects.c.project_key,
        ).join(projects, projects.c.id == tasks.c.project_id)

    async def create(self, record: TaskRecord) -> TaskRecord:
        async with self.database.session() as session:
            project_id = await session.scalar(
                select(projects.c.id).where(projects.c.project_key == record.project_key)
            )
            if project_id is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            existing = await session.scalar(
                select(tasks.c.id).where(
                    tasks.c.project_id == project_id,
                    tasks.c.task_key == record.task_key,
                )
            )
            if existing is not None:
                raise ApiError(
                    code="TASK_KEY_EXISTS", message="Ключ задачи уже используется.", status_code=409
                )
            await session.execute(
                insert(tasks).values(
                    id=record.aggregate.task_id,
                    project_id=project_id,
                    customer_id=record.aggregate.customer_id,
                    task_key=record.task_key,
                    status=record.aggregate.status.value,
                    payload=_payload(record),
                    data_origin="demo_runtime",
                    created_by=record.aggregate.customer_id,
                )
            )
        return record

    async def get(self, task_id: UUID) -> TaskRecord | None:
        async with self.database.sessions() as session:
            row = (await session.execute(self._select().where(tasks.c.id == task_id))).one_or_none()
            return _record(row) if row is not None else None

    async def save(self, record: TaskRecord) -> TaskRecord:
        async with self.database.session() as session:
            result = await session.execute(
                update(tasks)
                .where(tasks.c.id == record.aggregate.task_id)
                .values(
                    status=record.aggregate.status.value,
                    payload=_payload(record),
                    version=tasks.c.version + 1,
                )
                .returning(tasks.c.id)
            )
            if result.scalar_one_or_none() is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
        return record

    async def customer_tasks(self, customer_id: UUID) -> tuple[TaskRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    self._select()
                    .where(tasks.c.customer_id == customer_id)
                    .order_by(tasks.c.created_at.desc())
                )
            ).all()
            return tuple(_record(row) for row in rows)

    async def add_terms(self, terms: TermsRecord) -> TermsRecord:
        async with self.database.session() as session:
            exists = await session.scalar(select(tasks.c.id).where(tasks.c.id == terms.task_id))
            if exists is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            next_version = (
                int(
                    await session.scalar(
                        select(func.max(task_terms_versions.c.terms_version)).where(
                            task_terms_versions.c.task_id == terms.task_id
                        )
                    )
                    or 0
                )
                + 1
            )
            terms_id = uuid4()
            await session.execute(
                insert(task_terms_versions).values(
                    id=terms_id,
                    task_id=terms.task_id,
                    terms_version=next_version,
                    deadline_at=terms.deadline_at,
                    status="published",
                    data_origin="demo_runtime",
                    payload={
                        "deliverable": terms.deliverable,
                        "acceptance_criteria": list(terms.acceptance_criteria),
                        "support_mode": terms.support_mode,
                    },
                )
            )
            compensation = terms.compensation
            await session.execute(
                insert(compensation_terms).values(
                    task_terms_version_id=terms_id,
                    paid=compensation.paid,
                    base_amount=compensation.base_amount_per_assignee,
                    b_multiplier=compensation.b_multiplier,
                    a_multiplier=compensation.a_multiplier,
                    quantum=compensation.quantum,
                    rounding_mode=compensation.rounding_mode.value,
                    policy_version=compensation.policy_version,
                    payout_condition=compensation.payout_condition,
                    currency=compensation.currency,
                    status="published",
                    data_origin="demo_runtime",
                )
            )
        return TermsRecord(
            terms.task_id,
            next_version,
            terms.deadline_at,
            terms.deliverable,
            terms.acceptance_criteria,
            terms.support_mode,
            terms.compensation,
        )

    async def latest_terms(self, task_id: UUID) -> TermsRecord | None:
        return await self.terms_version(task_id, 0)

    async def terms_version(self, task_id: UUID, version: int) -> TermsRecord | None:
        async with self.database.sessions() as session:
            query = select(task_terms_versions).where(task_terms_versions.c.task_id == task_id)
            if version > 0:
                query = query.where(task_terms_versions.c.terms_version == version)
            else:
                query = query.order_by(task_terms_versions.c.terms_version.desc()).limit(1)
            row = (await session.execute(query)).mappings().one_or_none()
            if row is None:
                return None
            payload = dict(row["payload"])
            compensation_row = (
                (
                    await session.execute(
                        select(compensation_terms).where(
                            compensation_terms.c.task_terms_version_id == row["id"]
                        )
                    )
                )
                .mappings()
                .one()
            )
            paid = bool(compensation_row["paid"])
            base_amount = compensation_row["base_amount"]
            currency = compensation_row["currency"]
            if paid and compensation_row["data_origin"] == "demo_seed":
                # Compatibility for the first demo dataset, where every fourth
                # paid task accidentally omitted its amount.
                base_amount = base_amount or Decimal("50000")
                currency = currency or "RUB"
            return TermsRecord(
                task_id,
                row["terms_version"],
                row["deadline_at"],
                str(payload.get("deliverable", "")),
                tuple(str(item) for item in payload.get("acceptance_criteria", [])),
                str(payload["support_mode"]) if payload.get("support_mode") else None,
                CompensationTerms(
                    paid=paid,
                    base_amount_per_assignee=base_amount if paid else None,
                    currency=currency if paid else None,
                    b_multiplier=compensation_row["b_multiplier"],
                    a_multiplier=compensation_row["a_multiplier"],
                    quantum=compensation_row["quantum"],
                    rounding_mode=RoundingMode(compensation_row["rounding_mode"]),
                    policy_version=compensation_row["policy_version"],
                    payout_condition=compensation_row["payout_condition"],
                ),
            )

    async def published_tasks(self) -> tuple[TaskRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    self._select()
                    .where(tasks.c.status == TaskStatus.PUBLISHED.value)
                    .order_by(tasks.c.created_at.desc())
                )
            ).all()
            return tuple(_record(row) for row in rows)

    async def accepted_terms_version(self, person_id: UUID, task_id: UUID) -> int | None:
        async with self.database.sessions() as session:
            return await session.scalar(
                select(applications.c.accepted_terms_version).where(
                    applications.c.person_id == person_id,
                    applications.c.task_id == task_id,
                )
            )

    @staticmethod
    def _invitation(row: Any) -> InvitationRecord:
        return InvitationRecord(
            row.id, row.task_id, row.person_id, row.terms_version, row.status, row.expires_at
        )

    async def invitation(self, task_id: UUID, person_id: UUID) -> InvitationRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(task_invitations).where(
                        task_invitations.c.task_id == task_id,
                        task_invitations.c.person_id == person_id,
                    )
                )
            ).one_or_none()
            return self._invitation(row) if row else None

    @staticmethod
    def _team_request(row: Any) -> TeamRequestRecord:
        payload = dict(row.payload)
        return TeamRequestRecord(
            row.request_id,
            row.owner_id,
            row.request_version,
            str(payload["title"]),
            tuple(str(item) for item in payload["required_tags"]),
            tuple(str(item) for item in payload["preferred_tags"]),
            tuple(UUID(str(item)) for item in payload["relevant_case_task_ids"]),
        )

    async def team_request(self, request_id: UUID) -> TeamRequestRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(team_request_versions)
                    .where(team_request_versions.c.request_id == request_id)
                    .order_by(team_request_versions.c.request_version.desc())
                    .limit(1)
                )
            ).one_or_none()
            return self._team_request(row) if row else None

    async def save_team_request(self, record: TeamRequestRecord) -> TeamRequestRecord:
        async with self.database.session() as session:
            latest = await session.scalar(
                select(func.max(team_request_versions.c.request_version)).where(
                    team_request_versions.c.request_id == record.id
                )
            )
            if record.version != (latest or 0) + 1:
                raise ApiError(
                    code="STALE_TEAM_REQUEST", message="Запрос команды изменился.", status_code=409
                )
            await session.execute(
                insert(team_request_versions).values(
                    request_id=record.id,
                    owner_id=record.owner_id,
                    request_version=record.version,
                    created_by=record.owner_id,
                    payload={
                        "title": record.title,
                        "required_tags": list(record.required_tags),
                        "preferred_tags": list(record.preferred_tags),
                        "relevant_case_task_ids": [
                            str(item) for item in record.relevant_case_task_ids
                        ],
                    },
                )
            )
            return record

    @staticmethod
    def _reservation(row: Any) -> CandidateReservation:
        return CandidateReservation(
            row.id,
            row.owner_id,
            row.request_id,
            row.person_id,
            row.evidence_contribution_id,
            row.created_at,
        )

    async def save_reservation(self, record: CandidateReservation) -> CandidateReservation:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    insert(candidate_reservations)
                    .values(
                        id=record.id,
                        owner_id=record.owner_id,
                        request_id=record.request_id,
                        person_id=record.person_id,
                        evidence_contribution_id=record.evidence_contribution_id,
                        created_by=record.owner_id,
                    )
                    .on_conflict_do_nothing(
                        constraint="uq_candidate_reservations_owner_id_request_id_person_id"
                    )
                    .returning(*candidate_reservations.c)
                )
            ).one_or_none()
            if row is None:
                row = (
                    await session.execute(
                        select(candidate_reservations).where(
                            candidate_reservations.c.owner_id == record.owner_id,
                            candidate_reservations.c.request_id == record.request_id,
                            candidate_reservations.c.person_id == record.person_id,
                        )
                    )
                ).one()
            return self._reservation(row)

    async def reservations(self, owner_id: UUID) -> tuple[CandidateReservation, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(candidate_reservations)
                    .where(candidate_reservations.c.owner_id == owner_id)
                    .order_by(candidate_reservations.c.created_at.desc())
                )
            ).all()
            return tuple(self._reservation(row) for row in rows)

    async def invite(
        self, task_id: UUID, person_id: UUID, terms_version: int, expires_at: datetime
    ) -> InvitationRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    insert(task_invitations)
                    .values(
                        task_id=task_id,
                        person_id=person_id,
                        terms_version=terms_version,
                        expires_at=expires_at,
                        status="pending",
                    )
                    .on_conflict_do_update(
                        constraint="uq_task_invitations_task_id_person_id",
                        set_={
                            "terms_version": terms_version,
                            "expires_at": expires_at,
                            "status": "pending",
                            "version": task_invitations.c.version + 1,
                        },
                        where=(task_invitations.c.status != "pending")
                        | (task_invitations.c.terms_version != terms_version)
                        | (task_invitations.c.expires_at != expires_at),
                    )
                    .returning(*task_invitations.c)
                )
            ).one_or_none()
            if row is None:
                row = (
                    await session.execute(
                        select(task_invitations).where(
                            task_invitations.c.task_id == task_id,
                            task_invitations.c.person_id == person_id,
                        )
                    )
                ).one()
            return self._invitation(row)

    async def decide_invitation(
        self, task_id: UUID, person_id: UUID, status: str
    ) -> InvitationRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    update(task_invitations)
                    .where(
                        task_invitations.c.task_id == task_id,
                        task_invitations.c.person_id == person_id,
                    )
                    .values(status=status, version=task_invitations.c.version + 1)
                    .returning(*task_invitations.c)
                )
            ).one()
            return self._invitation(row)

    async def accept_terms(self, person_id: UUID, task_id: UUID, version: int) -> None:
        async with self.database.session() as session:
            await session.execute(
                insert(applications)
                .values(
                    task_id=task_id,
                    person_id=person_id,
                    accepted_terms_version=version,
                    status="terms_accepted",
                    data_origin="demo_runtime",
                    created_by=person_id,
                )
                .on_conflict_do_update(
                    constraint="uq_applications_task_id_person_id",
                    set_={
                        "accepted_terms_version": version,
                        "status": "terms_accepted",
                        "version": applications.c.version + 1,
                    },
                )
            )

    @staticmethod
    def _application(row: Any) -> ApplicationRecord:
        return ApplicationRecord(
            row.id,
            row.task_id,
            row.person_id,
            row.accepted_terms_version,
            ApplicationStatus(row.status),
            row.version,
        )

    async def apply(self, person_id: UUID, task_id: UUID, terms_version: int) -> ApplicationRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(applications).where(
                        applications.c.person_id == person_id,
                        applications.c.task_id == task_id,
                    )
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="TERMS_NOT_ACCEPTED",
                    message="Подтвердите условия перед откликом.",
                    status_code=409,
                )
            record = self._application(row)
            if record.status is ApplicationStatus.TERMS_ACCEPTED:
                try:
                    await mutate_with_history(
                        session,
                        table=applications,
                        entity_id=record.id,
                        expected_version=record.version,
                        changes={"status": ApplicationStatus.APPLIED.value},
                        actor_id=person_id,
                        action="application.applied",
                        event_key=f"application:{record.id}:applied:v{record.version}",
                        event_type="work.application_applied",
                        event_payload={"task_id": task_id, "terms_version": terms_version},
                    )
                except StaleVersionError as exc:
                    raise ApiError("STALE_APPLICATION", "Application changed.", 409) from exc
                return ApplicationRecord(
                    record.id,
                    record.task_id,
                    record.person_id,
                    record.accepted_terms_version,
                    ApplicationStatus.APPLIED,
                    record.version + 1,
                )
            return record

    async def applications(self, task_id: UUID) -> tuple[ApplicationRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(applications)
                    .where(applications.c.task_id == task_id)
                    .order_by(applications.c.created_at)
                )
            ).all()
            return tuple(self._application(row) for row in rows)

    async def application(self, application_id: UUID) -> ApplicationRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(applications).where(applications.c.id == application_id)
                )
            ).one_or_none()
            return self._application(row) if row is not None else None

    async def accept_application(
        self, application_id: UUID, expected_version: int, places: int
    ) -> AssignmentRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(applications)
                    .where(applications.c.id == application_id)
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            application = self._application(row)
            await session.execute(
                select(tasks.c.id).where(tasks.c.id == application.task_id).with_for_update()
            )
            staffed_count = int(
                await session.scalar(
                    select(func.count())
                    .select_from(assignments)
                    .where(assignments.c.task_id == application.task_id)
                )
                or 0
            )
            try:
                status = accept_application(
                    application.status,
                    expected_version=expected_version,
                    actual_version=application.version,
                    staffed_count=staffed_count,
                    places=places,
                )
            except TaskPolicyError as exc:
                raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
            try:
                await mutate_with_history(
                    session,
                    table=applications,
                    entity_id=application.id,
                    expected_version=application.version,
                    changes={"status": status.value},
                    actor_id=None,
                    action="application.accepted",
                    event_key=f"application:{application.id}:accepted:v{application.version}",
                    event_type="work.application_accepted",
                    event_payload={"task_id": application.task_id},
                )
            except StaleVersionError as exc:
                raise ApiError("STALE_APPLICATION", "Application changed.", 409) from exc
            assignment_id = uuid4()
            await session.execute(
                insert(assignments).values(
                    id=assignment_id,
                    task_id=application.task_id,
                    person_id=application.person_id,
                    application_id=application.id,
                    status=AssignmentStatus.STAFFED.value,
                    data_origin="demo_runtime",
                    created_by=application.person_id,
                )
            )
            return AssignmentRecord(
                assignment_id,
                application.task_id,
                application.person_id,
                application.id,
                AssignmentStatus.STAFFED,
            )

    @staticmethod
    def _assignment(row: Any) -> AssignmentRecord:
        return AssignmentRecord(
            row.id,
            row.task_id,
            row.person_id,
            row.application_id,
            AssignmentStatus(row.status),
        )

    async def assignment(self, assignment_id: UUID) -> AssignmentRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(select(assignments).where(assignments.c.id == assignment_id))
            ).one_or_none()
            return self._assignment(row) if row is not None else None

    async def start_assignment(self, assignment_id: UUID) -> AssignmentRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(assignments).where(assignments.c.id == assignment_id).with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            current = self._assignment(row)
            try:
                status = start_assignment(current.status)
            except TaskPolicyError as exc:
                raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
            try:
                await mutate_with_history(
                    session,
                    table=assignments,
                    entity_id=assignment_id,
                    expected_version=row.version,
                    changes={"status": status.value},
                    actor_id=current.person_id,
                    action="assignment.started",
                    event_key=f"assignment:{assignment_id}:started:v{row.version}",
                    event_type="work.assignment_started",
                    event_payload={"task_id": current.task_id},
                )
            except StaleVersionError as exc:
                raise ApiError("STALE_ASSIGNMENT", "Assignment changed.", 409) from exc
            return AssignmentRecord(
                current.id,
                current.task_id,
                current.person_id,
                current.application_id,
                status,
            )

    async def add_checkpoint(self, task_id: UUID, checkpoint: CheckpointRecord) -> CheckpointRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(tasks.c.payload, tasks.c.version)
                    .where(tasks.c.id == task_id)
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            payload = dict(row.payload)
            current = [dict(item) for item in payload.get("checkpoints", [])]
            current = [item for item in current if item.get("key") != checkpoint.key]
            current.append(
                {"key": checkpoint.key, "title": checkpoint.title, "status": checkpoint.status}
            )
            payload["checkpoints"] = current
            await session.execute(
                update(tasks)
                .where(tasks.c.id == task_id)
                .values(payload=payload, version=tasks.c.version + 1)
            )
        return checkpoint

    async def add_team_artifact(
        self, task_id: UUID, artifact: TeamArtifactRecord
    ) -> TeamArtifactRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(tasks.c.payload).where(tasks.c.id == task_id).with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            payload = dict(row.payload)
            current = [dict(item) for item in payload.get("team_artifacts", [])]
            current = [item for item in current if item.get("key") != artifact.key]
            current.append({"key": artifact.key, "uri": artifact.uri})
            payload["team_artifacts"] = current
            await session.execute(
                update(tasks)
                .where(tasks.c.id == task_id)
                .values(payload=payload, version=tasks.c.version + 1)
            )
        return artifact

    async def submit_contribution(
        self, assignment_id: UUID, summary: str, artifacts: tuple[TeamArtifactRecord, ...]
    ) -> ContributionRecord:
        async with self.database.session() as session:
            assignment_row = (
                await session.execute(
                    select(assignments).where(assignments.c.id == assignment_id).with_for_update()
                )
            ).one_or_none()
            if assignment_row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            try:
                assignment_status = submit_assignment(AssignmentStatus(assignment_row.status))
            except TaskPolicyError as exc:
                raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
            next_version = (
                int(
                    await session.scalar(
                        select(func.max(contributions.c.contribution_version)).where(
                            contributions.c.assignment_id == assignment_id
                        )
                    )
                    or 0
                )
                + 1
            )
            contribution_id = uuid4()
            await session.execute(
                insert(contributions).values(
                    id=contribution_id,
                    assignment_id=assignment_id,
                    contribution_version=next_version,
                    summary=summary,
                    status="submitted",
                    data_origin="demo_runtime",
                    payload={"personal": True},
                )
            )
            for item in artifacts:
                await session.execute(
                    insert(artifact_table).values(
                        contribution_id=contribution_id,
                        artifact_key=item.key,
                        uri=item.uri,
                        status="submitted",
                        data_origin="demo_runtime",
                    )
                )
            await session.execute(
                update(assignments)
                .where(assignments.c.id == assignment_id)
                .values(status=assignment_status.value, version=assignments.c.version + 1)
            )
        return ContributionRecord(
            contribution_id,
            assignment_id,
            next_version,
            summary,
            tuple(item.key for item in artifacts),
        )

    @staticmethod
    async def _contribution(session: Any, contribution_id: UUID) -> ContributionRecord | None:
        row = (
            await session.execute(
                select(contributions).where(contributions.c.id == contribution_id)
            )
        ).one_or_none()
        if row is None:
            return None
        artifact_keys = tuple(
            await session.scalars(
                select(artifact_table.c.artifact_key)
                .where(artifact_table.c.contribution_id == contribution_id)
                .order_by(artifact_table.c.artifact_key)
            )
        )
        return ContributionRecord(
            row.id,
            row.assignment_id,
            row.contribution_version,
            row.summary,
            artifact_keys,
            ContributionStatus(row.status),
            row.created_at,
        )

    async def contribution(self, contribution_id: UUID) -> ContributionRecord | None:
        async with self.database.sessions() as session:
            return await self._contribution(session, contribution_id)

    async def decide_contribution(
        self,
        contribution_id: UUID,
        decided_by: UUID,
        decision: AcceptanceDecision,
        reason: str,
        deadline_at: datetime | None,
        owner_id: UUID | None,
    ) -> AcceptanceRecord:
        async with self.database.session() as session:
            row = (
                await session.execute(
                    select(contributions)
                    .where(contributions.c.id == contribution_id)
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            try:
                contribution_status, assignment_status = decide_contribution(
                    ContributionStatus(row.status),
                    decision,
                    reason=reason,
                    deadline_at=deadline_at,
                )
            except TaskPolicyError as exc:
                raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
            acceptance_id = uuid4()
            await session.execute(
                insert(acceptances).values(
                    id=acceptance_id,
                    contribution_id=contribution_id,
                    decided_by=decided_by,
                    contribution_version=row.contribution_version,
                    status=decision.value,
                    data_origin="demo_runtime",
                    created_by=decided_by,
                    payload={
                        "reason": reason,
                        "deadline_at": deadline_at.isoformat() if deadline_at else None,
                        "owner_id": str(owner_id) if owner_id else None,
                    },
                )
            )
            await session.execute(
                update(contributions)
                .where(contributions.c.id == contribution_id)
                .values(status=contribution_status.value, version=contributions.c.version + 1)
            )
            await session.execute(
                update(assignments)
                .where(assignments.c.id == row.assignment_id)
                .values(status=assignment_status.value, version=assignments.c.version + 1)
            )
        return AcceptanceRecord(
            acceptance_id,
            contribution_id,
            row.contribution_version,
            decision,
            reason,
            deadline_at,
            owner_id,
        )

    async def open_authorship_dispute(
        self,
        person_id: UUID,
        contribution_id: UUID,
        conflicting_contribution_id: UUID | None,
        reason: str,
        deadline_at: datetime,
    ) -> DisputeRecord:
        dispute_id = uuid4()
        target_ids = tuple(
            item for item in (contribution_id, conflicting_contribution_id) if item is not None
        )
        async with self.database.session() as session:
            rows = (
                await session.execute(
                    select(contributions)
                    .where(contributions.c.id.in_(target_ids))
                    .order_by(contributions.c.id)
                    .with_for_update()
                )
            ).all()
            if len(rows) != len(target_ids):
                raise ApiError(
                    code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
                )
            for row in rows:
                try:
                    status = open_authorship_dispute(
                        ContributionStatus(row.status), reason=reason, deadline_at=deadline_at
                    )
                except TaskPolicyError as exc:
                    raise ApiError(code=exc.code, message=str(exc), status_code=409) from exc
                await session.execute(
                    update(contributions)
                    .where(contributions.c.id == row.id)
                    .values(status=status.value, version=contributions.c.version + 1)
                )
                await session.execute(
                    update(assignments)
                    .where(assignments.c.id == row.assignment_id)
                    .values(
                        status=AssignmentStatus.DISPUTED.value, version=assignments.c.version + 1
                    )
                )
            primary = next(row for row in rows if row.id == contribution_id)
            await session.execute(
                insert(appeals).values(
                    id=dispute_id,
                    person_id=person_id,
                    subject_type="authorship",
                    subject_id=contribution_id,
                    subject_version=primary.contribution_version,
                    status="open",
                    data_origin="demo_runtime",
                    created_by=person_id,
                    payload={
                        "reason": reason,
                        "deadline_at": deadline_at.isoformat(),
                        "owner": "operations",
                        "conflicting_contribution_id": (
                            str(conflicting_contribution_id)
                            if conflicting_contribution_id is not None
                            else None
                        ),
                        "review_blocked": True,
                        "payout_blocked": True,
                    },
                )
            )
        return DisputeRecord(
            dispute_id,
            contribution_id,
            conflicting_contribution_id,
            "open",
            reason,
            deadline_at,
        )

    async def dispute(self, dispute_id: UUID) -> DisputeRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(appeals).where(
                        appeals.c.id == dispute_id,
                        appeals.c.subject_type == "authorship",
                    )
                )
            ).one_or_none()
        if row is None:
            return None
        payload = dict(row.payload)
        conflicting_id = payload.get("conflicting_contribution_id")
        return DisputeRecord(
            row.id,
            row.subject_id,
            UUID(str(conflicting_id)) if conflicting_id else None,
            row.status,
            str(payload["reason"]),
            datetime.fromisoformat(str(payload["deadline_at"])),
            str(payload.get("owner", "operations")),
            bool(payload.get("review_blocked", True)),
            bool(payload.get("payout_blocked", True)),
        )

    async def assignments_for_person(self, person_id: UUID) -> tuple[AssignmentRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(assignments)
                    .where(assignments.c.person_id == person_id)
                    .order_by(assignments.c.created_at.desc(), assignments.c.id)
                )
            ).all()
        return tuple(self._assignment(row) for row in rows)

    async def assignments_for_task(self, task_id: UUID) -> tuple[AssignmentRecord, ...]:
        async with self.database.sessions() as session:
            rows = (
                await session.execute(
                    select(assignments)
                    .where(assignments.c.task_id == task_id)
                    .order_by(assignments.c.created_at, assignments.c.id)
                )
            ).all()
        return tuple(self._assignment(row) for row in rows)

    async def contributions_for_assignment(
        self, assignment_id: UUID
    ) -> tuple[ContributionRecord, ...]:
        async with self.database.sessions() as session:
            contribution_ids = tuple(
                await session.scalars(
                    select(contributions.c.id)
                    .where(contributions.c.assignment_id == assignment_id)
                    .order_by(contributions.c.contribution_version)
                )
            )
            records = [
                await self._contribution(session, contribution_id)
                for contribution_id in contribution_ids
            ]
        return tuple(record for record in records if record is not None)

    async def acceptance_for_contribution(self, contribution_id: UUID) -> AcceptanceRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(
                    select(acceptances).where(acceptances.c.contribution_id == contribution_id)
                )
            ).one_or_none()
        if row is None:
            return None
        payload = dict(row.payload)
        deadline = payload.get("deadline_at")
        owner_id = payload.get("owner_id")
        return AcceptanceRecord(
            row.id,
            row.contribution_id,
            row.contribution_version,
            AcceptanceDecision(row.status),
            str(payload["reason"]),
            datetime.fromisoformat(str(deadline)) if deadline else None,
            UUID(str(owner_id)) if owner_id else None,
        )
