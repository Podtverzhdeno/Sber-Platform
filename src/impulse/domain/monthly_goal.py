"""Monthly goal projection over a published roadmap runway (openspec 24.6).

MONTHLY_GOAL_POLICY_VERSION=1:
- цель фиксирует таргетный checkpoint опубликованной дорожки; план — это
  обязательная цепочка checkpoint-ов до цели, а не редактируемый список;
- current контур двигают только ПОДТВЕРЖДЁННЫЕ checkpoints (evidence
  принято ментором); отправленный на проверку шаг попадает в projected
  («Ожидает проверки») и никогда не двигает current;
- projected контур — прогноз: подтверждённые + ожидающие проверки; он не
  может превысить target и не обещает достижение цели, если план не
  помещается в доступные дни недельного ритма;
- вместимость оценивается по активным дням ритма до конца месяца; часы
  и оценка времени шагов не учитываются и выносятся в допущения;
- неизвестные mappings (target не опубликован в каталоге) дают partial
  coverage, а не нулевой или выдуманный эффект;
- история целей по периоду хранит факт на момент создания и никогда не
  переписывается.
"""

from __future__ import annotations

import calendar as calendar_module
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from impulse.domain.development import RoadmapMilestone

MONTHLY_GOAL_POLICY_VERSION = 1

RUNWAY_STEP_COMPLETED = "completed"
RUNWAY_STEP_SUBMITTED = "submitted"
RUNWAY_STEP_AVAILABLE = "available"
RUNWAY_STEP_LOCKED = "locked"
RUNWAY_STEP_UNKNOWN = "unknown"

_CURRENT_MOVES = (
    "Текущий контур двигают только подтверждённые checkpoints: "
    "отправка и планирование его не передвигают."
)
_FORECAST_IS_LIMITED = (
    "Прогноз показывает подтверждённые и ожидающие проверки checkpoints; "
    "он никогда не заменяет подтверждённый паспорт."
)


@dataclass(frozen=True, slots=True)
class GoalRunwayStep:
    """One published checkpoint of the runway toward the goal target."""

    key: str
    position: int
    title: str
    skill: str
    mandatory: bool
    status: str
    ref: str

    @property
    def confirmed(self) -> bool:
        return self.status == RUNWAY_STEP_COMPLETED

    @property
    def awaiting(self) -> bool:
        return self.status == RUNWAY_STEP_SUBMITTED


@dataclass(frozen=True, slots=True)
class MonthlyGoalPlan:
    """Stored goal fact: baseline captured at creation, never rewritten."""

    period: date
    plan_version: int
    track_key: str
    milestone_key: str
    baseline_count: int
    created_by: str | None = None


@dataclass(frozen=True, slots=True)
class MonthlyGoalContours:
    """Versioned runway scale: baseline, current, projected, target counts."""

    baseline: int
    current: int
    projected: int
    target: int

    @property
    def projected_reaches_target(self) -> bool:
        return self.projected >= self.target


@dataclass(frozen=True, slots=True)
class GoalFeasibility:
    """Honest capacity math: rhythm has no per-hour estimates."""

    known: bool
    capacity_days: int
    required_steps: int
    feasible: bool
    deficit: int
    text: str


@dataclass(frozen=True, slots=True)
class MonthlyGoalProjection:
    """Home-card payload: contours, plan steps, feasibility, assumptions."""

    policy_version: int
    generated_at: datetime
    track_key: str
    track_title: str
    goal_title: str
    goal_ref: str
    period_start: date
    period_end: date
    days_left: int
    timezone: str
    plan_version: int
    history_count: int
    steps: tuple[GoalRunwayStep, ...]
    contours: MonthlyGoalContours
    next_checkpoint: str | None
    next_checkpoint_ref: str | None
    feasibility: GoalFeasibility
    partial_forecast: bool
    missing_mappings: tuple[str, ...]
    assumptions: tuple[str, ...] = field(default=())
    created_by: str | None = None


def month_bounds(local_today: date) -> tuple[date, date]:
    """First and last calendar day of the local month containing local_today."""
    month_end_day = calendar_module.monthrange(local_today.year, local_today.month)[1]
    return local_today.replace(day=1), local_today.replace(day=month_end_day)


def runway_step_status(
    milestone_key: str,
    mandatory: bool,
    *,
    confirmed: frozenset[str],
    submitted: frozenset[str],
    strict_blocked: bool,
    target_unknown: bool,
) -> str:
    """Status precedence: confirmed evidence outranks everything else."""
    if milestone_key in confirmed:
        return RUNWAY_STEP_COMPLETED
    if milestone_key in submitted:
        return RUNWAY_STEP_SUBMITTED
    if target_unknown:
        return RUNWAY_STEP_UNKNOWN
    if mandatory and strict_blocked:
        return RUNWAY_STEP_LOCKED
    return RUNWAY_STEP_AVAILABLE


def build_runway(
    requested_target_key: str,
    milestones: tuple[RoadmapMilestone, ...],
    *,
    confirmed: frozenset[str],
    submitted: frozenset[str],
    published_targets: frozenset[str],
) -> tuple[tuple[GoalRunwayStep, ...], tuple[str, ...]]:
    """Runway = published chain up to and including the target, with honest statuses.

    Возвращает (steps, missing_refs): шаг с неопубликованным target получает
    статус unknown — вместо выдуманного прогресса это partial coverage.
    """
    target = next((item for item in milestones if item.key == requested_target_key), None)
    if target is None:
        return (), ()
    steps: list[GoalRunwayStep] = []
    missing: list[str] = []
    blocked_seen = False
    for milestone in sorted(
        (item for item in milestones if item.position <= target.position),
        key=lambda item: item.position,
    ):
        target_unknown = milestone.target_key not in published_targets
        strict_blocked = blocked_seen
        status = runway_step_status(
            milestone.key,
            milestone.mandatory,
            confirmed=confirmed,
            submitted=submitted,
            strict_blocked=strict_blocked,
            target_unknown=target_unknown,
        )
        if status not in {RUNWAY_STEP_COMPLETED, RUNWAY_STEP_SUBMITTED} and milestone.mandatory:
            blocked_seen = True
        if target_unknown:
            missing.append(f"checkpoint:{milestone.key}")
        steps.append(
            GoalRunwayStep(
                key=milestone.key,
                position=milestone.position,
                title=milestone.title,
                skill=milestone.skill,
                mandatory=milestone.mandatory,
                status=status,
                ref=f"checkpoint:{milestone.key}",
            )
        )
    return tuple(steps), tuple(missing)


def rhythm_capacity_days(active_days: frozenset[int], *, including: date, until: date) -> int:
    """Count of rhythm active ISO weekdays within [including, until]."""
    capacity = 0
    cursor = including
    while cursor <= until:
        if cursor.isoweekday() in active_days:
            capacity += 1
        cursor += timedelta(days=1)
    return capacity


def build_monthly_goal_feasibility(
    steps: tuple[GoalRunwayStep, ...],
    active_days: frozenset[int],
    *,
    local_today: date,
    period_end: date,
) -> GoalFeasibility:
    """Required = pending mandatory steps; capacity = rhythm active days left."""
    required = sum(
        1
        for step in steps
        if step.mandatory and step.status not in {RUNWAY_STEP_COMPLETED, RUNWAY_STEP_SUBMITTED}
    )
    if not steps or not active_days:
        return GoalFeasibility(
            known=False,
            capacity_days=0,
            required_steps=0 if not steps else required,
            feasible=False,
            deficit=0,
            text=(
                "Недельный ритм не настроен: вместимость по дням не оценивается, "
                "достижение цели не обещается заранее."
            ),
        )
    capacity = rhythm_capacity_days(active_days, including=local_today, until=period_end)
    feasible = required <= capacity
    deficit = max(required - capacity, 0)
    if feasible:
        text = (
            f"План помещается в ритм: подтвердить {required} checkpoint-ов, "
            f"активных дней до конца месяца — {capacity}."
        )
    else:
        text = (
            f"План не помещается в выбранный ритм: {required} обязательных checkpoint-ов "
            f"при {capacity} активных днях, дефицит {deficit} дней. Измените план или ритм; "
            "достижение цели не обещается."
        )
    return GoalFeasibility(
        known=True,
        capacity_days=capacity,
        required_steps=required,
        feasible=feasible,
        deficit=deficit,
        text=text,
    )


def build_monthly_goal_projection(
    *,
    track_key: str,
    track_title: str,
    requested_target_key: str,
    milestones: tuple[RoadmapMilestone, ...],
    confirmed: frozenset[str],
    submitted: frozenset[str],
    published_targets: frozenset[str],
    baseline_count: int,
    plan_version: int,
    history_count: int,
    rhythm_active_days: frozenset[int],
    local_today: date,
    timezone: str,
    generated_at: datetime,
    created_by: str | None = None,
) -> MonthlyGoalProjection | None:
    """Pure projection for one monthly goal; None when target is not published."""
    period_start, period_end = month_bounds(local_today)
    runway, missing = build_runway(
        requested_target_key,
        milestones,
        confirmed=confirmed,
        submitted=submitted,
        published_targets=published_targets,
    )
    if not runway:
        return None
    target = runway[-1]
    current_count = sum(1 for step in runway if step.confirmed)
    awaiting = sum(1 for step in runway if step.awaiting)
    contours = MonthlyGoalContours(
        baseline=baseline_count,
        current=current_count,
        projected=min(current_count + awaiting, len(runway)),
        target=len(runway),
    )
    pending = next(
        (
            step
            for step in runway
            if step.status in {RUNWAY_STEP_LOCKED, RUNWAY_STEP_AVAILABLE, RUNWAY_STEP_UNKNOWN}
        ),
        None,
    )
    feasibility = build_monthly_goal_feasibility(
        runway, rhythm_active_days, local_today=local_today, period_end=period_end
    )
    return MonthlyGoalProjection(
        policy_version=MONTHLY_GOAL_POLICY_VERSION,
        generated_at=generated_at,
        track_key=track_key,
        track_title=track_title,
        goal_title=f"{target.title} до {period_end.isoformat()}",
        goal_ref=target.ref,
        period_start=period_start,
        period_end=period_end,
        days_left=(period_end - local_today).days + 1,
        timezone=timezone,
        plan_version=plan_version,
        history_count=history_count,
        steps=runway,
        contours=contours,
        next_checkpoint=pending.title if pending is not None else None,
        next_checkpoint_ref=pending.ref if pending is not None else None,
        feasibility=feasibility,
        partial_forecast=bool(missing),
        missing_mappings=missing,
        created_by=created_by,
        assumptions=(
            _CURRENT_MOVES,
            _FORECAST_IS_LIMITED,
            "Вместимость оценивается по активным дням недельного ритма; часы и оценка "
            "трудоёмкости шагов не учитываются (formula v1).",
        ),
    )


__all__ = [
    "MONTHLY_GOAL_POLICY_VERSION",
    "RUNWAY_STEP_AVAILABLE",
    "RUNWAY_STEP_COMPLETED",
    "RUNWAY_STEP_LOCKED",
    "RUNWAY_STEP_SUBMITTED",
    "RUNWAY_STEP_UNKNOWN",
    "GoalFeasibility",
    "GoalRunwayStep",
    "MonthlyGoalContours",
    "MonthlyGoalPlan",
    "MonthlyGoalProjection",
    "build_monthly_goal_feasibility",
    "build_monthly_goal_projection",
    "build_runway",
    "month_bounds",
    "rhythm_capacity_days",
    "runway_step_status",
]
