"""Deterministic next-step priority policy (openspec 22.12).

Политика — чистая scoring-функция: каждая недостающая milestone получает
детерминированный score (trajectory gap, prerequisites, availability,
deadline urgency, workload). Равные score разрываются по возрастанию
(trajectory_key, position, target_key). Stale-состояния (закрытый проект,
заполненные места, другая версия плана) не отбрасываются, а возвращаются
с available=False и причиной — клиент может предложить переоткрытие
(следующий по приоритету доступный шаг выбирается флагом available).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

PRIORITY_POLICY_VERSION = 1

GAP_FULL = Decimal("40")
GAP_HALF = Decimal("20")
PREREQ_MET = Decimal("25")
PREREQ_PARTIAL = Decimal("10")
AVAILABILITY_OPEN = Decimal("20")
AVAILABILITY_LOCKED = Decimal(0)
DEADLINE_URGENT = Decimal("15")
DEADLINE_SAME_DAY = Decimal("10")
DEADLINE_FAR_OFF = Decimal(0)
STALE_ROADMAP_REASON = "roadmap_version_changed"
STALE_PROJECT_REASON = "project_closed"
STALE_PLACES_REASON = "places_filled"
TASK_HOLD_REASON = "task_on_hold"
NO_PREREQ = "no_prerequisites"


@dataclass(frozen=True, slots=True)
class StepSpec:
    """Ввод политики: недостающий milestone активной траектории."""

    trajectory_key: str
    trajectory_position: int  # 0 — самая активная
    position: int
    milestone_key: str
    target_kind: str
    target_key: str
    target_title: str


@dataclass(frozen=True, slots=True)
class TargetState:
    """Фактическое состояние цели после stale-recheck."""

    published: bool
    closed: bool = False
    places_filled: bool = False
    held: bool = False
    prerequisites_met: bool = True
    prerequisites_known: bool = False
    deadline_at: datetime | None = None
    effort_hours: int | None = None


@dataclass(frozen=True, slots=True)
class ScoredStep:
    spec: StepSpec
    state: TargetState
    score: Decimal
    factors: tuple[str, ...]
    reasons: tuple[str, ...]
    available: bool
    stale_reason: str | None


@dataclass(frozen=True, slots=True)
class PolicyResult:
    policy_version: int
    steps: tuple[ScoredStep, ...]

    def next_available(self) -> ScoredStep | None:
        return next((item for item in self.steps if item.available), None)


def priority_policy_version() -> int:
    return PRIORITY_POLICY_VERSION


def select_steps(
    specs: tuple[StepSpec, ...],
    states: dict[tuple[str, str], TargetState],
) -> PolicyResult:
    """Sort deterministic (score desc, trajectory_position, position, key)."""
    steps = tuple(
        _score(spec, states.get((spec.target_kind, spec.target_key), TargetState(published=True)))
        for spec in specs
    )
    ordered = tuple(
        sorted(
            steps,
            key=lambda item: (
                -item.score,
                item.spec.trajectory_position,
                item.spec.position,
                item.spec.target_key,
            ),
        )
    )
    return PolicyResult(PRIORITY_POLICY_VERSION, ordered)


def _score(spec: StepSpec, state: TargetState) -> ScoredStep:
    reasons: list[str] = []
    factors: list[str] = []
    score = Decimal(0)

    score += GAP_FULL
    factors.append("trajectory_gap")
    reasons.append("Первый недостающий обязательный шаг активной траектории")

    if state.prerequisites_known and not state.prerequisites_met:
        score += PREREQ_PARTIAL
        factors.append("prerequisites_partial")
        reasons.append("Часть prerequisites ещё не закрыта")
    else:
        score += PREREQ_MET
        factors.append("prerequisites_met")

    stale_reason: str | None = None
    if not state.published:
        stale_reason = STALE_ROADMAP_REASON
    elif state.closed:
        stale_reason = STALE_PROJECT_REASON
    elif state.places_filled:
        stale_reason = STALE_PLACES_REASON
    elif state.held:
        stale_reason = TASK_HOLD_REASON

    if stale_reason is not None:
        score += AVAILABILITY_LOCKED
        factors.append("availability_locked")
        reasons.append("Объект недоступен с момента снапшота; требуется переархивирование")
    else:
        score += AVAILABILITY_OPEN
        factors.append("availability_open")

    if state.deadline_at is not None:
        deadline = state.deadline_at
        now = datetime.now(deadline.tzinfo) if deadline.tzinfo is not None else datetime.now()
        delta = deadline - now
        total_hours = abs(delta.total_seconds()) / 3600
        if delta.total_seconds() <= 0:
            score += DEADLINE_URGENT
            factors.append("deadline_overdue")
            reasons.append("Срок проекта истёк; вклад принимается вне очереди")
        elif total_hours <= 24:
            score += DEADLINE_SAME_DAY
            factors.append("deadline_due_today")
            reasons.append("Срок наступает в течение дня")
        elif total_hours <= 72 * 24:
            score += DEADLINE_URGENT
            factors.append("deadline_within_3_days")
            reasons.append("Срок наступает в течение 3 дней")
        else:
            score += DEADLINE_FAR_OFF
            factors.append("deadline_far")
    else:
        score += DEADLINE_FAR_OFF
        factors.append("no_deadline")

    if state.effort_hours is not None:
        effort_penalty = min(Decimal(state.effort_hours), Decimal("40")) / Decimal("4")
        score -= effort_penalty
        factors.append("workload_penalty")
        if effort_penalty > 0:
            reasons.append(f"Оценочный объём {state.effort_hours} ч снижает приоритет")

    percent_score = (
        (score * Decimal(100)).quantize(Decimal("0.1"), ROUND_HALF_UP) / Decimal(100)
    )
    return ScoredStep(
        spec=spec,
        state=state,
        score=percent_score,
        factors=tuple(factors),
        reasons=tuple(reasons),
        available=stale_reason is None,
        stale_reason=stale_reason,
    )
