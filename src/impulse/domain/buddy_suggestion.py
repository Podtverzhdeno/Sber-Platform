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

BUDDY_SUGGESTION_VERSION = 1
"""Contract version of the suggestion payload."""

BOOTCAMP_IDLE_THRESHOLD_DAYS = 21
"""Days without a verified Bootcamp checkpoint before Buddy flags practice debt."""


class BuddySuggestionKind(StrEnum):
    BOOTCAMP_IDLE = "bootcamp_idle"
    DOMAIN_NEXT = "domain_next"


@dataclass(frozen=True, slots=True)
class BuddyAction:
    """Navigation target the participant can open manually."""

    kind: str
    ref: str
    title: str


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


def build_bootcamp_idle_suggestion(
    *,
    now: datetime,
    last_verified_at: datetime | None,
    track_title: str,
    step_kind: str,
    step_key: str,
    step_title: str,
) -> BuddySuggestion:
    idle_days = None if last_verified_at is None else (now - last_verified_at).days
    last_note = "нет проверенного checkpoint" if idle_days is None else f"{idle_days} дн."
    return BuddySuggestion(
        kind=BuddySuggestionKind.BOOTCAMP_IDLE,
        version=BUDDY_SUGGESTION_VERSION,
        suggestion_id=f"bootcamp_idle:{last_verified_at or 'none'}:{now.date().isoformat()}",
        generated_at=now,
        observation=(
            f"Практика Bootcamp давно не подтверждалась: {last_note} без проверенного checkpoint."
        ),
        gap=(
            f"Навыки траектории «{track_title}» растут, пока checkpoint не пройден: "
            "портфолио не получает нового подтверждённого результата."
        ),
        action=BuddyAction(
            kind="checkpoint",
            ref=f"checkpoint:{step_key}",
            title=f"Начать checkpoint: {step_title}",
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
    )


def build_domain_next_suggestion(
    *,
    now: datetime,
    track_title: str,
    step_kind: str,
    step_key: str,
    step_title: str,
) -> BuddySuggestion:
    return BuddySuggestion(
        kind=BuddySuggestionKind.DOMAIN_NEXT,
        version=BUDDY_SUGGESTION_VERSION,
        suggestion_id=f"domain_next:{step_key}:{now.date().isoformat()}",
        generated_at=now,
        observation=(
            f"Активная траектория «{track_title}» находится в очередном шаге целевых milestones."
        ),
        gap=f"Плановый шаг не завершён: {step_kind}:{step_key} ({step_title}).",
        action=BuddyAction(
            kind=step_kind,
            ref=f"{step_kind}:{step_key}",
            title=step_title,
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
    )


__all__ = [
    "BOOTCAMP_IDLE_THRESHOLD_DAYS",
    "BUDDY_SUGGESTION_VERSION",
    "BuddyAction",
    "BuddySuggestion",
    "BuddySuggestionKind",
    "build_bootcamp_idle_suggestion",
    "build_domain_next_suggestion",
]
