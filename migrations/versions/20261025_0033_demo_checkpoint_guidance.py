"""Enrich existing synthetic demo checkpoints without overwriting user edits.

Revision ID: 20261025_0033
Revises: 20261025_0032
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261025_0033"
down_revision: str | Sequence[str] | None = "20261025_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DEMO_GUIDANCE: dict[str, dict[str, object]] = {
    "assigned-quality-1": {
        "description": (
            "Проверь демонстрационные научные статьи на пропуски и дубликаты; "
            "зафиксируй очистку и воспроизводимое разбиение train/test без утечки данных."
        ),
        "deliverable": "Отчёт о качестве датасета и скрипт его подготовки.",
        "acceptance_criteria": [
            "Есть сводка пропусков, дубликатов и объёма выборки",
            "Разбиение и очистка воспроизводимы",
        ],
        "estimated_minutes": 180,
    },
    "assigned-quality-2": {
        "description": (
            "Создай минимальный рекомендательный алгоритм, например по сходству "
            "TF-IDF аннотаций, опиши baseline и ограничения."
        ),
        "deliverable": "Запускаемый прототип, README и примеры рекомендаций.",
        "acceptance_criteria": [
            "Работа запускается из чистого окружения",
            "Есть ранжированные рекомендации для нескольких статей",
        ],
        "estimated_minutes": 300,
    },
    "assigned-quality-3": {
        "description": (
            "Оцени прототип на отложенной выборке. При наличии релевантной разметки "
            "рассчитай Recall@K и NDCG@K; без неё оцени покрытие и разнообразие. "
            "Сравни с простым baseline и укажи ограничения."
        ),
        "deliverable": "Таблица метрик, воспроизводимый скрипт и описание методики.",
        "acceptance_criteria": [
            "Метрики рассчитаны на описанной выборке",
            "Результат сравнивается с baseline или обоснована недоступность разметки",
            "Эксперимент можно повторить по инструкции",
            "Приведены ограничения и ошибки",
        ],
        "estimated_minutes": 240,
    },
    "assigned-quality-4": {
        "description": (
            "Проведи независимый запуск решения в чистой среде или передай его "
            "проверяющему, зафиксируй ошибки и расхождения."
        ),
        "deliverable": "Протокол независимого запуска, замечания и исправления.",
        "acceptance_criteria": [
            "Независимый запуск повторяет опубликованную инструкцию",
            "Замечания и расхождения задокументированы",
        ],
        "estimated_minutes": 150,
    },
    "assigned-quality-5": {
        "description": (
            "Собери финальную версию, README, метрики и краткую презентацию. "
            "Отдельно опиши личный вклад и ограничения."
        ),
        "deliverable": "Репозиторий, воспроизводимый отчёт и презентация.",
        "acceptance_criteria": [
            "Материалы доступны заказчику",
            "По README можно повторить эксперимент",
            "Личный вклад подтверждён артефактами",
        ],
        "estimated_minutes": 180,
    },
}


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT t.id, t.payload FROM tasks t "
            "JOIN projects p ON p.id = t.project_id "
            "WHERE p.project_key = :project_key AND t.task_key = :task_key"
        ),
        {"project_key": "demo-rd-lab", "task_key": "demo-task-1"},
    ).mappings()
    for row in rows:
        payload = dict(row["payload"] or {})
        checkpoints = [dict(item) for item in payload.get("checkpoints", [])]
        modified = False
        for stage in checkpoints:
            guidance = _DEMO_GUIDANCE.get(str(stage.get("key", "")))
            if not guidance:
                continue
            for field, value in guidance.items():
                if not stage.get(field):
                    stage[field] = value
                    modified = True
        if modified:
            payload["checkpoints"] = checkpoints
            connection.execute(
                sa.text(
                    "UPDATE tasks SET payload = CAST(:payload AS jsonb), "
                    "version = version + 1 WHERE id = :id"
                ),
                {"payload": json.dumps(payload, ensure_ascii=False), "id": row["id"]},
            )


def downgrade() -> None:
    # Preserve customer edits and any already published enriched descriptions.
    pass
