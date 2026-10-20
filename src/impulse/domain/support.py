"""Published, explainable support models for customer task briefs."""

from __future__ import annotations

from dataclasses import dataclass

SUPPORT_CATALOG_VERSION = 1


@dataclass(frozen=True, slots=True)
class SupportModel:
    code: str
    name: str
    responsible: str
    activities: tuple[str, ...]
    response_time: str
    restrictions: tuple[str, ...]
    available: bool = True
    unavailable_reason: str | None = None
    requires_assignee: bool = False


def published_support_models() -> tuple[SupportModel, ...]:
    """Return the deterministic public policy catalog in display order."""
    return (
        SupportModel(
            code="platform",
            name="Сопровождение платформы",
            responsible="Операционная команда платформы",
            activities=("Маршрутизация вопросов", "Контроль статусов", "Эскалация блокеров"),
            response_time="Ответ в течение 1 рабочего дня",
            restrictions=(
                "Не заменяет предметного ментора",
                "Не принимает результат за заказчика",
            ),
        ),
        SupportModel(
            code="assigned_mentor",
            name="Назначенный ментор",
            responsible="Выбранный ментор или ментор, назначенный платформой",
            activities=("Checkpoint-сессии", "Ревью evidence", "Методическая обратная связь"),
            response_time="Ответ в течение 2 рабочих дней",
            restrictions=("Требуется допустимый ментор или запрос на назначение",),
            requires_assignee=True,
        ),
        SupportModel(
            code="expert_consultations",
            name="Экспертные консультации",
            responsible="Эксперт предметной области",
            activities=("Консультации по домену", "Проверка ключевых допущений"),
            response_time="По согласованному расписанию",
            restrictions=("Не включает регулярное ведение проекта",),
            available=False,
            unavailable_reason="Для этой программы сейчас нет свободного экспертного пула.",
        ),
        SupportModel(
            code="customer_self",
            name="Самостоятельное ведение заказчиком",
            responsible="Заказчик задачи",
            activities=("Ответы на вопросы", "Ревью checkpoints", "Решение по результату"),
            response_time="Срок ответа задаёт заказчик в условиях задачи",
            restrictions=(
                "Заказчик самостоятельно обеспечивает доступность и предметную поддержку",
            ),
        ),
    )


__all__ = ["SUPPORT_CATALOG_VERSION", "SupportModel", "published_support_models"]
