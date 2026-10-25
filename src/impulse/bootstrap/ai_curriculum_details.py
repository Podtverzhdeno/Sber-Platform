"""Practical teaching material for the seven synthetic AI career paths.

Planned learning objectives and evaluation rubrics, not evidence of completion.
The index is stable by role and stage position to preserve the existing roadmap
identifiers, participants' selections and verified progress.
"""

from __future__ import annotations

import json

from impulse.bootstrap.ai_reading_resources import reading_for_stage
from impulse.bootstrap.ai_stage_guides import stage_guide

# ruff: noqa: E501 -- curated human-readable Russian lesson descriptions.
AI_CURRICULUM_DETAILS: dict[str, list[dict[str, object]]] = json.loads(r"""{
  "product": [
    {
      "theory": [
        "LLM inference, контекстное окно и ограничения генерации",
        "Компоненты RAG, agent orchestration и API-gateway"
      ],
      "lab": "Опиши корпоративный AI-помощник для анализа заявок: контекст C4, внешние зависимости и потоки персональных данных.",
      "acceptance": [
        "На C4 есть пользователь, AI-сервис, источники знаний и журнал аудита",
        "Указаны 5 NFR с измеримыми показателями",
        "Разграничены функции модели и бизнес-сервисов"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "Функциональные сценарии, SLA и SLO",
        "ADR: контекст, альтернативы, решение, последствия"
      ],
      "lab": "Составь SDD для обработки корпоративного запроса. Сравни sync REST и асинхронную очередь с учётом времени ответа и повторов.",
      "acceptance": [
        "Зафиксированы входные данные и ошибки",
        "ADR сравнивает минимум 2 решения по 3 критериям",
        "Есть условия пересмотра архитектурного решения"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "Chunking, hybrid search и reranking",
        "ACL до retrieval, индексация и актуализация документов"
      ],
      "lab": "Спроектируй RAG для документов трёх компаний с разными правами: хранение, индексация, обновление, отзывы доступа.",
      "acceptance": [
        "Схема исключает межклиентские утечки",
        "Подготовлены 20 вопросов с эталонными фрагментами",
        "Определены Recall@k, citation precision и план удаления"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Tool contracts, A2A discovery и конечные автоматы",
        "Идемпотентность, distributed tracing и компенсации"
      ],
      "lab": "Нарисуй последовательность двух агентов: запрос лимита, подтверждение пользователя, выполнение действия с retry.",
      "acceptance": [
        "Контракты содержат auth, timeout и schema ошибок",
        "Повторный вызов не дублирует операцию",
        "Указаны границы доверия и аудит действий"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Threat modeling STRIDE для LLM и инструментов",
        "Timeout budget, circuit breaker и degradation"
      ],
      "lab": "Разбери три сбоя: prompt injection из документа, недоступный внешний API, утечка tenant-контекста.",
      "acceptance": [
        "Предложены минимум 2 контроля на каждую угрозу",
        "Есть сценарий безопасного отказа",
        "Определены RTO/RPO, действия дежурного и метрики"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "LLM-as-judge, deterministic eval и quality gates",
        "Tracing стоимости, токенов, tool correctness и p95"
      ],
      "lab": "Собери 30-кейсовый набор, отчёт baseline/candidate и контроль качества при смене модели.",
      "acceptance": [
        "Метрики качества, затрат и скорости разделены",
        "Для risk/safety задан blocking gate",
        "Результат воспроизводится по версии набора и конфигурации"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Architecture review: ADR, C4, threat model и TCO",
        "Trade-off качества, latency, безопасности и цены"
      ],
      "lab": "Защити AI-сервис перед архитектурным комитетом: пакет схем, рисков, плана запуска и отказа.",
      "acceptance": [
        "Есть связная цепочка бизнес-цель → NFR → решение",
        "Присутствуют rollback и наблюдаемость",
        "Решение сопровождается рисками, стоимостью и измеримыми KPI"
      ],
      "estimated_hours": 12
    }
  ],
  "ml": [
    {
      "theory": [
        "Типы данных, Python typing, pytest",
        "Асинхронный клиент, конфигурация и управление секретами"
      ],
      "lab": "Собери Python-пакет с клиентом модельного API и структурированным логированием, без токенов в репозитории.",
      "acceptance": [
        "Клиент тестируется без внешнего API через mock",
        "Есть типизация и обработка ошибок",
        "Секреты берутся из переменных окружения"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "System/developer/user сообщения и prompt templates",
        "JSON schema и повторные попытки при неверном формате"
      ],
      "lab": "Реализуй генерацию структурированного решения по заявке с валидацией и 12 негативными примерами.",
      "acceptance": [
        "Результат соответствует JSON schema",
        "Некорректный ответ не превращается в успех",
        "Сохранены версия промпта и базовые метрики"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "BM25, embeddings, reranking",
        "Recall@k и контроль заземлённости ответов"
      ],
      "lab": "Построй retrieval по 100 документам с 25 вопросами и источниками в каждой финальной выдаче.",
      "acceptance": [
        "Имеется воспроизводимый pipeline индексации",
        "Измерен Recall@5 с эталонным набором",
        "Ответ без источника явно помечается как непроверенный"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Function calling и stateful graph",
        "Timeout, retries и human-in-the-loop"
      ],
      "lab": "Собери агента с двумя безопасными инструментами: поиск договора и создание черновика ответа.",
      "acceptance": [
        "Есть минимум 12 тестов маршрута",
        "Запрещённые действия блокируются перед вызовом",
        "Состояние корректно восстанавливается после таймаута"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Детерминированные проверки и выборка eval",
        "Инструментальная корректность, robustness и регрессии"
      ],
      "lab": "Сравни baseline и candidate по 30 запросам: ответ, вызовы tools, отказоустойчивость, стоимость.",
      "acceptance": [
        "Показаны результаты по каждому кейсу",
        "Небезопасный вызов блокирует release",
        "Есть ссылки на трассы ошибок"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "FastAPI, Docker, healthchecks",
        "Telemetry и rate limiting"
      ],
      "lab": "Запусти inference endpoint с ограничением concurrency и метриками latency и token cost.",
      "acceptance": [
        "Контейнер проходит healthcheck",
        "Нагрузочный тест отражает p95",
        "Ошибки API не раскрывают конфиденциальные данные"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Acceptance criteria и versioned datasets",
        "Код-ревью, документация, демо"
      ],
      "lab": "Подготовь действующий AI-сервис на выбранном кейсе и комплект материалов для независимой проверки.",
      "acceptance": [
        "Есть README для запуска с нуля",
        "Тесты и eval выполняются одной командой",
        "Описаны ограничения модели и план улучшений"
      ],
      "estimated_hours": 12
    }
  ],
  "python": [
    {
      "theory": [
        "OWASP LLM risks и prompt injection",
        "Trusted/untrusted boundaries и attack surfaces"
      ],
      "lab": "Составь threat model AI-помощника, который читает файлы и вызывает три API.",
      "acceptance": [
        "Есть карта потоков данных и доверия",
        "Выделены не менее 8 угроз с приоритетами",
        "Риски связаны с конкретными контролями"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "OAuth scopes, short-lived tokens, secrets vault",
        "Authorization на границе каждого инструмента"
      ],
      "lab": "Разработай матрицу разрешений агентов: чтение справки, создание черновика, подтверждение операции.",
      "acceptance": [
        "Запрещённое действие блокируется сервером",
        "Токены не передаются в prompt",
        "Роли и действия проверены негативными тестами"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "Attack patterns: indirect injection, role spoofing",
        "Sanitization limits и prompt-injection evaluation"
      ],
      "lab": "Создай 20 безвредных тестовых injection-попыток в документах и ответах tools; измерь защиту.",
      "acceptance": [
        "Атакующие тексты изолированы от инструкций",
        "Результаты по 20 сценариям воспроизводимы",
        "Защитные меры не уничтожают обычные ответы"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Document ACL, redaction и retention",
        "Tenant isolation и защита retrieval"
      ],
      "lab": "Протестируй поиск корпоративного агента для трёх tenant-контекстов и документов с PII.",
      "acceptance": [
        "Отсутствуют чужие результаты в 15 cross-tenant проверках",
        "PII маскируется в логах и не попадает в трассировку агента",
        "Есть тест удаления документа из индекса"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Sandboxing, approval gates и allowlists",
        "Tool result tampering и quotas"
      ],
      "lab": "Реализуй policy gate для агента, предлагающего платежное действие, но не исполняющего его без подтверждения.",
      "acceptance": [
        "Каждое опасное действие проходит approval",
        "Лог содержит причину отказа, без секретов",
        "Повторные вызовы ограничены бюджетом"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Adversarial testing и измерение ASR",
        "False positives, canary и supply-chain risk"
      ],
      "lab": "Составь таблицу из 40 тестов: injection, утечки, несанкционированные вызовы и отказ.",
      "acceptance": [
        "Есть baseline и результат исправлений",
        "Показаны FP/FN и ограничения оценки",
        "Критические кейсы настроены как release blockers"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Security telemetry и расследование",
        "Isolation, credential rotation и incident response"
      ],
      "lab": "Проведи tabletop-инцидент: агент запросил запрещённый tool; опиши остановку, аудит и восстановление.",
      "acceptance": [
        "Runbook задаёт владельцев и сроки действий",
        "В логах есть корреляция запросов",
        "Есть postmortem и критерии безопасного возобновления"
      ],
      "estimated_hours": 10
    }
  ],
  "data": [
    {
      "theory": [
        "Batch/stream ingestion и schema evolution",
        "Data contracts, validation и lineage"
      ],
      "lab": "Собери пайплайн из CSV и API с нормализацией времён и проверкой схем.",
      "acceptance": [
        "Входы и выходы версионированы",
        "Некорректные строки попадают в quarantine",
        "Повторный запуск даёт те же результаты"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "SQL joins, window functions, indexes",
        "Нормализация и аналитические модели"
      ],
      "lab": "Спроектируй SQL-схему событий AI-агентов и отчёт по latency, ошибкам и стоимости.",
      "acceptance": [
        "Нет дублирования ключевых сущностей",
        "Запросы протестированы на синтетическом датасете",
        "Выбранные индексы подтверждены EXPLAIN"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "Incremental ETL, checkpoints и backfill",
        "Idempotency, retries и DLQ"
      ],
      "lab": "Построй ежедневный ingestion событий с backfill за семь дней и имитацией повторной доставки.",
      "acceptance": [
        "Нет дублей после второго запуска",
        "Сбой одного батча не блокирует остальные",
        "Сохранены контрольные точки и журнал ошибок"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Chunk metadata, embeddings и versioned index",
        "Document lifecycle и safe delete"
      ],
      "lab": "Реализуй конвейер индексирования корпоративных PDF с указанием версии документа и прав доступа.",
      "acceptance": [
        "Каждый chunk связан с исходным документом",
        "Обновление не оставляет устаревших фрагментов",
        "Удалённый документ исчезает из retrieval"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Freshness, completeness и anomaly detection",
        "Data lineage, тесты и alerting"
      ],
      "lab": "Настрой проверки пустых полей, дублей, задержек и резких скачков числа документов.",
      "acceptance": [
        "Определены пороги для каждой метрики",
        "Тесты ловят минимум три искусственные ошибки",
        "Есть описание процедуры исправления"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "PII minimization, access policies",
        "Retention, audit and encryption"
      ],
      "lab": "Создай политику хранения корпуса знаний с раздельным доступом и журналом удаления.",
      "acceptance": [
        "Есть матрица доступа по ролям",
        "Удаление распространяется на кэш и индекс",
        "Показан audit trail без PII"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Throughput, backpressure и recovery",
        "SLO для data freshness"
      ],
      "lab": "Проведи испытание пайплайна на искусственных 50k событиях и смоделируй недоступность API.",
      "acceptance": [
        "Зафиксирован throughput и p95 lag",
        "Восстановление не создаёт дубликаты",
        "Есть операционный runbook и диаграмма архитектуры"
      ],
      "estimated_hours": 12
    }
  ],
  "backend": [
    {
      "theory": [
        "Training-serving skew и reproducibility",
        "Model artifacts и lifecycle stages"
      ],
      "lab": "Нарисуй lifecycle модели от исходных данных до rollback в production.",
      "acceptance": [
        "Модель однозначно привязана к версии данных",
        "Отмечены точки ручного approval",
        "Есть артефакты для каждого этапа"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "Model serving и OCI images",
        "Health probes и resource limits"
      ],
      "lab": "Упакуй модельный inference в контейнер с readiness/liveness endpoint.",
      "acceptance": [
        "Один образ воспроизводимо собирается",
        "Healthcheck не делает затратного model call",
        "Показаны CPU/RAM и поведение при перегрузке"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "CI/CD, model gates и artifact signing",
        "Safe promotion и rollback"
      ],
      "lab": "Настрой pipeline, который не выпустит модель с ухудшением quality baseline или safety.",
      "acceptance": [
        "Тесты включают eval и policy gate",
        "Версия модели фиксируется в release manifest",
        "Rollback отработан на стенде"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Model registry и lineage",
        "Experiment metadata and versioned datasets"
      ],
      "lab": "Подготовь registry с тремя экспериментами и воспроизводимым выбором winner.",
      "acceptance": [
        "У эксперимента есть hash датасета",
        "Сохранены гиперпараметры и метрики",
        "Откат возвращает конкретную прежнюю модель"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Data/model drift и concept drift",
        "Monitoring latency, tokens и errors"
      ],
      "lab": "Построй observability дашборд по inference с искусственной деградацией входных данных.",
      "acceptance": [
        "Есть пороги alerting и owner",
        "Показано отличие data drift от падения качества",
        "Метрики позволяют найти конкретный релиз"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Autoscaling, retries, queues",
        "Circuit breakers и multi-zone availability"
      ],
      "lab": "Проведи эксперимент с пиковой нагрузкой и отказом внешней модельной API.",
      "acceptance": [
        "Ограничение concurrency предотвращает лавинообразные повторы",
        "p95 и error rate измерены",
        "Фолбэк не приводит к небезопасному ответу"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Canary release, SLO burn rate",
        "Operational readiness и post-deploy checks"
      ],
      "lab": "Подготовь canary 10% → 50% → 100% с условиями остановки и rollback.",
      "acceptance": [
        "Заданы конкретные exit-criteria",
        "Подготовлены dashboard с порогами и операционный runbook",
        "Подготовлен релизный протокол с ограничениями"
      ],
      "estimated_hours": 12
    }
  ],
  "design": [
    {
      "theory": [
        "Agent loop, tool use и autonomy tiers",
        "Planning and observation-action separation"
      ],
      "lab": "Опиши сценарий агента для подготовки коммерческого предложения без права отправки.",
      "acceptance": [
        "Разделены чтение данных и внешние действия",
        "Есть границы автономности",
        "Схема покрывает ошибки и ручное подтверждение"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "Typed tool schemas и input validation",
        "Tool authentication и error taxonomies"
      ],
      "lab": "Создай два инструмента: поиск контракта и подготовка черновика ответа.",
      "acceptance": [
        "JSON schema отклоняет невалидный ввод",
        "Ошибки различаются по типам",
        "Каждый вызов имеет audit ID"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "State graphs, checkpointing и retries",
        "Deterministic edges и state persistence"
      ],
      "lab": "Собери граф агента с тремя узлами и восстановлением после ошибки второго узла.",
      "acceptance": [
        "После resume шаг не повторяет внешнее действие",
        "Есть тесты переходов и retries",
        "Состояние сериализуется без секретов"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Memory TTL, summarization и retrieval",
        "PII in conversational state"
      ],
      "lab": "Добавь session memory с TTL и отдельную базу знаний для агента; проверь изоляцию двух пользователей и удаление истории.",
      "acceptance": [
        "Не смешиваются пользовательские сессии",
        "Есть кнопка очистки памяти и тест удаления",
        "Размер контекста ограничен бюджетом"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "A2A identity, capability discovery",
        "Delegation, auth and contract negotiation"
      ],
      "lab": "Построй двух агентов: закупщик формирует запрос, поставщик возвращает коммерческое предложение.",
      "acceptance": [
        "Роли и permissions описаны в контракте",
        "Запросы подписаны либо явно аутентифицированы",
        "Платёж или заказ не инициируется без approval"
      ],
      "estimated_hours": 12
    },
    {
      "theory": [
        "Trajectory evaluation и tool correctness",
        "Safety gating и latency budgets"
      ],
      "lab": "Проверь агента на 30 сценариях: успех, неправильный tool, несуществующая функция, отказ.",
      "acceptance": [
        "Показаны success rate и tool accuracy",
        "Есть blocking cases для действий без разрешения",
        "Сохраняются трассы и стоимость по шагам"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "End-to-end workflow и operations",
        "Documentation and reproducible demonstrations"
      ],
      "lab": "Продемонстрируй агентный процесс от запроса до проверенного черновика с логами и eval.",
      "acceptance": [
        "Независимый проверяющий запускает проект по инструкции",
        "Есть 20 тестов и 10 eval-кейсов",
        "Описаны риски, ограничения и правила ручного подтверждения"
      ],
      "estimated_hours": 12
    }
  ],
  "manager": [
    {
      "theory": [
        "JTBD, пользовательские интервью",
        "Outcome-based metrics и продуктовые ограничения"
      ],
      "lab": "Опиши бизнес-кейс AI-помощника для службы поддержки и альтернативу без LLM.",
      "acceptance": [
        "Есть 3 пользовательских сегмента",
        "Метрика ценности измерима",
        "Описаны недопустимые ошибки и ограничения"
      ],
      "estimated_hours": 6
    },
    {
      "theory": [
        "Inference costs, token economics",
        "Build-vs-buy and ROI sensitivity"
      ],
      "lab": "Сравни ручную обработку, правила и LLM при 1k, 10k и 100k запросов.",
      "acceptance": [
        "Есть формула стоимости одного успешного кейса",
        "Показаны допущения и sensitivity",
        "Решение обосновано пороговыми условиями"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "Data readiness, privacy and permissions",
        "Ground truth, evaluation sets и feasibility gates"
      ],
      "lab": "Проверь, доступны ли документы и источники для автоматизации триажа заявок.",
      "acceptance": [
        "Есть data inventory и карта доступов",
        "Набор валидации включает ошибки и исключения",
        "Указан измеримый baseline без применения AI"
      ],
      "estimated_hours": 8
    },
    {
      "theory": [
        "MVP slicing и acceptance stories",
        "Observability, safety gates и NFR"
      ],
      "lab": "Напиши SDD на узкий MVP: поиск и черновик ответа без автономной отправки.",
      "acceptance": [
        "К каждому сценарию есть acceptance criteria",
        "MVP имеет safety gate и owner",
        "Backlog разделён на must-have и deferred"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Prototype evaluation and experiment design",
        "User feedback и impact measurement"
      ],
      "lab": "Запусти прототип на синтетических заявках, сравни с ручным baseline.",
      "acceptance": [
        "Определены гипотеза и stop criteria",
        "Указано число кейсов и причины ошибок",
        "Отчёт содержит выводы без неподтверждённого ROI"
      ],
      "estimated_hours": 10
    },
    {
      "theory": [
        "Offline eval / online metrics differences",
        "Failure severity и go/no-go reviews"
      ],
      "lab": "Составь release checklist для модельной ошибки, утечки данных и недоступности сервиса.",
      "acceptance": [
        "Есть P0/P1 критерии блокировки",
        "Определён план human review",
        "Проверена возможность отката и мониторинг качества"
      ],
      "estimated_hours": 9
    },
    {
      "theory": [
        "Pilot rollout and stakeholder alignment",
        "Retention and adoption metrics"
      ],
      "lab": "Подготовь пилот для 20 сотрудников: обучение, обратная связь, ограничения и метрики.",
      "acceptance": [
        "Есть план запуска на 2–4 недели",
        "Владелец каждой метрики указан",
        "Решение о масштабировании основано на данных пилота"
      ],
      "estimated_hours": 12
    }
  ]
}""")


def learning_details(track_key: str, stage_position: int) -> dict[str, object]:
    """Read a curriculum module without mutating the canonical milestone."""
    details = dict(AI_CURRICULUM_DETAILS[track_key][stage_position - 1])
    guide = stage_guide(track_key, stage_position)
    details["resources"] = reading_for_stage(track_key, stage_position)
    details["lab"] = "\n\n".join(
        (
            str(details["lab"]),
            f"Учебный кейс: {guide['case_study']}",
            f"Пример решения: {guide['worked_example']}",
            f"Типичная ошибка: {guide['common_mistake']}",
            f"Самостоятельная проверка: {guide['stretch_task']}",
        )
    )
    return details
