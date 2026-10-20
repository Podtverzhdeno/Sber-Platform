"""Storage contracts and adapters for event detail and registration aggregates."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol, TypedDict, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from impulse.api.errors import ApiError
from impulse.domain.ecosystem import ClaimStatus
from impulse.events.models import (
    EventDetailRecord,
    EventReward,
    ProgramStage,
    RegistrationCounts,
    RewardKind,
)
from impulse.infrastructure.database import Database
from impulse.infrastructure.models.ecosystem import (
    events,
    external_sources,
    participation_claims,
)

ACTIVE_STATUSES: tuple[ClaimStatus, ...] = (
    ClaimStatus.REPORTED,
    ClaimStatus.AWAITING_VERIFICATION,
    ClaimStatus.VERIFIED,
)
REWARD_KINDS = frozenset({"frozen_points", "permanent_points", "certificate", "special_prize"})


class EventDetailStore(Protocol):
    async def event_detail(self, event_key: str) -> EventDetailRecord | None: ...

    async def registration_counts(self, event_key: str) -> RegistrationCounts: ...


class _ClaimSeed(TypedDict):
    person_key: str
    status: ClaimStatus


def default_demo_events(now: datetime | None = None) -> tuple[EventDetailRecord, ...]:
    """Memory detail catalog mirrors the published demo seed event keys."""
    checked = now or datetime.now(UTC)
    mayaki = EventDetailRecord(
        key="mayaki-2026",
        title="МАЯКИ 2026",
        event_type="educational_program",
        organizer="Сбер",
        status="open",
        conditions="Отбор по заявке и мотивации участника.",
        source_url="https://example.test/events/mayaki",
        source_status="current",
        source_checked_at=checked,
        track_keys=("python", "data", "product"),
        recommendation_reason=(
            "Даёт практику командной работы и знакомство с направлениями Сбера."
        ),
        description=(
            "Образовательная программа Сбера: командная практика на направлениях банка "
            "с наставниками и демо-день перед организаторами."
        ),
        target_audience=("Участники с активной траекторией в направлениях python, data, product."),
        prerequisites=(
            "Активная траектория на платформе",
            "Мотивационная заявка до дедлайна",
        ),
        program=(
            ProgramStage("День 0", "Старт отбора", "Заявки и мотивационный опрос."),
            ProgramStage("День 3", "Командный этап", "Практическая задача в командах."),
            ProgramStage("День 10", "Демо-день", "Презентация результата организаторам."),
        ),
        expected_result="Завершённый командный артефакт и подтверждённое участие.",
        participation_rules=(
            "Регистрация по ссылке организатора; участие подтверждается организатором."
        ),
        venue_format="Онлайн и очные площадки Сбера",
        timezone="Europe/Moscow",
        starts_at=None,
        ends_at=None,
        deadline_at=None,
        rewards=(
            EventReward(
                "frozen_points",
                "5 баллов за подтверждённую регистрацию",
                "Станут постоянными после проверки участия.",
            ),
        ),
    )
    green = EventDetailRecord(
        key="green-hack-2026",
        title="Green Hack",
        event_type="hackathon",
        organizer="Сбер",
        status="open",
        conditions="Команда от двух до пяти человек.",
        source_url="https://example.test/events/green-hack",
        source_status="current",
        source_checked_at=checked,
        track_keys=("python", "ml"),
        recommendation_reason="Подходит для проверки навыков разработки на реальном кейсе.",
        description="Хакатон Сбера по устойчивым технологиям на корпоративных кейсах.",
        target_audience="Разработчики, аналитики и ML-инженеры.",
        prerequisites=("Команда от 2 до 5 человек", "Знакомство с Python"),
        program=(
            ProgramStage("День 1", "Постановка", "Кейсы и менторские сессии."),
            ProgramStage("День 2", "Сборка", "Разработка прототипа."),
            ProgramStage("День 3", "Защита", "Демо и вопросы жюри."),
        ),
        expected_result="Рабочий прототип и защита перед жюри.",
        participation_rules="Регистрация команд от двух до пяти человек у организатора.",
        venue_format="Онлайн и площадка Сбера",
        timezone="Europe/Moscow",
        starts_at=None,
        ends_at=None,
        deadline_at=None,
        rewards=(
            EventReward("special_prize", "Призовой фонд жюри"),
            EventReward("certificate", "Сертификат финалиста"),
        ),
    )
    grant = EventDetailRecord(
        key="research-grant-2026",
        title="Грант на исследование",
        event_type="grant",
        organizer="Сбер и университеты-партнёры",
        status="open",
        conditions="Требуется описание исследовательской гипотезы.",
        source_url="https://example.test/events/research-grant",
        source_status="current",
        source_checked_at=checked,
        track_keys=("data", "ml"),
        recommendation_reason="Релевантно аналитическим и ML-направлениям.",
        description="Грантовая программа для исследовательских гипотез совместно с вузами.",
        target_audience="Исследователи и аналитики с подтверждённым опытом.",
        prerequisites=("Описание гипотезы", "Один соисполнитель от проекта"),
        program=None,
        expected_result=None,
        participation_rules="Заявка с гипотезой подлежит экспертной оценке организатора.",
        venue_format="Исследовательский трек",
        timezone=None,
        starts_at=None,
        ends_at=None,
        deadline_at=None,
        rewards=None,
    )
    return (mayaki, green, grant)


class MemoryEventDetailStore:
    """In-memory detail catalog with explicit per-event projection availability."""

    def __init__(
        self,
        *,
        events: tuple[EventDetailRecord, ...] | None = None,
        now: datetime | None = None,
    ) -> None:
        self._events = {
            record.key: record
            for record in (events if events is not None else default_demo_events(now))
        }
        self._claims: dict[str, list[_ClaimSeed]] = {}
        self._unavailable: set[str] = set()

    def add_event(self, record: EventDetailRecord) -> None:
        self._events[record.key] = record

    def mark_projection_unavailable(self, event_key: str) -> None:
        if event_key not in self._events:
            raise KeyError(event_key)
        self._unavailable.add(event_key)

    def record_claim(self, event_key: str, person_key: str, status: ClaimStatus) -> None:
        if event_key not in self._events:
            raise KeyError(event_key)
        self._claims.setdefault(event_key, []).append({"person_key": person_key, "status": status})

    async def event_detail(self, event_key: str) -> EventDetailRecord | None:
        return self._events.get(event_key)

    async def registration_counts(self, event_key: str) -> RegistrationCounts:
        if event_key not in self._events:
            raise ApiError(
                code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404
            )
        if event_key in self._unavailable:
            return RegistrationCounts(None, None, None)
        started: set[str] = set()
        confirmed: set[str] = set()
        participations: set[str] = set()
        for claim in self._claims.get(event_key, []):
            if claim["status"] not in ACTIVE_STATUSES:
                continue
            if claim["status"] is ClaimStatus.REPORTED:
                started.add(claim["person_key"])
            if claim["status"] in {ClaimStatus.AWAITING_VERIFICATION, ClaimStatus.VERIFIED}:
                confirmed.add(claim["person_key"])
            if claim["status"] is ClaimStatus.VERIFIED:
                participations.add(claim["person_key"])
        return RegistrationCounts(len(started), len(confirmed), len(participations))


def _text(payload: dict[str, object], key: str) -> str | None:
    value = payload.get(key)
    if value is None or str(value) == "":
        return None
    return str(value)


def _list_of_text(payload: dict[str, object], key: str) -> tuple[str, ...] | None:
    raw = payload.get(key)
    if not isinstance(raw, list) or not raw:
        return None
    return tuple(str(item) for item in cast(list[object], raw))


def _stages(payload: dict[str, object]) -> tuple[ProgramStage, ...] | None:
    raw = payload.get("program")
    if not isinstance(raw, list) or not raw:
        return None
    stages: list[ProgramStage] = []
    for item in cast(list[object], raw):
        if not isinstance(item, dict):
            return None
        entry = cast(dict[str, object], item)
        stages.append(
            ProgramStage(
                day=str(entry.get("day", "")),
                title=str(entry.get("title", "")),
                detail=str(entry.get("detail", "")),
            )
        )
    return tuple(stages)


def _rewards(payload: dict[str, object]) -> tuple[EventReward, ...] | None:
    raw = payload.get("rewards")
    if not isinstance(raw, list) or not raw:
        return None
    rewards: list[EventReward] = []
    for item in cast(list[object], raw):
        if not isinstance(item, dict):
            return None
        entry = cast(dict[str, object], item)
        kind = str(entry.get("kind", ""))
        if kind not in REWARD_KINDS:
            return None
        rewards.append(
            EventReward(
                cast(RewardKind, kind),
                str(entry.get("label", "")),
                str(entry.get("note", "")),
            )
        )
    return tuple(rewards)


def _datetime_of(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _detail_query():
    return select(
        events.c.event_key,
        events.c.title,
        events.c.deadline_at,
        events.c.status,
        events.c.payload,
        external_sources.c.provider,
        external_sources.c.source_url,
        external_sources.c.status.label("source_status"),
        external_sources.c.payload.label("source_payload"),
    ).join(external_sources, external_sources.c.id == events.c.source_id)


async def _distinct_by_status(
    session: AsyncSession,
    event_key: str,
    statuses: tuple[ClaimStatus, ...],
) -> int | None:
    statement = (
        select(func.count(func.distinct(participation_claims.c.person_id)))
        .select_from(participation_claims)
        .join(events, events.c.id == participation_claims.c.event_id)
        .where(
            events.c.event_key == event_key,
            participation_claims.c.status.in_(status.value for status in statuses),
        )
    )
    return int((await session.execute(statement)).scalar() or 0)


class SqlEventDetailStore:
    """PostgreSQL adapter over the published events participation projection."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def event_detail(self, event_key: str) -> EventDetailRecord | None:
        async with self.database.sessions() as session:
            row = (
                await session.execute(_detail_query().where(events.c.event_key == event_key))
            ).first()
        if row is None:
            return None
        payload = dict(row.payload)
        source_payload = dict(row.source_payload)
        return EventDetailRecord(
            key=row.event_key,
            title=row.title,
            event_type=str(payload.get("event_type", "program")),
            organizer=str(payload.get("organizer", row.provider)),
            status=row.status,
            conditions=str(payload.get("conditions", "Условия доступны у организатора.")),
            source_url=row.source_url,
            source_status=row.source_status,
            source_checked_at=_datetime_of(source_payload.get("checked_at")),
            track_keys=tuple(str(item) for item in payload.get("track_keys", [])),
            recommendation_reason=str(
                payload.get(
                    "recommendation_reason",
                    "Связано с выбранным профессиональным направлением.",
                )
            ),
            description=_text(payload, "description"),
            target_audience=_text(payload, "target_audience"),
            prerequisites=_list_of_text(payload, "prerequisites"),
            program=_stages(payload),
            expected_result=_text(payload, "expected_result"),
            participation_rules=_text(payload, "participation_rules"),
            venue_format=_text(payload, "venue_format"),
            timezone=_text(payload, "timezone"),
            starts_at=_datetime_of(payload.get("starts_at")),
            ends_at=_datetime_of(payload.get("ends_at")),
            deadline_at=row.deadline_at,
            rewards=_rewards(payload),
        )

    async def registration_counts(self, event_key: str) -> RegistrationCounts:
        async with self.database.sessions() as session:
            started = await _distinct_by_status(session, event_key, (ClaimStatus.REPORTED,))
            confirmed = await _distinct_by_status(
                session,
                event_key,
                (ClaimStatus.AWAITING_VERIFICATION, ClaimStatus.VERIFIED),
            )
            participations = await _distinct_by_status(session, event_key, (ClaimStatus.VERIFIED,))
        return RegistrationCounts(started, confirmed, participations)
