"""Deterministic, versioned and idempotent demo dataset."""
# ruff: noqa: RUF001

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid5

from sqlalchemy import Table, delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.application.reward import DEFAULT_REVIEW_RUBRIC
from impulse.bootstrap.settings import Settings
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.development import (
    course_track_links,
    courses,
    enrollments,
    learning_days,
    milestones,
    roadmap_versions,
    track_attempts,
    tracks,
)
from impulse.infrastructure.models.ecosystem import (
    events,
    external_sources,
    participation_claims,
    programs,
    provider_records,
)
from impulse.infrastructure.models.identity import (
    actor_roles,
    consents,
    persons,
    sessions,
    visibility_settings,
)
from impulse.infrastructure.models.operations import case_decisions, operations_cases
from impulse.infrastructure.models.recognition import (
    credentials,
    rating_policies,
    score_ledger,
    seasons,
    standings,
    trophies,
)
from impulse.infrastructure.models.reward import (
    compensation_terms,
    payout_claims,
    review_5plus_versions,
    review_rubrics,
    settlement_attempts,
)
from impulse.infrastructure.models.talent import talent_pipeline_events
from impulse.infrastructure.models.work import (
    acceptances,
    appeals,
    applications,
    artifacts,
    assignments,
    contributions,
    projects,
    task_terms_versions,
    tasks,
)

DEMO_SEED_VERSION = 1
DEMO_NAMESPACE = UUID("6c3775de-88fa-4d98-a584-cf7820422d54")
DEMO_NOW = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)


def demo_id(key: str) -> UUID:
    return uuid5(DEMO_NAMESPACE, f"v{DEMO_SEED_VERSION}:{key}")


def demo_row(key: str, **values: object) -> dict[str, object]:
    return {
        "id": demo_id(key),
        "data_origin": "demo_seed",
        "provenance": {"seed_version": DEMO_SEED_VERSION, "synthetic": True},
        **values,
    }


@dataclass(frozen=True, slots=True)
class SeedBatch:
    table: Table
    rows: list[dict[str, object]]


PERSONAS = (
    ("participant-alex", "Алекс Речной", "participant"),
    ("participant-maria", "Мария Северова", "participant"),
    ("participant-igor", "Игорь Лесной", "participant"),
    ("participant-anna", "Анна Смирнова", "participant"),
    ("participant-ilya", "Илья Кузнецов", "participant"),
    ("participant-artem", "Артём Соколов", "participant"),
    ("participant-daria", "Дарья Орлова", "participant"),
    ("participant-kirill", "Кирилл Меньшев", "participant"),
    ("participant-sofia", "София Белова", "participant"),
    ("participant-timur", "Тимур Валеев", "participant"),
    ("mentor-elena", "Елена Наставник", "mentor"),
    ("customer-roman", "Роман Заказчик", "customer"),
    ("manager-olga", "Ольга Руководитель", "manager"),
    ("hr-nina", "Нина HR", "hr"),
    ("operator-pavel", "Павел Оператор", "operator"),
)
TRACKS = (
    ("python", "Python-разработчик"),
    ("data", "Аналитик данных"),
    ("product", "Продуктовый аналитик"),
    ("ml", "ML-инженер"),
)
COURSES = (
    "OpenSpec и SDD",
    "Агентная разработка",
    "Python: основа",
    "FastAPI",
    "SQL",
    "Аналитика продукта",
    "Машинное обучение",
    "Git и командная работа",
    "Тестирование",
    "Безопасность данных",
    "Презентация результата",
    "Корпоративная культура",
)
EVENTS = (
    "МАЯКИ: демо",
    "Хакатон данных",
    "Грантовый конкурс",
    "Университетская лаборатория",
    "Карьерный день",
    "Инженерный интенсив",
    "Продуктовый кейс-чемпионат",
    "Школа исследователей",
)


def build_seed_batches() -> list[SeedBatch]:
    person_rows = [
        demo_row(key, display_name=name, external_key=f"demo:{key}")
        for key, name, _role in PERSONAS
    ]
    role_rows = [
        demo_row(
            f"role:{key}:{role}",
            person_id=demo_id(key),
            role=role,
            program_key="impulse-demo",
        )
        for key, _name, role in PERSONAS
    ]
    role_rows.append(
        demo_row(
            "role:manager-olga:customer",
            person_id=demo_id("manager-olga"),
            role="customer",
            program_key="impulse-demo",
        )
    )
    consent_rows = [
        demo_row(
            f"consent:{key}:hr-profile",
            person_id=demo_id(key),
            scope="hr_profile",
            granted=True,
            status="active",
        )
        for key, _name, role in PERSONAS
        if role == "participant"
    ]
    visibility_rows = [
        demo_row(
            f"visibility:{key}:hr-profile",
            person_id=demo_id(key),
            scope="hr_profile",
            visible=True,
            status="active",
        )
        for key, _name, role in PERSONAS
        if role == "participant"
    ]
    track_rows = [demo_row(f"track:{slug}", slug=slug, title=title) for slug, title in TRACKS]
    roadmap_rows = [
        demo_row(
            f"roadmap:{slug}:1",
            track_id=demo_id(f"track:{slug}"),
            policy_version=1,
        )
        for slug, _title in TRACKS
    ]
    milestone_rows = [
        demo_row(
            f"milestone:{slug}:start",
            roadmap_version_id=demo_id(f"roadmap:{slug}:1"),
            milestone_key="start-bootcamp",
            position=1,
            payload={
                "title": "Начать Bootcamp",
                "purpose": "Освоить основу и перейти к первой реальной задаче.",
                "skill": "Spec-driven development",
                "target_kind": "course",
                "target_key": "demo-course-1",
            },
        )
        for slug, _title in TRACKS
    ]
    course_rows = [
        demo_row(
            f"course:{index}",
            slug=f"demo-course-{index}",
            title=title,
            payload={
                "source_url": f"https://example.test/courses/demo-course-{index}",
                "availability": "unavailable" if index == 5 else "available",
                "access_note": (
                    "Внешний курс пока не подключён; доступна исходная ссылка."
                    if index == 5
                    else "Доступен в демонстрационном каталоге."
                ),
            },
        )
        for index, title in enumerate(COURSES, start=1)
    ]
    course_link_rows = [
        demo_row(
            f"course-link:{index}",
            course_id=demo_id(f"course:{index}"),
            track_id=demo_id(f"track:{TRACKS[(index - 1) % len(TRACKS)][0]}"),
        )
        for index in range(1, len(COURSES) + 1)
    ]
    enrollment_rows = [
        demo_row(
            f"enrollment:alex:{index}",
            person_id=demo_id("participant-alex"),
            course_id=demo_id(f"course:{index}"),
            attempt_number=1,
            status="verified" if index <= 3 else "in_progress",
        )
        for index in range(1, 5)
    ]
    track_attempt_rows = [
        demo_row(
            "track-attempt:alex:python:1",
            person_id=demo_id("participant-alex"),
            track_id=demo_id("track:python"),
            attempt_number=1,
            status="active",
            payload={"completed_milestones": []},
        ),
        demo_row(
            "track-attempt:maria:data:1",
            person_id=demo_id("participant-maria"),
            track_id=demo_id("track:data"),
            attempt_number=1,
            status="active",
            payload={"completed_milestones": ["start-bootcamp"]},
        ),
    ]

    source_row = demo_row(
        "source:demo-sber",
        provider="demo-organizer",
        source_key="demo-programs",
        source_url="https://example.test/impulse-demo",
        payload={"checked_at": DEMO_NOW.isoformat(), "freshness": "current"},
    )
    program_row = demo_row(
        "program:impulse",
        program_key="impulse-demo",
        title="Экосистема возможностей — демо",
        source_id=source_row["id"],
    )
    event_types = ("educational_program", "hackathon", "grant")
    track_groups = (("python", "product"), ("python", "ml"), ("data", "ml"))
    event_rows: list[dict[str, object]] = []
    for index, title in enumerate(EVENTS, start=1):
        event_type = event_types[(index - 1) % len(event_types)]
        linked_tracks = track_groups[(index - 1) % len(track_groups)]
        event_rows.append(
            demo_row(
                f"event:{index}",
                program_id=program_row["id"],
                event_key=f"demo-event-{index}",
                title=title,
                deadline_at=DEMO_NOW + timedelta(days=index * 7),
                source_id=source_row["id"],
                status="open" if index <= 6 else "closed",
                payload={
                    "event_type": event_type,
                    "organizer": "Сбер · демо",
                    "conditions": "Ознакомьтесь с условиями и подайте заявку у организатора.",
                    "starts_at": (DEMO_NOW + timedelta(days=index * 7 + 3)).isoformat(),
                    "track_keys": list(linked_tracks),
                    "recommendation_reason": (
                        f"Связано с направлениями: {', '.join(linked_tracks)}."
                    ),
                },
            )
        )
    participation_rows = [
        demo_row(
            "participation:alex:1",
            person_id=demo_id("participant-alex"),
            event_id=demo_id("event:1"),
            claim_type="winner",
            status="verified",
        )
    ]

    batches = [
        SeedBatch(persons, person_rows),
        SeedBatch(actor_roles, role_rows),
        SeedBatch(consents, consent_rows),
        SeedBatch(visibility_settings, visibility_rows),
        SeedBatch(tracks, track_rows),
        SeedBatch(track_attempts, track_attempt_rows),
        SeedBatch(roadmap_versions, roadmap_rows),
        SeedBatch(milestones, milestone_rows),
        SeedBatch(courses, course_rows),
        SeedBatch(course_track_links, course_link_rows),
        SeedBatch(enrollments, enrollment_rows),
        SeedBatch(external_sources, [source_row]),
        SeedBatch(programs, [program_row]),
        SeedBatch(events, event_rows),
        SeedBatch(participation_claims, participation_rows),
    ]
    return batches + build_work_and_rating_batches()


def build_work_and_rating_batches() -> list[SeedBatch]:
    rubric_row = demo_row(
        "rubric:5plus",
        id=DEFAULT_REVIEW_RUBRIC.rubric_id,
        rubric_key=DEFAULT_REVIEW_RUBRIC.key,
        rubric_version=DEFAULT_REVIEW_RUBRIC.version,
        status="published",
        payload={
            "criteria": [
                {"key": item.key, "title": item.title} for item in DEFAULT_REVIEW_RUBRIC.criteria
            ]
        },
    )
    project_row = demo_row(
        "project:rd-lab",
        project_key="demo-rd-lab",
        title="R&D лаборатория — демо",
    )
    task_specs = (
        ("Прототип рекомендательной системы для научных статей", "accepted", 6, "R&D · ML"),
        ("MVP чат-ассистента для внутренних знаний", "in_progress", 4, "MVP · LLM"),
        (
            "Исследование методов сжатия спутниковых изображений",
            "in_progress",
            4,
            "Исследование · CV",
        ),
        ("Прогнозирование нагрузки контактного центра", "in_progress", 3, "R&D · Аналитика"),
        ("Детекция аномалий в сетевом трафике", "in_progress", 3, "MVP · Безопасность"),
        ("Модель оценки энергоэффективности зданий", "in_progress", 5, "R&D · GreenTech"),
        ("Автоматизация проверки технической документации", "published", 5, "MVP · NLP"),
        (
            "Дашборд продуктовых метрик корпоративного сервиса",
            "published",
            4,
            "Аналитика · Product",
        ),
        ("Поиск дублей обращений пользователей", "published", 4, "R&D · Data"),
        ("Прототип персонального образовательного roadmap", "published", 6, "MVP · EdTech"),
        ("Benchmark моделей распознавания документов", "published", 3, "Исследование · CV"),
        ("Анализ факторов удержания пользователей", "published", 4, "Аналитика · Product"),
    )
    task_rows = [
        demo_row(
            f"task:{index}",
            project_id=project_row["id"],
            customer_id=demo_id("customer-roman"),
            task_key=f"demo-task-{index}",
            status=status,
            payload={
                "title": title,
                "places": places,
                "category": category,
                "brief": {
                    "problem": (
                        "Проверить бизнес-гипотезу и подготовить воспроизводимый "
                        f"результат: {title.lower()}."
                    ),
                    "deliverable": (
                        "Исследование, работающий прототип, репозиторий и краткая "
                        "презентация результата."
                    ),
                    "acceptance_criteria": [
                        "Результат воспроизводится по инструкции",
                        "Ключевые метрики и ограничения описаны",
                        "Личный вклад каждого участника подтверждён",
                    ],
                    "deadline_at": (DEMO_NOW + timedelta(days=14 + index)).isoformat(),
                    "data_constraints": (
                        "Только синтетические и обезличенные демонстрационные данные."
                    ),
                    "ip_terms": (
                        "Результат доступен заказчику, авторство сохраняется в портфолио участника."
                    ),
                },
                "nominated_mentor_id": None,
                "support": {
                    "mode": "mentor",
                    "assignee_id": str(demo_id("mentor-elena")),
                },
            },
        )
        for index, (title, status, places, category) in enumerate(task_specs, start=1)
    ]
    terms_rows = [
        demo_row(
            f"terms:{index}:1",
            task_id=demo_id(f"task:{index}"),
            terms_version=1,
            deadline_at=DEMO_NOW + timedelta(days=14 + index),
            status="published",
            payload={
                "deliverable": "Репозиторий, прототип, отчёт и презентация результата.",
                "acceptance_criteria": [
                    "Воспроизводимость",
                    "Измеримое качество",
                    "Подтверждённый личный вклад",
                ],
                "support_mode": "mentor",
            },
        )
        for index in range(1, len(task_specs) + 1)
    ]
    compensation_rows = [
        demo_row(
            f"compensation:{index}",
            task_terms_version_id=demo_id(f"terms:{index}:1"),
            paid=index % 3 != 0,
            base_amount=str(40000 + index * 5000) if index % 4 != 0 else None,
            b_multiplier="1.50",
            a_multiplier="2.00" if index % 2 else "2.50",
            quantum="0.01",
            rounding_mode="half_up",
            policy_version=1,
            payout_condition="Принятый личный вклад и опубликованная человеком оценка.",
            currency="RUB" if index % 3 != 0 else None,
        )
        for index in range(1, len(task_specs) + 1)
    ]
    participant_keys = tuple(key for key, _name, role in PERSONAS if role == "participant")
    assignment_specs = tuple(enumerate(participant_keys, start=1))
    application_rows = [
        demo_row(
            f"application:{index}",
            task_id=demo_id(f"task:{index}"),
            person_id=demo_id(person_key),
            accepted_terms_version=1,
            status="accepted",
        )
        for index, person_key in assignment_specs
    ]
    application_rows.extend(
        demo_row(
            f"application:extra:{task_index}:{person_key}",
            task_id=demo_id(f"task:{task_index}"),
            person_id=demo_id(person_key),
            accepted_terms_version=1,
            status="applied",
        )
        for task_index, person_key in (
            (7, "participant-alex"),
            (7, "participant-anna"),
            (8, "participant-maria"),
            (9, "participant-kirill"),
            (10, "participant-sofia"),
            (11, "participant-artem"),
            (12, "participant-daria"),
        )
    )
    assignment_rows = [
        demo_row(
            f"assignment:{index}",
            task_id=demo_id(f"task:{index}"),
            person_id=demo_id(person_key),
            application_id=demo_id(f"application:{index}"),
            status="accepted" if index == 1 else "in_progress",
        )
        for index, person_key in assignment_specs
    ]
    contribution_rows = [
        demo_row(
            f"contribution:{index}:1",
            assignment_id=demo_id(f"assignment:{index}"),
            contribution_version=1,
            summary=(
                "Подготовлен воспроизводимый модуль, тесты, описание экспериментов "
                "и анализ ограничений."
                if index % 2
                else (
                    "Реализован API прототипа, собраны метрики качества и оформлена "
                    "инструкция запуска."
                )
            ),
            status="accepted" if index <= 3 else "submitted",
        )
        for index in range(1, 9)
    ]
    artifact_rows = [
        demo_row(
            f"artifact:{index}:repo",
            contribution_id=demo_id(f"contribution:{index}:1"),
            artifact_key="repository",
            uri=f"https://example.test/demo/tasks/{index}/repository",
            status="verified" if index <= 3 else "submitted",
        )
        for index in range(1, 9)
    ]
    acceptance_rows = [
        demo_row(
            f"acceptance:{index}:1",
            contribution_id=demo_id(f"contribution:{index}:1"),
            decided_by=demo_id("customer-roman"),
            contribution_version=1,
            status="accepted",
            payload={"reason": "Результат соответствует опубликованным критериям."},
        )
        for index in range(1, 4)
    ]
    review_rows = [
        demo_row(
            f"review:{index}:v1",
            review_id=demo_id(f"review:participant:{index}"),
            contribution_id=demo_id(f"contribution:{index}:1"),
            rubric_id=DEFAULT_REVIEW_RUBRIC.rubric_id,
            review_version=1,
            grade=("B" if index == 1 else "A" if index in (2, 4) else "C"),
            status=("published" if index <= 2 else "proposed" if index <= 4 else "draft"),
            created_by=demo_id("mentor-elena"),
            payload={
                "contribution_version": 1,
                "rubric_version": 1,
                "assessments": [
                    {
                        "criterion_key": item.key,
                        "finding": f"Проверен критерий «{item.title}» для задачи {index}.",
                        "evidence_refs": [
                            f"demo:task:{index}:repository",
                            f"demo:task:{index}:report",
                        ],
                    }
                    for item in DEFAULT_REVIEW_RUBRIC.criteria
                ],
                "explanation": "Черновик основан на артефактах и должен быть подтверждён ментором.",
                "draft_origin": "ai_suggestion" if index >= 3 else "human",
                "confirmed_by": str(demo_id("mentor-elena")) if index <= 2 else None,
                "published_by": str(demo_id("mentor-elena")) if index <= 2 else None,
            },
        )
        for index in range(1, 9)
    ]
    payout_rows = [
        demo_row(
            f"payout:{index}:review-1",
            assignment_id=demo_id(f"assignment:{index}"),
            contribution_version=1,
            terms_version=1,
            review_id=demo_id(f"review:participant:{index}"),
            review_version=1,
            grade="B" if index == 1 else "A",
            amount="67500.00" if index == 1 else "100000.00",
            currency="RUB",
            status="calculated" if index == 1 else "approved",
        )
        for index in range(1, 3)
    ]
    appeal_row = demo_row(
        "appeal:alex:score",
        person_id=demo_id("participant-alex"),
        subject_type="score",
        subject_id=demo_id("score:alex:project"),
        subject_version=1,
        status="open",
    )

    season_row = demo_row(
        "season:autumn-2026",
        season_key="demo-autumn-2026",
        title="Демо-сезон: осень 2026",
        status="open",
        payload={"policy_version": 1},
    )
    policy_row = demo_row(
        "rating-policy:autumn-2026:1",
        season_id=season_row["id"],
        policy_version=1,
        status="published",
        payload={
            "cohort": {
                "key": "python-demo",
                "title": "Python demo",
                "program_key": "impulse-demo",
                "track_keys": ["python"],
                "minimum_size": 2,
            },
            "sources": [
                {
                    "rule_id": "accepted-contribution",
                    "source_type": "project",
                    "weight": "1",
                    "cap": "600",
                },
                {"rule_id": "review-5plus", "source_type": "review", "weight": "1", "cap": "300"},
                {"rule_id": "verified-event", "source_type": "event", "weight": "1", "cap": "100"},
            ],
            "tie_breakers": [
                "successful_projects",
                "highest_project_score",
                "earliest_achievement",
                "person_id",
            ],
            "diploma_thresholds": [
                {"level": "gold", "place_from": 1, "place_to": 3, "title": "I degree"},
                {"level": "silver", "place_from": 4, "place_to": 10, "title": "II degree"},
            ],
            "appeal_period_days": 14,
        },
    )
    score_rows = [
        demo_row(
            f"score:{person_key}:project",
            season_id=season_row["id"],
            person_id=demo_id(person_key),
            source_type="project",
            source_id=demo_id(f"task:{index}"),
            rule_id="accepted-contribution",
            points=str(600 - index * 50),
        )
        for index, person_key in enumerate(participant_keys, start=1)
    ]
    standing_rows = [
        demo_row(
            f"standing:{person_key}",
            season_id=season_row["id"],
            person_id=demo_id(person_key),
            place=index,
            score=str(600 - index * 50),
        )
        for index, person_key in enumerate(participant_keys, start=1)
    ]
    operations_rows = [
        demo_row(
            f"operations-case:{index}",
            case_type=case_type,
            title=title,
            priority=priority,
            due_at=DEMO_NOW + timedelta(days=index),
            status="open" if index < 5 else "resolved",
            payload={"source_refs": sources, "dependency_refs": dependencies},
        )
        for index, (case_type, title, priority, sources, dependencies) in enumerate(
            (
                (
                    "external_evidence",
                    "Победа в МАЯКАХ 2026",
                    "high",
                    ["event:demo-event-1", "document:diploma"],
                    ["trophy:pending"],
                ),
                (
                    "moderation",
                    "Публикация задачи по анализу документов",
                    "critical",
                    ["task:demo-task-7"],
                    ["publication:blocked"],
                ),
                (
                    "failed_payout",
                    "Повторная проверка начисления",
                    "high",
                    ["payout:1"],
                    ["review:1"],
                ),
                (
                    "appeal",
                    "Апелляция по оценке проекта",
                    "medium",
                    ["appeal:alex:score"],
                    ["score:pending"],
                ),
                (
                    "external_evidence",
                    "Проверка внешнего оффера",
                    "low",
                    ["event:demo-event-2"],
                    [],
                ),
            ),
            start=1,
        )
    ]
    decision_rows = [
        demo_row(
            "case-decision:5:1",
            case_id=demo_id("operations-case:5"),
            case_version=1,
            actor_id=demo_id("operator-pavel"),
            outcome="verified",
            reason="Источник и документы проверены оператором.",
            status="published",
        )
    ]
    talent_rows = [
        demo_row(
            f"talent:{person_key}:invitation",
            candidate_id=demo_id(person_key),
            hr_id=demo_id("hr-nina"),
            stage="invitation",
            note="Приглашение создано HR после просмотра подтверждённого портфолио.",
            occurred_at=DEMO_NOW + timedelta(days=index),
            status="published",
            data_origin="human",
        )
        for index, person_key in enumerate(participant_keys[:4], start=1)
    ]
    return [
        SeedBatch(review_rubrics, [rubric_row]),
        SeedBatch(projects, [project_row]),
        SeedBatch(tasks, task_rows),
        SeedBatch(task_terms_versions, terms_rows),
        SeedBatch(compensation_terms, compensation_rows),
        SeedBatch(applications, application_rows),
        SeedBatch(assignments, assignment_rows),
        SeedBatch(contributions, contribution_rows),
        SeedBatch(artifacts, artifact_rows),
        SeedBatch(acceptances, acceptance_rows),
        SeedBatch(review_5plus_versions, review_rows),
        SeedBatch(payout_claims, payout_rows),
        SeedBatch(appeals, [appeal_row]),
        SeedBatch(seasons, [season_row]),
        SeedBatch(rating_policies, [policy_row]),
        SeedBatch(score_ledger, score_rows),
        SeedBatch(standings, standing_rows),
        SeedBatch(operations_cases, operations_rows),
        SeedBatch(case_decisions, decision_rows),
        SeedBatch(talent_pipeline_events, talent_rows),
    ]


async def seed_demo(database: Database) -> dict[str, int]:
    batches = build_seed_batches()
    async with database.session() as session:
        await _insert_batches(session, batches)

    async with database.sessions() as session:
        return {
            batch.table.name: int(
                await session.scalar(
                    select(func.count())
                    .select_from(batch.table)
                    .where(batch.table.c.data_origin == "demo_seed")
                )
                or 0
            )
            for batch in batches
        }


async def _insert_batches(session: AsyncSession, batches: list[SeedBatch]) -> None:
    for batch in batches:
        if not batch.rows:
            continue
        statement = insert(batch.table).values(batch.rows)
        if batch.table is talent_pipeline_events:
            statement = statement.on_conflict_do_nothing(index_elements=[batch.table.c.id])
        else:
            update_values = {
                key: getattr(statement.excluded, key) for key in batch.rows[0] if key != "id"
            }
            statement = statement.on_conflict_do_update(
                index_elements=[batch.table.c.id], set_=update_values
            )
        await session.execute(statement)


async def reset_demo_data(database: Database, *, demo_mode: bool) -> None:
    """Delete only seed-owned rows and never operate outside demo mode."""
    if not demo_mode:
        raise RuntimeError("Demo reset is disabled when DEMO_MODE=false")
    batches = build_seed_batches()
    demo_person_ids = [demo_id(key) for key, _name, _role in PERSONAS]
    async with database.session() as session:
        await session.execute(text("SET LOCAL impulse.demo_reset = 'on'"))
        runtime_enrollments = select(enrollments.c.id).where(
            enrollments.c.person_id.in_(demo_person_ids),
            enrollments.c.data_origin == "demo_runtime",
        )
        await session.execute(
            delete(learning_days).where(
                learning_days.c.enrollment_id.in_(runtime_enrollments),
                learning_days.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(enrollments).where(
                enrollments.c.person_id.in_(demo_person_ids),
                enrollments.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(track_attempts).where(
                track_attempts.c.person_id.in_(demo_person_ids),
                track_attempts.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(standings).where(
                standings.c.person_id.in_(demo_person_ids),
                standings.c.data_origin.in_(("demo_runtime", "derived")),
            )
        )
        for runtime_table in (credentials, score_ledger, trophies, provider_records):
            await session.execute(
                delete(runtime_table).where(runtime_table.c.data_origin == "demo_runtime")
            )
        await session.execute(
            delete(participation_claims).where(
                participation_claims.c.person_id.in_(demo_person_ids),
                participation_claims.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(external_sources).where(external_sources.c.data_origin == "demo_runtime")
        )
        await session.execute(delete(appeals).where(appeals.c.data_origin == "demo_runtime"))
        await session.execute(
            delete(settlement_attempts).where(settlement_attempts.c.data_origin == "demo_runtime")
        )
        await session.execute(
            delete(payout_claims).where(payout_claims.c.data_origin == "demo_runtime")
        )
        await session.execute(
            delete(review_5plus_versions).where(
                review_5plus_versions.c.data_origin == "demo_runtime"
            )
        )
        await session.execute(
            delete(acceptances).where(acceptances.c.data_origin == "demo_runtime")
        )
        await session.execute(delete(artifacts).where(artifacts.c.data_origin == "demo_runtime"))
        await session.execute(
            delete(contributions).where(contributions.c.data_origin == "demo_runtime")
        )
        await session.execute(
            delete(assignments).where(
                assignments.c.person_id.in_(demo_person_ids),
                assignments.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(applications).where(
                applications.c.person_id.in_(demo_person_ids),
                applications.c.data_origin == "demo_runtime",
            )
        )
        await session.execute(
            delete(compensation_terms).where(compensation_terms.c.data_origin == "demo_runtime")
        )
        await session.execute(
            delete(task_terms_versions).where(task_terms_versions.c.data_origin == "demo_runtime")
        )
        await session.execute(
            delete(tasks).where(
                tasks.c.customer_id.in_(demo_person_ids),
                tasks.c.data_origin == "demo_runtime",
            )
        )
        for runtime_table in (sessions, visibility_settings, consents):
            await session.execute(
                delete(runtime_table).where(
                    runtime_table.c.person_id.in_(demo_person_ids),
                    runtime_table.c.data_origin == "demo_runtime",
                )
            )
        for batch in reversed(batches):
            await session.execute(
                delete(batch.table).where(batch.table.c.data_origin == "demo_seed")
            )


def _configured_database(settings: Settings) -> Database:
    if settings.database_url is None:
        raise RuntimeError("DATABASE_URL is required for demo data commands")
    return Database(settings.database_url.get_secret_value())


async def _seed_command() -> None:
    settings = Settings()
    if not settings.demo_mode:
        raise RuntimeError("Demo seed is disabled when DEMO_MODE=false")
    database = _configured_database(settings)
    try:
        report = await seed_demo(database)
        print(f"Demo seed v{DEMO_SEED_VERSION}: {sum(report.values())} records")
    finally:
        await database.close()


async def _reset_command() -> None:
    settings = Settings()
    database = _configured_database(settings)
    try:
        await reset_demo_data(database, demo_mode=settings.demo_mode)
        print("Demo seed records removed")
    finally:
        await database.close()


def main_seed() -> None:
    asyncio.run(_seed_command())


def main_reset() -> None:
    asyncio.run(_reset_command())
