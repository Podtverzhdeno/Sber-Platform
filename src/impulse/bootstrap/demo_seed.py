"""Deterministic, versioned and idempotent demo dataset."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid5

from sqlalchemy import Table, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.bootstrap.settings import Settings
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.development import (
    course_track_links,
    courses,
    enrollments,
    milestones,
    roadmap_versions,
    tracks,
)
from impulse.infrastructure.models.ecosystem import (
    events,
    external_sources,
    participation_claims,
    programs,
)
from impulse.infrastructure.models.identity import (
    actor_roles,
    consents,
    persons,
    sessions,
    visibility_settings,
)
from impulse.infrastructure.models.recognition import (
    rating_policies,
    score_ledger,
    seasons,
    standings,
)
from impulse.infrastructure.models.reward import compensation_terms
from impulse.infrastructure.models.work import (
    appeals,
    applications,
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
        )
        for slug, _title in TRACKS
    ]
    course_rows = [
        demo_row(f"course:{index}", slug=f"demo-course-{index}", title=title)
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

    source_row = demo_row(
        "source:demo-sber",
        provider="demo-organizer",
        source_key="demo-programs",
        source_url="https://example.test/impulse-demo",
    )
    program_row = demo_row(
        "program:impulse",
        program_key="impulse-demo",
        title="Экосистема возможностей — демо",
        source_id=source_row["id"],
    )
    event_rows = [
        demo_row(
            f"event:{index}",
            program_id=program_row["id"],
            event_key=f"demo-event-{index}",
            title=title,
            deadline_at=DEMO_NOW + timedelta(days=index * 7),
            source_id=source_row["id"],
        )
        for index, title in enumerate(EVENTS, start=1)
    ]
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
        SeedBatch(tracks, track_rows),
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
    project_row = demo_row(
        "project:rd-lab",
        project_key="demo-rd-lab",
        title="R&D лаборатория — демо",
    )
    task_rows = [
        demo_row(
            f"task:{index}",
            project_id=project_row["id"],
            customer_id=demo_id("customer-roman"),
            task_key=f"demo-task-{index}",
            status="published" if index > 3 else ("accepted" if index == 1 else "in_progress"),
        )
        for index in range(1, 9)
    ]
    terms_rows = [
        demo_row(
            f"terms:{index}:1",
            task_id=demo_id(f"task:{index}"),
            terms_version=1,
            deadline_at=DEMO_NOW + timedelta(days=14 + index),
        )
        for index in range(1, 9)
    ]
    compensation_rows = [
        demo_row(
            f"compensation:{index}",
            task_terms_version_id=demo_id(f"terms:{index}:1"),
            paid=index % 3 != 0,
            base_amount="15000.00" if index % 3 != 0 else None,
            b_multiplier="1.50",
            a_multiplier="2.00" if index % 2 else "2.50",
            currency="RUB" if index % 3 != 0 else None,
        )
        for index in range(1, 9)
    ]
    participant_keys = ("participant-alex", "participant-maria", "participant-igor")
    application_rows = [
        demo_row(
            f"application:{index}",
            task_id=demo_id(f"task:{index}"),
            person_id=demo_id(person_key),
            accepted_terms_version=1,
            status="accepted",
        )
        for index, person_key in enumerate(participant_keys, start=1)
    ]
    assignment_rows = [
        demo_row(
            f"assignment:{index}",
            task_id=demo_id(f"task:{index}"),
            person_id=demo_id(person_key),
            application_id=demo_id(f"application:{index}"),
            status="accepted" if index == 1 else "in_progress",
        )
        for index, person_key in enumerate(participant_keys, start=1)
    ]
    contribution_rows = [
        demo_row(
            f"contribution:{index}:1",
            assignment_id=demo_id(f"assignment:{index}"),
            contribution_version=1,
            summary=f"Синтетический личный вклад участника {index}",
            status="accepted" if index == 1 else "submitted",
        )
        for index in range(1, 4)
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
    )
    policy_row = demo_row(
        "rating-policy:autumn-2026:1",
        season_id=season_row["id"],
        policy_version=1,
    )
    score_rows = [
        demo_row(
            f"score:{person_key}:project",
            season_id=season_row["id"],
            person_id=demo_id(person_key),
            source_type="project",
            source_id=demo_id(f"contribution:{index}:1"),
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
    return [
        SeedBatch(projects, [project_row]),
        SeedBatch(tasks, task_rows),
        SeedBatch(task_terms_versions, terms_rows),
        SeedBatch(compensation_terms, compensation_rows),
        SeedBatch(applications, application_rows),
        SeedBatch(assignments, assignment_rows),
        SeedBatch(contributions, contribution_rows),
        SeedBatch(appeals, [appeal_row]),
        SeedBatch(seasons, [season_row]),
        SeedBatch(rating_policies, [policy_row]),
        SeedBatch(score_ledger, score_rows),
        SeedBatch(standings, standing_rows),
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
        statement = insert(batch.table).values(batch.rows).on_conflict_do_nothing()
        await session.execute(statement)


async def reset_demo_data(database: Database, *, demo_mode: bool) -> None:
    """Delete only seed-owned rows and never operate outside demo mode."""
    if not demo_mode:
        raise RuntimeError("Demo reset is disabled when DEMO_MODE=false")
    batches = build_seed_batches()
    demo_person_ids = [demo_id(key) for key, _name, _role in PERSONAS]
    async with database.session() as session:
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
