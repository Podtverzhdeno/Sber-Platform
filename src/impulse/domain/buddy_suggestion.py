"""Deterministic explainable Buddy suggestion from consented platform data (openspec 22.3).

Правила честной рекомендации:
- анализ строится только на разрешённых данных участника (certificates, growth);
- совет не записывает автоматически на курс, не меняет траекторию и не двигает уровень;
- отсутствуют raw chain-of-thought и скрытые источники: карта показывает категории
  наблюдений и объекты, прямо проверяемые в рабочем пространстве.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from urllib.parse import quote

BUDDY_SUGGESTION_VERSION = 1
"""Contract version of the suggestion payload."""

BOOTCAMP_IDLE_THRESHOLD_DAYS = 21
"""Days without a verified Bootcamp checkpoint before Buddy flags practice debt."""


class BuddySuggestionKind(StrEnum):
    BOOTCAMP_IDLE = "bootcamp_idle"
    DOMAIN_NEXT = "domain_next"


class BuddyTargetKind(StrEnum):
    COURSE = "course"
    CHECKPOINT = "checkpoint"
    TASK = "task"
    PROJECT = "project"
    EVIDENCE = "evidence"
    EVENT = "event"
    DIALOG = "dialog"


@dataclass(frozen=True, slots=True)
class BuddyTargetRef:
    """Typed canonical object reference; never a free-form URL."""

    kind: BuddyTargetKind
    object_id: str
    checkpoint_id: str | None = None
    version: int | None = None


@dataclass(frozen=True, slots=True)
class BuddyAction:
    """Navigation target the participant can open manually."""

    kind: str
    ref: str
    title: str
    target: BuddyTargetRef
    canonical_path: str
    estimated_minutes: int | None
    deadline_at: datetime | None
    points: int | None
    points_note: str
    skill_forecast: str
    effect_state: str
    available: bool = True
    stale_reason: str | None = None


@dataclass(frozen=True, slots=True)
class BuddySuggestion:
    kind: BuddySuggestionKind
    version: int
    suggestion_id: str
    generated_at: datetime
    observation: str
    gap: str
    action: BuddyAction | None
    benefit: str
    source_categories: tuple[str, ...]
    explanation: str
    idle_days: int | None
    model_called: bool
    auto_enrolled: bool
    rank_score: str
    partial: bool
    coverage_note: str


def _target_kind(value: str) -> BuddyTargetKind:
    try:
        return BuddyTargetKind(value)
    except ValueError:
        # Roadmap currently publishes course/task targets. Unknown future kinds
        # stay non-consequential and route through a checkpoint detail.
        return BuddyTargetKind.CHECKPOINT


def canonical_target_path(target: BuddyTargetRef) -> str:
    """Return an internal route from a typed ref, never from model output."""

    object_id = quote(target.object_id, safe="")
    checkpoint_id = quote(target.checkpoint_id, safe="") if target.checkpoint_id else None
    if target.kind is BuddyTargetKind.COURSE:
        suffix = f"&checkpoint={checkpoint_id}" if checkpoint_id else ""
        return f"/workspace/2?course={object_id}{suffix}"
    if target.kind is BuddyTargetKind.CHECKPOINT:
        return f"/workspace/1?checkpoint={object_id}"
    if target.kind is BuddyTargetKind.TASK:
        return f"/workspace/3?task={object_id}"
    if target.kind in {BuddyTargetKind.PROJECT, BuddyTargetKind.EVIDENCE}:
        return f"/workspace/4?project={object_id}"
    if target.kind is BuddyTargetKind.EVENT:
        return f"/workspace/5?event={object_id}"
    return f"/workspace/6?dialog={object_id}"


def build_action(
    *,
    target_kind: str,
    target_key: str,
    checkpoint_id: str,
    title: str,
    effort_hours: int | None = None,
    deadline_at: datetime | None = None,
    rank_score: str = "0",
    available: bool = True,
    stale_reason: str | None = None,
    legacy_kind: str | None = None,
) -> BuddyAction:
    target = BuddyTargetRef(
        kind=_target_kind(target_kind),
        object_id=target_key,
        checkpoint_id=checkpoint_id,
    )
    return BuddyAction(
        kind=legacy_kind or target.kind.value,
        ref=f"{legacy_kind or target.kind.value}:{target.object_id}",
        title=title,
        target=target,
        canonical_path=canonical_target_path(target),
        estimated_minutes=effort_hours * 60 if effort_hours is not None else None,
        deadline_at=deadline_at,
        points=None,
        points_note="Баллы не обещаются: правило начисления появится после проверки evidence.",
        skill_forecast=(
            "Прогноз частичный: точный прирост навыка требует опубликованного competency mapping."
        ),
        effect_state="projected",
        available=available,
        stale_reason=stale_reason,
    )


def build_bootcamp_idle_suggestion(
    *,
    now: datetime,
    last_verified_at: datetime | None,
    track_title: str,
    step_kind: str,
    step_key: str,
    step_title: str,
    checkpoint_id: str | None = None,
    effort_hours: int | None = None,
    deadline_at: datetime | None = None,
    rank_score: str = "0",
) -> BuddySuggestion:
    idle_days = None if last_verified_at is None else (now - last_verified_at).days
    last_note = "нет проверенного checkpoint" if idle_days is None else f"{idle_days} дн."
    return BuddySuggestion(
        kind=BuddySuggestionKind.BOOTCAMP_IDLE,
        version=BUDDY_SUGGESTION_VERSION,
        suggestion_id=(
            f"bootcamp_idle:{step_kind}:{step_key}:{checkpoint_id or step_key}:"
            f"{last_verified_at or 'none'}:{now.date().isoformat()}"
        ),
        generated_at=now,
        observation=(
            f"Практика Bootcamp давно не подтверждалась: {last_note} без проверенного checkpoint."
        ),
        gap=(
            f"Навыки траектории «{track_title}» растут, пока checkpoint не пройден: "
            "портфолио не получает нового подтверждённого результата."
        ),
        action=build_action(
            target_kind=step_kind,
            target_key=step_key,
            checkpoint_id=checkpoint_id or step_key,
            title=f"Начать checkpoint: {step_title}",
            effort_hours=effort_hours,
            deadline_at=deadline_at,
            rank_score=rank_score,
            legacy_kind="checkpoint",
        ),
        benefit=(
            "Проверочный checkpoint даёт подтверждённый результат и закрывает "
            "недостающий источник в Skill Passport."
        ),
        source_categories=("checkpoint", "course", "skill_evidence"),
        explanation=(
            "Автоматический анализ разрешённых данных: дата последнего verified "
            "course-checkpoint из Bootcamp-сертификатов и целевой шаг активной "
            "траектории. Модель не вызывается; сегменты без лишних деталей."
        ),
        idle_days=idle_days,
        model_called=False,
        auto_enrolled=False,
        rank_score=rank_score,
        partial=True,
        coverage_note=(
            "Учтены roadmap и verified Bootcamp evidence; баллы и skill mapping "
            "пока не опубликованы."
        ),
    )


def build_domain_next_suggestion(
    *,
    now: datetime,
    track_title: str,
    step_kind: str,
    step_key: str,
    step_title: str,
    checkpoint_id: str | None = None,
    effort_hours: int | None = None,
    deadline_at: datetime | None = None,
    rank_score: str = "0",
) -> BuddySuggestion:
    return BuddySuggestion(
        kind=BuddySuggestionKind.DOMAIN_NEXT,
        version=BUDDY_SUGGESTION_VERSION,
        suggestion_id=(
            f"domain_next:{step_kind}:{step_key}:{checkpoint_id or step_key}:"
            f"{now.date().isoformat()}"
        ),
        generated_at=now,
        observation=(
            f"Активная траектория «{track_title}» находится в очередном шаге целевых milestones."
        ),
        gap=f"Плановый шаг не завершён: {step_kind}:{step_key} ({step_title}).",
        action=build_action(
            target_kind=step_kind,
            target_key=step_key,
            checkpoint_id=checkpoint_id or step_key,
            title=step_title,
            effort_hours=effort_hours,
            deadline_at=deadline_at,
            rank_score=rank_score,
        ),
        benefit="Продвижение по плану без записи на курс и изменения Skills-Passport уровня.",
        source_categories=("milestone", "roadmap", "priority_policy"),
        explanation=(
            "Автоматический анализ разрешённых данных: приоритетная политика "
            "v1 на приоритетах активной траектории. Доменный следующий шаг "
            "определён без участия модели."
        ),
        idle_days=None,
        model_called=False,
        auto_enrolled=False,
        rank_score=rank_score,
        partial=True,
        coverage_note=(
            "Приоритет рассчитан по доступности, prerequisites, сроку и нагрузке; "
            "skill mapping частичный."
        ),
    )


__all__ = [
    "BOOTCAMP_IDLE_THRESHOLD_DAYS",
    "BUDDY_SUGGESTION_VERSION",
    "BuddyAction",
    "BuddySuggestion",
    "BuddySuggestionKind",
    "BuddyTargetKind",
    "BuddyTargetRef",
    "build_action",
    "build_bootcamp_idle_suggestion",
    "build_domain_next_suggestion",
    "canonical_target_path",
]
