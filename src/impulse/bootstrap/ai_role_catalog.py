"""Curated AI-only career route catalogue for the synthetic Impulse demo.

Role keys remain stable (legacy deep links and participant progress).
All published stages contain one canonical course/task target and three
learning activities, which are *planned actions*, never fabricated completions.
"""

from __future__ import annotations

import json
from typing import TypedDict, cast


class AiRoleStage(TypedDict):
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str
    activities: list[str]
    deliverable: str


class AiRoleProfile(TypedDict):
    title: str
    description: str
    stages: list[AiRoleStage]


# ruff: noqa: E501 -- long text inside the JSON curriculum is user-facing copy.

AI_ROLE_PROFILES: dict[str, AiRoleProfile] = cast(
    dict[str, AiRoleProfile],
    json.loads(r"""{
  "product": {
    "title": "AI Architect",
    "description": "Проектирует надёжные корпоративные AI-системы, определяет границы сервисов, интеграции и критерии качества.",
    "stages": [
      {
        "title": "AI Systems Foundations",
        "purpose": "Понять компоненты корпоративного AI-приложения и границы ответственности",
        "skill": "System design",
        "target_kind": "course",
        "target_key": "demo-course-1",
        "activities": [
          "Разобрать LLM, RAG, tool calling и агенты",
          "Нарисовать контекст C4 для AI-сервиса",
          "Сформулировать 5 нефункциональных требований"
        ],
        "deliverable": "Контекстная диаграмма и список требований"
      },
      {
        "title": "Requirements & ADR",
        "purpose": "Перевести бизнес-задачу в проверяемую архитектуру",
        "skill": "Requirements",
        "target_kind": "course",
        "target_key": "demo-course-6",
        "activities": [
          "Описать пользователей, цели и ограничения",
          "Сравнить 2 архитектурных варианта",
          "Оформить ADR с последствиями выбранного решения"
        ],
        "deliverable": "SDD и ADR с обоснованием"
      },
      {
        "title": "RAG & Knowledge Design",
        "purpose": "Спроектировать retrieval, индексацию и жизненный цикл знаний",
        "skill": "RAG architecture",
        "target_kind": "task",
        "target_key": "demo-task-2",
        "activities": [
          "Выбрать схему chunking и metadata",
          "Определить ACL, freshness и citations",
          "Составить тестовый набор запросов для retrieval"
        ],
        "deliverable": "Схема RAG и стратегия проверки"
      },
      {
        "title": "Agent & A2A Integration",
        "purpose": "Определить коммуникации между агентами и внешними API",
        "skill": "Agent architecture",
        "target_kind": "course",
        "target_key": "demo-course-2",
        "activities": [
          "Разделить оркестрацию и бизнес-сервисы",
          "Определить контракты инструментов и таймауты",
          "Добавить идемпотентность, аудит и контроль доступа"
        ],
        "deliverable": "C4 Container и API-контракты"
      },
      {
        "title": "Security & Reliability",
        "purpose": "Спроектировать отказоустойчивость и доверенные границы",
        "skill": "Security architecture",
        "target_kind": "course",
        "target_key": "demo-course-10",
        "activities": [
          "Провести threat modeling для prompt injection",
          "Задать least privilege и секретное хранилище",
          "Спроектировать RTO, ретраи и безопасный fallback"
        ],
        "deliverable": "Threat model и reliability checklist"
      },
      {
        "title": "Observability & LLM Evaluation",
        "purpose": "Сделать качество и стоимость измеримыми",
        "skill": "LLM quality",
        "target_kind": "task",
        "target_key": "demo-task-11",
        "activities": [
          "Выбрать метрики качества и инструментальных вызовов",
          "Добавить трассировку и бюджет токенов",
          "Сформировать критерии принятия новой версии"
        ],
        "deliverable": "План LLM-evaluation и SLA"
      },
      {
        "title": "Architecture Defense",
        "purpose": "Защитить end-to-end AI-архитектуру",
        "skill": "Architecture review",
        "target_kind": "task",
        "target_key": "demo-task-10",
        "activities": [
          "Собрать C4, ADR, SDD и диаграммы потоков",
          "Подготовить нагрузочные и негативные сценарии",
          "Представить риски, TCO и план внедрения"
        ],
        "deliverable": "Архитектурный пакет и защита"
      }
    ]
  },
  "ml": {
    "title": "AI Engineer",
    "description": "Разрабатывает прикладные AI-функции: промпты, модели, retrieval, инструменты и производственный API.",
    "stages": [
      {
        "title": "Python & AI Foundations",
        "purpose": "Подготовить стек разработки AI-приложений",
        "skill": "Python",
        "target_kind": "course",
        "target_key": "demo-course-3",
        "activities": [
          "Настроить Python, типизацию и virtualenv",
          "Написать модуль с unit-тестами",
          "Описать схему данных и интерфейсы"
        ],
        "deliverable": "Рабочий Python-модуль и тесты"
      },
      {
        "title": "LLM API & Prompting",
        "purpose": "Научиться управлять LLM, форматом и контекстом",
        "skill": "LLM integration",
        "target_kind": "course",
        "target_key": "demo-course-2",
        "activities": [
          "Вызвать модель через клиент и обработать ошибки",
          "Ввести структурированный JSON-вывод",
          "Проверить промпт на фиксированном датасете"
        ],
        "deliverable": "LLM API endpoint с eval-кейсами"
      },
      {
        "title": "RAG Pipeline",
        "purpose": "Построить поиск и заземлённые ответы",
        "skill": "Retrieval",
        "target_kind": "task",
        "target_key": "demo-task-2",
        "activities": [
          "Реализовать индекс документов и chunking",
          "Вычислить retrieval precision на вопросах",
          "Добавить ссылки на источники в ответы"
        ],
        "deliverable": "Рабочий RAG-прототип"
      },
      {
        "title": "Tool Calling & Agents",
        "purpose": "Добавить агенту инструменты и контролируемые переходы",
        "skill": "Agent coding",
        "target_kind": "course",
        "target_key": "demo-course-2",
        "activities": [
          "Описать schema 2 безопасных инструментов",
          "Реализовать граф состояний и лимиты шагов",
          "Обработать таймауты и невалидный JSON"
        ],
        "deliverable": "Тестируемый агент с инструментами"
      },
      {
        "title": "Quality Evaluation",
        "purpose": "Проверить корректность и устойчивость агента",
        "skill": "AI evaluation",
        "target_kind": "task",
        "target_key": "demo-task-1",
        "activities": [
          "Собрать 30 тестовых сценариев",
          "Измерить hallucination и tool success rate",
          "Сравнить новую конфигурацию с baseline"
        ],
        "deliverable": "Отчёт об оценке качества"
      },
      {
        "title": "Deployment & Monitoring",
        "purpose": "Подготовить развёртывание и диагностику",
        "skill": "MLOps",
        "target_kind": "task",
        "target_key": "demo-task-10",
        "activities": [
          "Обернуть сервис в контейнер",
          "Добавить healthcheck и структурные логи",
          "Измерить p95 latency и стоимость вызовов"
        ],
        "deliverable": "Демонстрационный deployment"
      },
      {
        "title": "Production Project",
        "purpose": "Представить законченный AI-кейс",
        "skill": "Delivery",
        "target_kind": "task",
        "target_key": "demo-task-7",
        "activities": [
          "Согласовать критерии приёмки",
          "Предоставить репозиторий, тесты и демо",
          "Защитить решение и ограничения"
        ],
        "deliverable": "Проверяемый проект в портфолио"
      }
    ]
  },
  "python": {
    "title": "AI Security Engineer",
    "description": "Обеспечивает безопасность LLM, AI-агентов, данных и инструментов от проектирования до эксплуатации.",
    "stages": [
      {
        "title": "AI Threat Landscape",
        "purpose": "Понять основные атаки и доверенные границы",
        "skill": "AI security",
        "target_kind": "course",
        "target_key": "demo-course-10",
        "activities": [
          "Изучить prompt injection и jailbreak",
          "Разделить входы модели, данные и полномочия",
          "Составить модель угроз для RAG"
        ],
        "deliverable": "Реестр угроз и доверенных границ"
      },
      {
        "title": "Secure Model & Tool Access",
        "purpose": "Управлять разрешениями моделей и инструментов",
        "skill": "Identity & access",
        "target_kind": "course",
        "target_key": "demo-course-1",
        "activities": [
          "Определить права агента по least privilege",
          "Разнести секреты, роли и сервисные аккаунты",
          "Добавить проверку прав на каждый tool call"
        ],
        "deliverable": "Матрица авторизации агентов"
      },
      {
        "title": "Prompt Injection Defense",
        "purpose": "Разработать защиту от инструкций в недоверенных данных",
        "skill": "Injection defense",
        "target_kind": "task",
        "target_key": "demo-task-5",
        "activities": [
          "Подготовить безопасный тестовый набор атак",
          "Разграничить системные правила и контент",
          "Измерить долю блокирования атак"
        ],
        "deliverable": "Threat-driven test report"
      },
      {
        "title": "Data & RAG Protection",
        "purpose": "Защитить конфиденциальные документы и ответы",
        "skill": "Data security",
        "target_kind": "course",
        "target_key": "demo-course-5",
        "activities": [
          "Настроить разграничение доступа к документам",
          "Проверить утечки между tenant-контекстами",
          "Добавить redaction PII и аудит retrieval"
        ],
        "deliverable": "Модель доступа к данным"
      },
      {
        "title": "Secure Agent Execution",
        "purpose": "Ограничить действие агента и оценить риски",
        "skill": "Agent controls",
        "target_kind": "task",
        "target_key": "demo-task-7",
        "activities": [
          "Ввести allowlist действий и sandbox-ограничения",
          "Защитить от tool-result tampering",
          "Проверить отказы, ретраи и approval-gate"
        ],
        "deliverable": "Проверенный агентный контур"
      },
      {
        "title": "Red Team & Evaluation",
        "purpose": "Проверить устойчивость системы на негативных сценариях",
        "skill": "Red teaming",
        "target_kind": "task",
        "target_key": "demo-task-11",
        "activities": [
          "Сформировать adversarial evaluation suite",
          "Измерить unsafe completion и tool misuse",
          "Подготовить отчет об остаточных рисках"
        ],
        "deliverable": "Отчёт AI red teaming"
      },
      {
        "title": "Incident Response & Audit",
        "purpose": "Спроектировать расследование и реагирование на AI-инциденты",
        "skill": "Incident response",
        "target_kind": "course",
        "target_key": "demo-course-9",
        "activities": [
          "Настроить трассировку и корреляцию событий",
          "Описать процедуру отключения агента",
          "Провести tabletop exercise с ретроспективой"
        ],
        "deliverable": "Runbook инцидента и аудит"
      }
    ]
  },
  "data": {
    "title": "AI Data Engineer",
    "description": "Строит надёжные конвейеры данных, корпуса знаний, признаки и хранилища для AI-систем.",
    "stages": [
      {
        "title": "Data Engineering Basics",
        "purpose": "Разобрать источники, схемы и качество данных",
        "skill": "Data pipelines",
        "target_kind": "course",
        "target_key": "demo-course-3",
        "activities": [
          "Описать исходные схемы и форматы",
          "Подготовить преобразования Python",
          "Добавить schema validation"
        ],
        "deliverable": "Каталог источников и data contracts"
      },
      {
        "title": "SQL & Modeling",
        "purpose": "Спроектировать данные для аналитики и обучения",
        "skill": "SQL",
        "target_kind": "course",
        "target_key": "demo-course-5",
        "activities": [
          "Спроектировать нормализованные таблицы",
          "Написать SQL для качества и дедупликации",
          "Объяснить индексы и планы запросов"
        ],
        "deliverable": "SQL-модель и запросы"
      },
      {
        "title": "ETL & Orchestration",
        "purpose": "Обеспечить воспроизводимую обработку",
        "skill": "ETL",
        "target_kind": "task",
        "target_key": "demo-task-4",
        "activities": [
          "Построить инкрементальный ingestion",
          "Добавить retry и идемпотентность загрузки",
          "Организовать мониторинг джобов"
        ],
        "deliverable": "ETL pipeline и runbook"
      },
      {
        "title": "Document & Vector Pipeline",
        "purpose": "Подготовить документы для RAG",
        "skill": "RAG data",
        "target_kind": "task",
        "target_key": "demo-task-2",
        "activities": [
          "Нормализовать документы и metadata",
          "Реализовать chunking и эмбеддинги",
          "Проверить обновление индекса и удаление данных"
        ],
        "deliverable": "Индекс с provenance"
      },
      {
        "title": "Data Quality & Lineage",
        "purpose": "Сделать происхождение и качество проверяемыми",
        "skill": "Data quality",
        "target_kind": "course",
        "target_key": "demo-course-9",
        "activities": [
          "Определить data quality checks",
          "Зафиксировать lineage и версионирование",
          "Подготовить алерты при деградации"
        ],
        "deliverable": "Отчёт о качестве и lineage"
      },
      {
        "title": "Security & Governance",
        "purpose": "Настроить доступ и управление жизненным циклом",
        "skill": "Data governance",
        "target_kind": "course",
        "target_key": "demo-course-10",
        "activities": [
          "Проверить требования к PII и retention",
          "Добавить разграничение доступа",
          "Задать архивирование и удаление"
        ],
        "deliverable": "Data governance policy"
      },
      {
        "title": "Production Data Project",
        "purpose": "Защитить конвейер на реалистичном наборе",
        "skill": "Production ETL",
        "target_kind": "task",
        "target_key": "demo-task-8",
        "activities": [
          "Замерить latency и полноту ingestion",
          "Продемонстрировать восстановление после сбоя",
          "Собрать документацию и метрики"
        ],
        "deliverable": "Приёмочный data pipeline"
      }
    ]
  },
  "backend": {
    "title": "MLOps Engineer",
    "description": "Доставляет модели в производство: CI/CD, registry, мониторинг, версионирование и rollback.",
    "stages": [
      {
        "title": "MLOps Foundations",
        "purpose": "Изучить lifecycle моделей и требования к окружению",
        "skill": "MLOps",
        "target_kind": "course",
        "target_key": "demo-course-1",
        "activities": [
          "Разделить обучение, evaluation и serving",
          "Описать артефакты и версии модели",
          "Задать критерии воспроизводимости"
        ],
        "deliverable": "MLOps lifecycle diagram"
      },
      {
        "title": "Model Packaging",
        "purpose": "Сделать модель запускаемой и воспроизводимой",
        "skill": "Model serving",
        "target_kind": "course",
        "target_key": "demo-course-4",
        "activities": [
          "Упаковать inference в контейнер",
          "Реализовать healthcheck и readiness",
          "Зафиксировать зависимости и конфигурацию"
        ],
        "deliverable": "Inference container"
      },
      {
        "title": "CI/CD for Models",
        "purpose": "Построить безопасную доставку ML-артефактов",
        "skill": "CI/CD",
        "target_kind": "course",
        "target_key": "demo-course-8",
        "activities": [
          "Автоматизировать линтеры и тесты",
          "Подключить quality-gate на evaluation",
          "Настроить ручной approval перед релизом"
        ],
        "deliverable": "ML release pipeline"
      },
      {
        "title": "Registry & Experiment Tracking",
        "purpose": "Обеспечить трассируемость моделей и датасетов",
        "skill": "Experiment tracking",
        "target_kind": "task",
        "target_key": "demo-task-11",
        "activities": [
          "Версионировать модели и параметры",
          "Связать модель с training dataset",
          "Сформировать reproducibility report"
        ],
        "deliverable": "Модельный registry и отчёт"
      },
      {
        "title": "Observability & Drift",
        "purpose": "Контролировать деградацию при эксплуатации",
        "skill": "Monitoring",
        "target_kind": "task",
        "target_key": "demo-task-4",
        "activities": [
          "Измерить latency, ошибки и cost",
          "Проверить data drift и model drift",
          "Добавить алерты и SLO"
        ],
        "deliverable": "Дашборд MLOps"
      },
      {
        "title": "Scaling & Resilience",
        "purpose": "Управлять нагрузкой и откатом",
        "skill": "Reliability",
        "target_kind": "course",
        "target_key": "demo-course-10",
        "activities": [
          "Проверить autoscaling и resource limits",
          "Смоделировать сбой модели",
          "Выполнить canary и rollback"
        ],
        "deliverable": "Сценарий отказоустойчивости"
      },
      {
        "title": "Production Rollout",
        "purpose": "Провести приёмочный запуск",
        "skill": "Production delivery",
        "target_kind": "task",
        "target_key": "demo-task-1",
        "activities": [
          "Провести нагрузочный тест",
          "Подготовить runbook и incident plan",
          "Защитить стратегию релиза"
        ],
        "deliverable": "Production release pack"
      }
    ]
  },
  "design": {
    "title": "AI Agent Engineer",
    "description": "Создаёт автономные и полуавтономные AI-агенты: графы, память, инструменты, координацию.",
    "stages": [
      {
        "title": "Agent Foundations",
        "purpose": "Разобрать агентную архитектуру и границы автономности",
        "skill": "Agent basics",
        "target_kind": "course",
        "target_key": "demo-course-2",
        "activities": [
          "Разделить LLM, память и инструменты",
          "Описать пользовательский сценарий",
          "Выделить действия с обязательным approval"
        ],
        "deliverable": "Модель агентного сценария"
      },
      {
        "title": "Tool Design",
        "purpose": "Разработать надёжный контракт агентных инструментов",
        "skill": "Tool API",
        "target_kind": "course",
        "target_key": "demo-course-4",
        "activities": [
          "Описать JSON schema инструментов",
          "Реализовать обработку ошибок",
          "Добавить rate limit и идемпотентность"
        ],
        "deliverable": "API двух инструментов"
      },
      {
        "title": "Stateful Orchestration",
        "purpose": "Построить управляемый workflow агента",
        "skill": "State machines",
        "target_kind": "task",
        "target_key": "demo-task-2",
        "activities": [
          "Определить узлы и переходы",
          "Реализовать сохранение checkpoints",
          "Проверить retry и resume"
        ],
        "deliverable": "Граф и тесты восстановления"
      },
      {
        "title": "Memory & Context",
        "purpose": "Организовать безопасную память и контекст",
        "skill": "Memory design",
        "target_kind": "course",
        "target_key": "demo-course-5",
        "activities": [
          "Разделить краткосрочную и долговременную память",
          "Ввести TTL и фильтрацию памяти",
          "Проверить утечки контекста"
        ],
        "deliverable": "Схема memory lifecycle"
      },
      {
        "title": "Multi-agent & A2A",
        "purpose": "Организовать взаимодействие специализированных агентов",
        "skill": "Multi-agent systems",
        "target_kind": "task",
        "target_key": "demo-task-7",
        "activities": [
          "Определить роли и capability discovery",
          "Добавить контракт обмена задачами",
          "Реализовать журнал трассировок"
        ],
        "deliverable": "A2A демонстрация"
      },
      {
        "title": "Agent Evaluation",
        "purpose": "Оценить не только ответ, но и последовательность действий",
        "skill": "Agent quality",
        "target_kind": "task",
        "target_key": "demo-task-11",
        "activities": [
          "Собрать tool-use eval cases",
          "Оценить task success и tool correctness",
          "Проверить сценарии ошибочного поведения"
        ],
        "deliverable": "Evaluation dashboard"
      },
      {
        "title": "End-to-end Agent Delivery",
        "purpose": "Сдать завершённого агента с контролями",
        "skill": "Agent delivery",
        "target_kind": "task",
        "target_key": "demo-task-10",
        "activities": [
          "Собрать end-to-end прототип",
          "Описать ограничения, безопасность и SLA",
          "Провести демонстрацию бизнес-сценария"
        ],
        "deliverable": "Принятый агентный кейс"
      }
    ]
  },
  "manager": {
    "title": "AI Product Engineer",
    "description": "Превращает бизнес-проблему в проверяемый AI-продукт: гипотезы, прототип, метрики и внедрение.",
    "stages": [
      {
        "title": "AI Product Discovery",
        "purpose": "Выделить измеримую проблему и пользовательскую ценность",
        "skill": "Discovery",
        "target_kind": "course",
        "target_key": "demo-course-6",
        "activities": [
          "Сегментировать пользователей и JTBD",
          "Сформулировать бизнес-проблему",
          "Задать метрику успеха"
        ],
        "deliverable": "Problem brief"
      },
      {
        "title": "Use Case Economics",
        "purpose": "Проверить целесообразность AI-сценария",
        "skill": "Unit economics",
        "target_kind": "task",
        "target_key": "demo-task-12",
        "activities": [
          "Сравнить AI и rule-based альтернативы",
          "Оценить стоимость inference и операционные риски",
          "Построить грубую unit-экономику"
        ],
        "deliverable": "Feasibility assessment"
      },
      {
        "title": "Data & AI Feasibility",
        "purpose": "Оценить доступность данных и качество результата",
        "skill": "AI feasibility",
        "target_kind": "course",
        "target_key": "demo-course-7",
        "activities": [
          "Проверить источники и ограничения данных",
          "Создать набор acceptance-кейсов",
          "Определить baseline без LLM"
        ],
        "deliverable": "Feasibility matrix"
      },
      {
        "title": "MVP Specification",
        "purpose": "Подготовить спецификацию измеримого MVP",
        "skill": "Product specification",
        "target_kind": "course",
        "target_key": "demo-course-1",
        "activities": [
          "Создать пользовательские сценарии",
          "Описать NFR и критерии приёмки",
          "Приоритизировать backlog"
        ],
        "deliverable": "SDD и MVP backlog"
      },
      {
        "title": "Prototype & Experiment",
        "purpose": "Запустить эксперимент с минимальным продуктом",
        "skill": "Prototyping",
        "target_kind": "task",
        "target_key": "demo-task-10",
        "activities": [
          "Разработать прототип вместе с командой",
          "Выполнить эксперимент на синтетических данных",
          "Собрать метрики и feedback"
        ],
        "deliverable": "MVP demonstration"
      },
      {
        "title": "Quality & Risk Gates",
        "purpose": "Убедиться в безопасности и измеримом качестве",
        "skill": "AI product quality",
        "target_kind": "course",
        "target_key": "demo-course-9",
        "activities": [
          "Настроить eval-criteria и safety gate",
          "Проверить hallucination и fallback",
          "Сформулировать go/no-go критерии"
        ],
        "deliverable": "Quality release criteria"
      },
      {
        "title": "Launch & Iteration",
        "purpose": "Подготовить rollout и развитие AI-продукта",
        "skill": "Product launch",
        "target_kind": "task",
        "target_key": "demo-task-8",
        "activities": [
          "Составить план пилота и сегментов",
          "Подготовить dashboard бизнес-метрик",
          "Представить результаты и следующую итерацию"
        ],
        "deliverable": "Go-to-market pilot plan"
      }
    ]
  }
}"""),
)


def role_title(track_key: str) -> str:
    return str(AI_ROLE_PROFILES[track_key]["title"])


def role_description(track_key: str) -> str:
    return str(AI_ROLE_PROFILES[track_key]["description"])
