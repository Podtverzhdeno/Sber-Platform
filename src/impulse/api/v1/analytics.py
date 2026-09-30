"""Role-scoped analytics API."""
# ruff: noqa: RUF001

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from impulse.api.errors import ApiError
from impulse.api.v1.identity import current_session
from impulse.application.analytics import (
    Metric,
    count_metric,
    participant_analytics,
    ratio_metric,
    suppress_small_cohort,
)
from impulse.application.identity import AuthenticatedSession
from impulse.domain.identity import Role

router = APIRouter()


class FunnelStageView(BaseModel):
    key: str
    title: str
    status: str
    completed: bool
    count: int


class EarningsView(BaseModel):
    calculated: Decimal
    approved: Decimal
    paid: Decimal
    failed: Decimal
    currency: str | None
    unknown_items: int


class ParticipantAnalyticsView(BaseModel):
    stages: list[FunnelStageView]
    successful: bool
    next_action: str
    earnings: EarningsView
    freshness: str
    generated_at: datetime


class MetricView(BaseModel):
    key: str
    label: str
    numerator: int
    denominator: int
    value: Decimal | None
    unit: str
    period_start: datetime
    period_end: datetime
    cohort: str
    freshness: str
    definition: str
    suppressed: bool
    suppression_reason: str | None


class RoleAnalyticsView(BaseModel):
    role: Role
    metrics: list[MetricView]


@router.get("/me/analytics/journey", response_model=ParticipantAnalyticsView)
async def participant_journey(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> ParticipantAnalyticsView:
    actor = authenticated.actor
    if actor.active_role is not Role.PARTICIPANT:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    projection = participant_analytics(
        await request.app.state.development_service.store.attempts(actor.person_id),
        await request.app.state.development_service.store.enrollments(actor.person_id),
        await request.app.state.work_service.participant_work(actor),
        await request.app.state.reward_service.participant_reward_evidence(actor),
        generated_at=datetime.now(UTC),
    )
    return ParticipantAnalyticsView.model_validate(projection, from_attributes=True)


def _metric_view(item: Metric) -> MetricView:
    return MetricView.model_validate(item, from_attributes=True)


@router.get("/analytics/role", response_model=RoleAnalyticsView)
async def role_analytics(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(current_session)],
) -> RoleAnalyticsView:
    actor = authenticated.actor
    end = datetime.now(UTC)
    start = end - timedelta(days=30)
    cohort = f"{actor.program_key}:{actor.active_role.value}:30d"
    metrics: list[Metric]
    if actor.active_role is Role.MENTOR:
        queue = await request.app.state.reward_service.mentor_review_queue(actor)
        overdue = sum(item.deadline_at < end for item in queue)
        metrics = [
            count_metric(
                key="mentor_backlog",
                label="Ожидают ревью",
                count=len(queue),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Назначенные ментору вклады, ожидающие завершения ревью.",
            ),
            ratio_metric(
                key="mentor_overdue_share",
                label="Доля просроченных",
                numerator=overdue,
                denominator=len(queue),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Просроченные ревью / все ожидающие ревью ментора.",
            ),
        ]
    elif actor.active_role is Role.CUSTOMER:
        tasks = await request.app.state.work_service.customer_tasks(actor)
        published = sum(item.aggregate.status.value == "published" for item in tasks)
        details = [
            await request.app.state.work_service.customer_task_detail(actor, item.aggregate.task_id)
            for item in tasks
        ]
        applications = sum(len(item.applications) for item in details)
        assignments = sum(len(item.assignments) for item in details)
        contributions = sum(len(item.contributions) for item in details)
        accepted = sum(
            decision.decision.value == "accepted"
            for item in details
            for decision in item.decisions
        )
        revisions = sum(
            decision.decision.value == "revision_requested"
            for item in details
            for decision in item.decisions
        )
        active_people = len(
            {assignment.person_id for item in details for assignment in item.assignments}
        )
        metrics = [
            count_metric(
                key="customer_tasks",
                label="Задачи заказчика",
                count=len(tasks),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Все задачи текущего заказчика.",
            ),
            ratio_metric(
                key="customer_publish_rate",
                label="Доля опубликованных",
                numerator=published,
                denominator=len(tasks),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Опубликованные задачи / все задачи заказчика.",
            ),
            count_metric(
                key="customer_applications",
                label="Заявки на задачи",
                count=applications,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Все заявки на собственные задачи заказчика.",
            ),
            count_metric(
                key="customer_active_people",
                label="Назначенные участники",
                count=active_people,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Уникальные участники с назначением на собственные задачи.",
            ),
            ratio_metric(
                key="customer_staffing_rate",
                label="Переход заявок в назначения",
                numerator=assignments,
                denominator=applications,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Назначения / заявки на собственные задачи.",
            ),
            ratio_metric(
                key="customer_submission_rate",
                label="Переход назначений в результат",
                numerator=contributions,
                denominator=assignments,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Сданные версии личного вклада / назначения; повторы учитываются.",
            ),
            ratio_metric(
                key="customer_acceptance_rate",
                label="Доля принятых результатов",
                numerator=accepted,
                denominator=accepted + revisions,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Принятые решения / все решения о приёмке и доработке.",
            ),
        ]
    elif actor.active_role is Role.MANAGER:
        overview = await request.app.state.work_service.manager_overview(actor)
        metrics = [
            ratio_metric(
                key="manager_reuse_rate",
                label="Повторное использование",
                numerator=overview.reused_result_count,
                denominator=overview.accepted_result_count,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition=(
                    "Повторно использованные результаты / принятые результаты "
                    "собственных инициатив."
                ),
            ),
            count_metric(
                key="manager_accepted_results",
                label="Принятые результаты",
                count=overview.accepted_result_count,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Принятые результаты собственных инициатив руководителя.",
            ),
        ]
    elif actor.active_role is Role.HR:
        events = await request.app.state.talent_service.events(actor)
        invitations = sum(item.stage.value == "invitation" for item in events)
        hires = sum(item.stage.value == "hire" for item in events)
        metrics = [
            count_metric(
                key="hr_invitations",
                label="Приглашения",
                count=invitations,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Отдельные human events приглашения кандидата.",
            ),
            ratio_metric(
                key="hr_hire_rate",
                label="Конверсия в найм",
                numerator=hires,
                denominator=invitations,
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition=(
                    "Human events найма / human events приглашения; рейтинг не создаёт стадии."
                ),
            ),
        ]
    elif actor.active_role is Role.OPERATOR:
        cases = await request.app.state.operations_service.cases(actor)
        resolved = sum(item.status.value == "resolved" for item in cases)
        metrics = [
            count_metric(
                key="operator_cases",
                label="Дела в контуре",
                count=len(cases),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Все доступные оператору дела единой очереди.",
            ),
            ratio_metric(
                key="operator_resolution_rate",
                label="Доля решённых",
                numerator=resolved,
                denominator=len(cases),
                period_start=start,
                period_end=end,
                cohort=cohort,
                definition="Решённые дела / все дела доступной очереди.",
            ),
        ]
    else:
        raise ApiError("RESOURCE_NOT_FOUND", "Resource not found.", 404)
    protected = [suppress_small_cohort(item) for item in metrics]
    return RoleAnalyticsView(
        role=actor.active_role, metrics=[_metric_view(item) for item in protected]
    )
