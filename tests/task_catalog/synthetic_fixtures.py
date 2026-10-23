"""Deterministic synthetic fixtures for the participant task catalog (TC-018).

Every fixture is built from explicitly labelled synthetic data: UUIDs are
derived from stable scenario keys, timestamps are constants and no field
carries real personal data.  Fixtures only use the frozen TC-007/TC-013
contract types; they never define matching weights, legal terms or endpoint
wiring.  Downstream endpoint/UI tasks may import these scenarios instead of
inventing ad-hoc payloads.

Covered dimensions (TC-018): eligible/ineligible/unknown eligibility, calculated
and insufficient-data match score coverage, deadlines (far/soon/absent), support
model states, paid/unpaid terms, 3/5/7-stage plans, brief/terms version pairs
and every application state of the catalog contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid5

from impulse.application.task_catalog import (
    ApplicationState,
    BenefitState,
    CatalogAction,
    ConditionalBenefit,
    CustomerSummary,
    CustomerVerification,
    EligibilityProjection,
    EligibilityStatus,
    ForecastStatus,
    MatchProjection,
    MatchReason,
    MatchStatus,
    ProjectionSource,
    SkillImpactProjection,
    StagePlanItem,
    StagePlanProjection,
    StagePlanState,
    TaskRecommendationProjection,
)

FIXTURE_NAMESPACE = UUID("00000000-0000-0000-0000-00000000f018")
FIXTURE_GENERATED_AT = datetime(2026, 10, 22, 12, 0, tzinfo=UTC)
FIXTURE_DEADLINE_FAR = datetime(2026, 12, 20, 18, 0, tzinfo=UTC)
FIXTURE_DEADLINE_SOON = datetime(2026, 10, 25, 18, 0, tzinfo=UTC)
FIXTURE_SNAPSHOT_VERSION = "evidence-synthetic-000"
FIXTURE_ALGORITHM_VERSION = "synthetic-matching-v0"


class SupportModel(StrEnum):
    """Synthetic support labels; real support catalogue belongs to its own task."""

    NONE = "none"
    MENTOR = "mentor"
    MENTOR_AND_EXPERT = "mentor_and_expert"


@dataclass(frozen=True, slots=True)
class SyntheticTaskTerms:
    """Permitted terms summary that the catalog projection intentionally omits."""

    paid: bool
    support: SupportModel
    requires_signed_terms: bool


@dataclass(frozen=True, slots=True)
class SyntheticCatalogTask:
    """One labelled fixture: catalog projection plus its permitted terms summary."""

    key: str
    projection: TaskRecommendationProjection
    terms: SyntheticTaskTerms


def task_uuid(key: str) -> UUID:
    return uuid5(FIXTURE_NAMESPACE, key)


def synthetic_source(kind: str, ref: str, version: str = "1") -> ProjectionSource:
    return ProjectionSource(
        kind=f"synthetic:{kind}", ref=ref, version=version, observed_at=FIXTURE_GENERATED_AT
    )


def stage_plan(stage_count: int, *, version: int = 1) -> StagePlanProjection:
    """Data-driven plan with exactly `stage_count` neutral planned stages."""

    if stage_count not in (3, 5, 7):
        raise ValueError("Fixture stage plans cover 3, 5 and 7 stages only.")
    stage_names = (
        "Погружение",
        "Исследование",
        "Прототип",
        "Реализация",
        "Проверка",
        "Доработка",
        "Защита",
    )
    stages = tuple(
        StagePlanItem(
            key=f"stage-{position}",
            position=position,
            title=stage_names[position - 1],
            summary=f"Синтетический этап {position} из {stage_count}.",
            estimated_minutes=60 * position,
            state=StagePlanState.PLANNED,
            prerequisite_keys=(f"stage-{position - 1}",) if position > 1 else (),
            expected_evidence=(f"evidence-{position}",),
        )
        for position in range(1, stage_count + 1)
    )
    return StagePlanProjection(version=version, stages=stages)


def calculated_match(percent: str, coverage: str) -> MatchProjection:
    return MatchProjection(
        status=MatchStatus.CALCULATED,
        percent=Decimal(percent),
        coverage=Decimal(coverage),
        algorithm_version=FIXTURE_ALGORITHM_VERSION,
        source_snapshot_version=FIXTURE_SNAPSHOT_VERSION,
        calculated_at=FIXTURE_GENERATED_AT,
        reasons=(
            MatchReason(
                code="FORMAT_FIT",
                label="Формат совпадает с предпочтением",
                source_refs=(synthetic_source("profile", "format-preference"),),
            ),
        ),
    )


def insufficient_match(missing: tuple[str, ...]) -> MatchProjection:
    return MatchProjection(
        status=MatchStatus.INSUFFICIENT_DATA,
        percent=None,
        coverage=Decimal("0"),
        algorithm_version=None,
        source_snapshot_version=FIXTURE_SNAPSHOT_VERSION,
        calculated_at=FIXTURE_GENERATED_AT,
        missing_factors=missing,
    )


def skill_impact_calculated() -> SkillImpactProjection:
    return SkillImpactProjection(
        skill_id="synthetic-skill-1",
        title="Синтетический навык",
        status=ForecastStatus.CALCULATED,
        current_level="L2",
        projected_level="L3",
        model_version="synthetic-competency-v0",
        explanation="Прогноз станет уровнем только после проверки evidence.",
        sources=(synthetic_source("competency", "model"),),
    )


def skill_impact_insufficient() -> SkillImpactProjection:
    return SkillImpactProjection(
        skill_id="synthetic-skill-2",
        title="Непокрытый навык",
        status=ForecastStatus.INSUFFICIENT_DATA,
        current_level=None,
        projected_level=None,
        model_version=None,
        explanation="Недостаточно подтверждённых данных для прогноза.",
        sources=(synthetic_source("competency", "model"),),
    )


def eligible() -> EligibilityProjection:
    return EligibilityProjection(status=EligibilityStatus.ELIGIBLE, reason_codes=())


def benefit(code: str, label: str, state: BenefitState) -> ConditionalBenefit:
    return ConditionalBenefit(
        code=code,
        label=label,
        state=state,
        condition="Условие проверяется по подтверждённому источнику.",
        sources=(synthetic_source("benefit", code),),
    )


def _customer(name: str, verification: CustomerVerification) -> CustomerSummary:
    return CustomerSummary(
        id=task_uuid(f"customer:{name}"), display_name=name, verification=verification
    )


def build(
    key: str, projection: TaskRecommendationProjection, terms: SyntheticTaskTerms
) -> SyntheticCatalogTask:
    return SyntheticCatalogTask(key=key, projection=projection, terms=terms)


def build_raw_projection(
    key: str,
    *,
    title: str,
    brief_summary: str,
    eligibility: EligibilityProjection,
    match: MatchProjection,
    stage_count: int,
    application_state: ApplicationState,
    deadline: datetime | None,
    brief_version: int,
    terms_version: int,
    difficulty: str | None,
    duration_minutes: int | None,
    places_total: int,
    places_available: int | None,
    work_format: str,
    allowed_actions: frozenset[CatalogAction],
    customer: CustomerSummary,
    skill_impact: tuple[SkillImpactProjection, ...],
    benefits: tuple[ConditionalBenefit, ...] = (),
) -> TaskRecommendationProjection:
    return TaskRecommendationProjection(
        task_id=task_uuid(key),
        schema_version=1,
        snapshot_version=FIXTURE_SNAPSHOT_VERSION,
        brief_version=brief_version,
        terms_version=terms_version,
        title=title,
        customer=customer,
        brief_summary=brief_summary,
        competency_tags=("synthetic-tag",),
        difficulty=difficulty,
        duration_minutes=duration_minutes,
        work_format=work_format,
        places_total=places_total,
        places_available=places_available,
        deadline_at=deadline,
        eligibility=eligibility,
        match=match,
        skill_impact=skill_impact,
        stage_plan=stage_plan(stage_count),
        benefits=benefits,
        application_state=application_state,
        allowed_actions=allowed_actions,
        sources=(synthetic_source("task_brief", key),),
        generated_at=FIXTURE_GENERATED_AT,
    )


ELIGIBLE = "eligible"
INELIGIBLE = "ineligible"
UNKNOWN_ELIGIBILITY = "unknown-eligibility"
PAID = "paid"
UNPAID = "unpaid"

_STAGE_COUNTS = (3, 5, 7)
_APPLICATION_STATES = (
    ApplicationState.NONE,
    ApplicationState.SUBMITTED,
    ApplicationState.UNDER_REVIEW,
    ApplicationState.ACCEPTED,
    ApplicationState.ASSIGNED,
    ApplicationState.CLOSED,
    ApplicationState.UNAVAILABLE,
)


def _application_actions(state: ApplicationState, *, eligible: bool) -> frozenset[CatalogAction]:
    actions = {CatalogAction.OPEN_CONDITIONS, CatalogAction.BOOKMARK, CatalogAction.SHARE}
    if eligible and state is ApplicationState.NONE:
        actions.add(CatalogAction.APPLY)
    if state in (
        ApplicationState.SUBMITTED,
        ApplicationState.UNDER_REVIEW,
        ApplicationState.ACCEPTED,
    ):
        actions.add(CatalogAction.OPEN_APPLICATION)
    if state is ApplicationState.ASSIGNED:
        actions.add(CatalogAction.OPEN_WORKSPACE)
    if state is ApplicationState.NONE:
        actions.add(CatalogAction.WITHDRAW)
    return frozenset(actions)


def _paid_terms(support: SupportModel) -> SyntheticTaskTerms:
    return SyntheticTaskTerms(paid=True, support=support, requires_signed_terms=True)


def _unpaid_terms(support: SupportModel) -> SyntheticTaskTerms:
    return SyntheticTaskTerms(paid=False, support=support, requires_signed_terms=False)


def _fixtures() -> tuple[SyntheticCatalogTask, ...]:
    fixtures: list[SyntheticCatalogTask] = []

    # Eligible + calculated match at both coverage extremes, unpaid/3 stages.
    for label, percent, coverage in (
        ("high", "87.5", "0.9"),
        ("low", "42.0", "0.35"),
    ):
        fixtures.append(
            build(
                f"{ELIGIBLE}-{label}-coverage",
                build_raw_projection(
                    f"{ELIGIBLE}-{label}-coverage",
                    title=f"Синтетическая задача: eligibility {label} coverage",
                    brief_summary="Синтетический бриф для проверки объяснимого соответствия.",
                    eligibility=eligible(),
                    match=calculated_match(percent, coverage),
                    stage_count=3,
                    application_state=ApplicationState.NONE,
                    deadline=FIXTURE_DEADLINE_FAR,
                    brief_version=1,
                    terms_version=1,
                    difficulty="средняя",
                    duration_minutes=480,
                    places_total=3,
                    places_available=3,
                    work_format="удалённо",
                    allowed_actions=_application_actions(ApplicationState.NONE, eligible=True),
                    customer=_customer("Синтетический заказчик", CustomerVerification.DEMO),
                    skill_impact=(skill_impact_calculated(),),
                    benefits=(benefit("SKILL", "Развитие навыка", BenefitState.POTENTIAL),),
                ),
                _unpaid_terms(SupportModel.MENTOR),
            )
        )

    # Ineligible: explainable reason, no apply, paid/5 stages, mentor+expert support.
    fixtures.append(
        build(
            f"{INELIGIBLE}-prerequisite-gap",
            build_raw_projection(
                f"{INELIGIBLE}-prerequisite-gap",
                title="Синтетическая задача: не пройден prerequisite",
                brief_summary="Синтетический бриф с закрытым приёмом по prerequisite.",
                eligibility=EligibilityProjection(
                    status=EligibilityStatus.INELIGIBLE,
                    reason_codes=("PREREQUISITE_GAP",),
                    missing_prerequisites=("synthetic-course-1",),
                ),
                match=calculated_match("55.0", "0.5"),
                stage_count=5,
                application_state=ApplicationState.NONE,
                deadline=FIXTURE_DEADLINE_FAR,
                brief_version=2,
                terms_version=1,
                difficulty="высокая",
                duration_minutes=1200,
                places_total=2,
                places_available=1,
                work_format="гибрид",
                allowed_actions=_application_actions(ApplicationState.NONE, eligible=False),
                customer=_customer("Синтетический заказчик 2", CustomerVerification.VERIFIED),
                skill_impact=(skill_impact_insufficient(),),
            ),
            _paid_terms(SupportModel.MENTOR_AND_EXPERT),
        )
    )

    # Unknown eligibility with honest insufficient-data match (no fabricated zero).
    fixtures.append(
        build(
            UNKNOWN_ELIGIBILITY,
            build_raw_projection(
                UNKNOWN_ELIGIBILITY,
                title="Синтетическая задача: недостаточно данных",
                brief_summary="Синтетический бриф, где соответствие не рассчитывается.",
                eligibility=EligibilityProjection(
                    status=EligibilityStatus.UNKNOWN,
                    reason_codes=("EVIDENCE_COVERAGE",),
                ),
                match=insufficient_match(("verified_skill", "role_snapshot")),
                stage_count=7,
                application_state=ApplicationState.NONE,
                deadline=FIXTURE_DEADLINE_SOON,
                brief_version=1,
                terms_version=2,
                difficulty=None,
                duration_minutes=None,
                places_total=1,
                places_available=None,
                work_format="удалённо",
                allowed_actions=_application_actions(ApplicationState.NONE, eligible=False),
                customer=_customer("Синтетический заказчик 3", CustomerVerification.UNVERIFIED),
                skill_impact=(skill_impact_insufficient(),),
            ),
            _paid_terms(SupportModel.NONE),
        )
    )

    # Deadline-absent unpaid task; unknown facts stay unknown.
    fixtures.append(
        build(
            "no-deadline",
            build_raw_projection(
                "no-deadline",
                title="Синтетическая задача: срок уточняется",
                brief_summary="Синтетический бриф без объявленного дедлайна.",
                eligibility=eligible(),
                match=calculated_match("61.0", "0.6"),
                stage_count=3,
                application_state=ApplicationState.NONE,
                deadline=None,
                brief_version=3,
                terms_version=3,
                difficulty="лёгкая",
                duration_minutes=240,
                places_total=4,
                places_available=0,
                work_format="удалённо",
                allowed_actions=_application_actions(ApplicationState.NONE, eligible=True),
                customer=_customer("Синтетический заказчик 4", CustomerVerification.DEMO),
                skill_impact=(skill_impact_calculated(),),
            ),
            _unpaid_terms(SupportModel.NONE),
        )
    )

    # Every application state on a stable eligible paid task (5 stages).
    for state in _APPLICATION_STATES:
        is_eligible = state is not ApplicationState.UNAVAILABLE
        fixtures.append(
            build(
                f"application-{state.value}",
                build_raw_projection(
                    f"application-{state.value}",
                    title=f"Синтетическая задача: состояние заявки {state.value}",
                    brief_summary="Синтетический бриф для проверки действий по состоянию заявки.",
                    eligibility=eligible(),
                    match=calculated_match("72.0", "0.7"),
                    stage_count=5,
                    application_state=state,
                    deadline=FIXTURE_DEADLINE_FAR,
                    brief_version=1,
                    terms_version=1,
                    difficulty="средняя",
                    duration_minutes=600,
                    places_total=2,
                    places_available=1,
                    work_format="удалённо",
                    allowed_actions=_application_actions(state, eligible=is_eligible),
                    customer=_customer("Синтетический заказчик 5", CustomerVerification.VERIFIED),
                    skill_impact=(skill_impact_calculated(),),
                    benefits=(benefit("TEAM_EXPERIENCE", "Опыт команды", BenefitState.POTENTIAL),),
                ),
                _paid_terms(SupportModel.MENTOR),
            )
        )

    # Paid/unpaid pair with 7-stage plans and mixed terms versions.
    paid_unpaid = (
        ("paid", _paid_terms(SupportModel.MENTOR_AND_EXPERT)),
        ("unpaid", _unpaid_terms(SupportModel.MENTOR)),
    )
    for paid_label, terms in paid_unpaid:
        fixtures.append(
            build(
                f"{paid_label}-seven-stages",
                build_raw_projection(
                    f"{paid_label}-seven-stages",
                    title=f"Синтетическая задача: {paid_label}, 7 этапов",
                    brief_summary="Синтетический бриф длинного плана этапов.",
                    eligibility=eligible(),
                    match=calculated_match("66.0", "0.65"),
                    stage_count=7,
                    application_state=ApplicationState.NONE,
                    deadline=FIXTURE_DEADLINE_FAR,
                    brief_version=2,
                    terms_version=3,
                    difficulty="средняя",
                    duration_minutes=1800,
                    places_total=5,
                    places_available=5,
                    work_format="гибрид",
                    allowed_actions=_application_actions(ApplicationState.NONE, eligible=True),
                    customer=_customer("Синтетический заказчик 6", CustomerVerification.DEMO),
                    skill_impact=(skill_impact_calculated(), skill_impact_insufficient()),
                    benefits=(
                        benefit("SKILL_DEVELOPMENT", "Развитие навыка", BenefitState.POTENTIAL),
                        benefit("PORTFOLIO", "Портфолио", BenefitState.POTENTIAL),
                        benefit("FEEDBACK", "Обратная связь", BenefitState.ACTUAL),
                    ),
                ),
                terms,
            )
        )

    return tuple(fixtures)


FIXTURES: tuple[SyntheticCatalogTask, ...] = _fixtures()
FIXTURES_BY_KEY: dict[str, SyntheticCatalogTask] = {fixture.key: fixture for fixture in FIXTURES}
