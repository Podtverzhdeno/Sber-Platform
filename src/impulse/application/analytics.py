"""Explainable participant funnel and earnings projection."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from impulse.application.development import EnrollmentRecord
from impulse.application.reward import RewardWorkspaceItem
from impulse.application.work import WorkItem
from impulse.domain.development import CompletionStatus, TrackAttempt, TrackStatus
from impulse.domain.reward import PayoutStatus
from impulse.domain.work import AssignmentStatus, ContributionStatus


@dataclass(frozen=True, slots=True)
class FunnelStage:
    key: str
    title: str
    status: str
    completed: bool
    count: int


@dataclass(frozen=True, slots=True)
class EarningsBreakdown:
    calculated: Decimal
    approved: Decimal
    paid: Decimal
    failed: Decimal
    currency: str | None
    unknown_items: int


@dataclass(frozen=True, slots=True)
class ParticipantAnalytics:
    stages: tuple[FunnelStage, ...]
    successful: bool
    next_action: str
    earnings: EarningsBreakdown
    freshness: str
    generated_at: datetime


@dataclass(frozen=True, slots=True)
class Metric:
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


def ratio_metric(
    *,
    key: str,
    label: str,
    numerator: int,
    denominator: int,
    period_start: datetime,
    period_end: datetime,
    cohort: str,
    definition: str,
) -> Metric:
    value = (
        (Decimal(numerator) / Decimal(denominator) * Decimal(100)).quantize(Decimal("0.01"))
        if denominator > 0
        else None
    )
    return Metric(
        key,
        label,
        numerator,
        denominator,
        value,
        "percent",
        period_start,
        period_end,
        cohort,
        "fresh",
        definition,
    )


def count_metric(
    *,
    key: str,
    label: str,
    count: int,
    period_start: datetime,
    period_end: datetime,
    cohort: str,
    definition: str,
) -> Metric:
    return Metric(
        key,
        label,
        count,
        1,
        Decimal(count),
        "count",
        period_start,
        period_end,
        cohort,
        "fresh",
        definition,
    )


def participant_analytics(
    attempts: tuple[TrackAttempt, ...],
    enrollments: tuple[EnrollmentRecord, ...],
    work_items: tuple[WorkItem, ...],
    rewards: tuple[RewardWorkspaceItem, ...],
    *,
    generated_at: datetime,
) -> ParticipantAnalytics:
    active_tracks = sum(item.status is TrackStatus.ACTIVE for item in attempts)
    verified_courses = sum(item.status is CompletionStatus.VERIFIED for item in enrollments)
    active_work = sum(
        item.assignment.status
        in {
            AssignmentStatus.STAFFED,
            AssignmentStatus.IN_PROGRESS,
            AssignmentStatus.SUBMITTED,
            AssignmentStatus.REVISION_REQUESTED,
        }
        for item in work_items
    )
    accepted = sum(
        contribution.status is ContributionStatus.ACCEPTED
        for item in work_items
        for contribution in item.contributions
    )
    stages = (
        FunnelStage(
            "direction",
            "Направление выбрано",
            "completed" if active_tracks else "not_started",
            active_tracks > 0,
            active_tracks,
        ),
        FunnelStage(
            "learning",
            "Обучение подтверждено",
            "completed" if verified_courses else "not_started",
            verified_courses > 0,
            verified_courses,
        ),
        FunnelStage(
            "practice",
            "Реальный проект",
            "completed" if accepted else "in_progress" if active_work else "not_started",
            accepted > 0,
            active_work + accepted,
        ),
        FunnelStage(
            "verified_experience",
            "Опыт подтверждён",
            "completed" if accepted else "not_started",
            accepted > 0,
            accepted,
        ),
    )
    if active_tracks == 0:
        next_action = "Выберите профессиональное направление."
    elif verified_courses == 0:
        next_action = "Завершите следующий курс roadmap и дождитесь подтверждения."
    elif not work_items:
        next_action = "Выберите подходящую реальную задачу."
    elif accepted == 0:
        next_action = "Продолжите проект и отправьте личный вклад на приёмку."
    else:
        next_action = "Добавьте подтверждённый результат в резюме и выберите следующий шаг."

    totals = {key: Decimal("0") for key in ("calculated", "approved", "paid", "failed")}
    unknown = 0
    currency: str | None = None
    for item in rewards:
        payout = item.payout
        if payout is None or payout.amount is None:
            unknown += 1
            continue
        currency = currency or payout.currency
        if payout.status is PayoutStatus.CALCULATED:
            totals["calculated"] += payout.amount
        elif payout.status in {PayoutStatus.APPROVED, PayoutStatus.SENT_TO_PAYMENT_SYSTEM}:
            totals["approved"] += payout.amount
        elif payout.status is PayoutStatus.PAID:
            totals["paid"] += payout.amount
        elif payout.status is PayoutStatus.FAILED:
            totals["failed"] += payout.amount
    return ParticipantAnalytics(
        stages=stages,
        successful=stages[-1].completed,
        next_action=next_action,
        earnings=EarningsBreakdown(currency=currency, unknown_items=unknown, **totals),
        freshness="fresh",
        generated_at=generated_at,
    )
