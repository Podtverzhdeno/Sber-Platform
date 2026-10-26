"""Versioned matching policy and canonical runtime projection for task catalog v2.

The pure scorer contains no storage or HTTP concerns.  The runtime adapter reads
only the participant's permitted work/development evidence and never invents a
missing score, forecast, duration or customer condition.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from impulse.application.development import DevelopmentService, RoadmapProjection
from impulse.application.identity import IdentityStore
from impulse.application.task_catalog import (
    TASK_CATALOG_SCHEMA_VERSION,
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
from impulse.application.task_catalog_demo_brands import catalog_demo_company_name
from impulse.application.task_terms_read import TaskTermsSnapshot
from impulse.application.work import (
    ApplicationRecord,
    AssignmentRecord,
    CaseEvidence,
    MarketplaceTask,
    TaskRecord,
    WorkService,
)
from impulse.domain.identity import ActorContext
from impulse.domain.work import ApplicationStatus, AssignmentStatus, TaskMode

ALGORITHM_VERSION = "task-match-v1"
EVIDENCE_FRESHNESS_DAYS = 365
MINIMUM_COVERAGE = Decimal("0.75")
ROLE_REQUIREMENTS = "ROLE_REQUIREMENTS"
VERIFIED_COMPETENCIES = "VERIFIED_COMPETENCIES"
GROWTH_FIT = "GROWTH_FIT"
FORMAT_FIT = "FORMAT_FIT"
_WEIGHTS = {
    ROLE_REQUIREMENTS: Decimal("0.40"),
    VERIFIED_COMPETENCIES: Decimal("0.30"),
    GROWTH_FIT: Decimal("0.20"),
    FORMAT_FIT: Decimal("0.10"),
}
_FACTOR_LABELS = {
    ROLE_REQUIREMENTS: "Соответствие роли и требованиям",
    VERIFIED_COMPETENCIES: "Подтверждённые компетенции",
    GROWTH_FIT: "Соответствие целям развития",
    FORMAT_FIT: "Формат и доступная нагрузка",
}
_ZERO = Decimal("0")
_ONE = Decimal("1")
_HUNDRED = Decimal("100")


@dataclass(frozen=True, slots=True)
class FactorValue:
    code: str
    value: Decimal | None

    def __post_init__(self) -> None:
        if self.code not in _WEIGHTS:
            raise ValueError("Unknown matching factor")
        if self.value is not None and not _ZERO <= self.value <= _ONE:
            raise ValueError("Matching factor must be within 0..1")


@dataclass(frozen=True, slots=True)
class FactorScore:
    status: MatchStatus
    percent: Decimal | None
    coverage: Decimal
    missing_factors: tuple[str, ...]


def score_factors(factors: tuple[FactorValue, ...]) -> FactorScore:
    """Approved weighted mean; unknown factors affect coverage, never become zero."""
    by_code = {item.code: item for item in factors}
    if set(by_code) != set(_WEIGHTS) or len(by_code) != len(factors):
        raise ValueError("Exactly one value for every matching factor is required")
    known = tuple(item for item in factors if item.value is not None)
    coverage = sum((_WEIGHTS[item.code] for item in known), _ZERO)
    missing = tuple(code for code in _WEIGHTS if by_code[code].value is None)
    if coverage < MINIMUM_COVERAGE:
        return FactorScore(MatchStatus.INSUFFICIENT_DATA, None, coverage, missing)
    weighted = sum((_WEIGHTS[item.code] * (item.value or _ZERO) for item in known), _ZERO)
    percent = (weighted / coverage * _HUNDRED).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return FactorScore(
        MatchStatus.CALCULATED,
        min(_HUNDRED, max(_ZERO, percent)),
        coverage,
        missing,
    )


@dataclass(frozen=True, slots=True)
class MatchingContext:
    """Permitted participant inputs; ``None`` means unknown, empty means known empty."""

    direction_keys: tuple[str, ...] | None
    growth_tags: frozenset[str] | None
    verified_tags: frozenset[str]
    source_snapshot_version: str
    format_fit: Decimal | None = None


def _normalized(values: tuple[str, ...] | frozenset[str]) -> frozenset[str]:
    return frozenset(value.strip().casefold() for value in values if value.strip())


def _ratio(numerator: int, denominator: int) -> Decimal:
    if denominator <= 0:
        return _ONE
    return Decimal(numerator) / Decimal(denominator)


def calculate_task_match(
    task: TaskRecord,
    context: MatchingContext,
    *,
    calculated_at: datetime,
) -> MatchProjection:
    catalog = task.catalog
    active_directions = context.direction_keys
    task_directions = _normalized(catalog.direction_keys)
    role_value: Decimal | None = None
    growth_value: Decimal | None = None
    if active_directions is not None and task_directions:
        active = _normalized(active_directions)
        role_value = _ONE if active & task_directions else _ZERO
        task_tags = _normalized(task.competency_tags)
        if context.growth_tags is not None and task_tags:
            growth_value = _ratio(len(context.growth_tags & task_tags), len(task_tags))

    required_tags = _normalized(task.competency_tags)
    verified = _normalized(context.verified_tags)
    competency_value = _ratio(len(required_tags & verified), len(required_tags))
    factors = (
        FactorValue(ROLE_REQUIREMENTS, role_value),
        FactorValue(VERIFIED_COMPETENCIES, competency_value),
        FactorValue(GROWTH_FIT, growth_value),
        FactorValue(FORMAT_FIT, context.format_fit),
    )
    result = score_factors(factors)
    values = {item.code: item.value for item in factors}
    source = ProjectionSource(
        kind="participant_matching_snapshot",
        ref=context.source_snapshot_version,
        version=ALGORITHM_VERSION,
        observed_at=calculated_at,
    )
    reasons: list[MatchReason] = []
    match_parts = [
        f"{_FACTOR_LABELS[code]}: {round((values[code] or _ZERO) * _HUNDRED)}%"
        for code in (ROLE_REQUIREMENTS, VERIFIED_COMPETENCIES)
        if values[code] is not None
    ]
    if match_parts:
        reasons.append(
            MatchReason(code="MATCH", label="; ".join(match_parts), source_refs=(source,))
        )
    if growth_value is not None:
        reasons.append(
            MatchReason(
                code="GROWTH",
                label=f"{_FACTOR_LABELS[GROWTH_FIT]}: {round(growth_value * _HUNDRED)}%",
                source_refs=(source,),
            )
        )
    if context.format_fit is not None:
        reasons.append(
            MatchReason(
                code=FORMAT_FIT,
                label=f"{_FACTOR_LABELS[FORMAT_FIT]}: {round(context.format_fit * _HUNDRED)}%",
                source_refs=(source,),
            )
        )
    missing_prerequisites = sorted(
        _normalized(task.catalog.prerequisite_tags) - context.verified_tags
    )
    if missing_prerequisites:
        reasons.append(
            MatchReason(
                code="PREREQUISITE_GAP",
                label="Нужно подтвердить: " + ", ".join(missing_prerequisites),
                source_refs=(
                    source,
                    ProjectionSource(
                        kind="task_brief",
                        ref=task.task_key,
                        version="1",
                        observed_at=calculated_at,
                    ),
                ),
            )
        )
    return MatchProjection(
        status=result.status,
        percent=result.percent,
        coverage=result.coverage,
        algorithm_version=ALGORITHM_VERSION,
        source_snapshot_version=context.source_snapshot_version,
        calculated_at=calculated_at,
        reasons=tuple(reasons),
        missing_factors=result.missing_factors,
        growth_fit_percent=(
            (growth_value * _HUNDRED).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if growth_value is not None
            else None
        ),
    )


def accepted_skill_evidence(
    evidence: tuple[CaseEvidence, ...], now: datetime
) -> dict[str, dict[str, CaseEvidence]]:
    """Unique accepted contributions per skill within the matching freshness window.

    Caller must pass participant_case_evidence, which contains only approved
    personal work with artifacts and permitted task ownership.
    """
    recent = (row for row in evidence if row.submitted_at >= now - timedelta(days=EVIDENCE_FRESHNESS_DAYS))
    result: dict[str, dict[str, CaseEvidence]] = {}
    for row in recent:
        for tag in _normalized(row.competency_tags):
            result.setdefault(tag, {})[str(row.contribution_id)] = row
    return result


def fresh_verified_tags(evidence: tuple[CaseEvidence, ...], now: datetime) -> frozenset[str]:
    threshold = now - timedelta(days=EVIDENCE_FRESHNESS_DAYS)
    return _normalized(
        frozenset(
            tag
            for item in evidence
            if item.submitted_at >= threshold
            for tag in item.competency_tags
        )
    )


def _source_snapshot(
    roadmaps: tuple[RoadmapProjection, ...],
    evidence: tuple[CaseEvidence, ...],
    format_fit: Decimal | None,
) -> str:
    payload = {
        "roadmaps": [
            {
                "track": item.track_key,
                "policy": item.policy_version,
                "completed": sorted(item.completed_keys),
                "targets": [
                    [milestone.key, milestone.skill, milestone.target_kind, milestone.target_key]
                    for milestone in item.milestones
                ],
            }
            for item in sorted(roadmaps, key=lambda item: item.track_key)
        ],
        "evidence": [
            [str(item.contribution_id), item.submitted_at.isoformat(), sorted(item.competency_tags)]
            for item in sorted(evidence, key=lambda item: str(item.contribution_id))
        ],
        "format_fit": str(format_fit) if format_fit is not None else None,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return "participant-" + hashlib.sha256(raw).hexdigest()[:24]


def matching_context(
    roadmaps: tuple[RoadmapProjection, ...],
    evidence: tuple[CaseEvidence, ...],
    now: datetime,
    *,
    format_fit: Decimal | None = None,
) -> MatchingContext:
    active = tuple(item for item in roadmaps if item.track_key)
    return MatchingContext(
        direction_keys=tuple(sorted(item.track_key for item in active)) if active else None,
        growth_tags=(
            _normalized(
                frozenset(milestone.skill for roadmap in active for milestone in roadmap.milestones)
            )
            if active
            else None
        ),
        verified_tags=fresh_verified_tags(evidence, now),
        source_snapshot_version=_source_snapshot(active, evidence, format_fit),
        format_fit=format_fit,
    )


def _task_snapshot(item: MarketplaceTask) -> str:
    task = item.task
    catalog = task.catalog
    payload = {
        "task": str(task.aggregate.task_id),
        "brief": task.aggregate.brief,
        "terms": item.terms.version,
        "catalog": catalog,
    }
    # Dataclass repr is deterministic for this immutable, JSON-free value object;
    # no participant-specific evidence or bookmark state enters the terms marker.
    raw = repr(payload).encode("utf-8")
    return "task-" + hashlib.sha256(raw).hexdigest()[:24]


def _application_state(
    application: ApplicationRecord | None,
    assignment: AssignmentRecord | None,
) -> ApplicationState:
    if assignment is not None:
        return (
            ApplicationState.CLOSED
            if assignment.status is AssignmentStatus.CLOSED
            else ApplicationState.ASSIGNED
        )
    if application is None or application.status in {
        ApplicationStatus.TERMS_ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    }:
        return ApplicationState.NONE
    if application.status is ApplicationStatus.APPLIED:
        return ApplicationState.UNDER_REVIEW
    if application.status is ApplicationStatus.ACCEPTED:
        return ApplicationState.ACCEPTED
    return ApplicationState.UNAVAILABLE


def _actions(
    state: ApplicationState,
    eligibility: EligibilityProjection,
) -> frozenset[CatalogAction]:
    actions = {CatalogAction.BOOKMARK, CatalogAction.SHARE}
    if state is ApplicationState.ASSIGNED:
        actions.add(CatalogAction.OPEN_WORKSPACE)
    elif state in {ApplicationState.UNDER_REVIEW, ApplicationState.ACCEPTED}:
        actions.update({CatalogAction.OPEN_APPLICATION, CatalogAction.WITHDRAW})
    elif state is ApplicationState.CLOSED:
        actions.add(CatalogAction.OPEN_APPLICATION)
    elif eligibility.status is EligibilityStatus.ELIGIBLE:
        actions.update({CatalogAction.OPEN_CONDITIONS, CatalogAction.APPLY})
    return frozenset(actions)


def _benefits(item: MarketplaceTask, source: ProjectionSource) -> tuple[ConditionalBenefit, ...]:
    result: list[ConditionalBenefit] = []
    compensation = item.terms.compensation
    if compensation.paid:
        condition = compensation.payout_condition or "not_provided"
        result.append(
            ConditionalBenefit(
                code="compensation",
                label="Оплачиваемое участие",
                state=BenefitState.POTENTIAL,
                condition=condition,
                sources=(source,),
                benefit_type="compensation",
            )
        )
    if item.terms.support_mode:
        result.append(
            ConditionalBenefit(
                code="support",
                label="Поддержка во время выполнения",
                state=BenefitState.POTENTIAL,
                condition=item.terms.support_mode,
                sources=(source,),
                benefit_type="support",
            )
        )
    if item.task.catalog.portfolio_permission != "none":
        result.append(
            ConditionalBenefit(
                code="portfolio",
                label="Возможность использовать результат в портфолио",
                state=BenefitState.POTENTIAL,
                condition=item.task.catalog.portfolio_permission,
                sources=(source,),
                benefit_type="portfolio",
            )
        )
    for index, description in enumerate(item.task.catalog.benefit_descriptions, start=1):
        result.append(
            ConditionalBenefit(
                code=f"customer_benefit_{index}",
                label=description,
                state=BenefitState.POTENTIAL,
                condition=description,
                sources=(source,),
                benefit_type="other",
            )
        )
    return tuple(result)


class TaskCatalogProjectionService:
    """Participant-scoped read model over canonical stores with bulk queries."""

    def __init__(
        self,
        work: WorkService,
        development: DevelopmentService,
        identity: IdentityStore,
        *,
        demo_mode: bool,
        now_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self._work = work
        self._development = development
        self._identity = identity
        self._demo_mode = demo_mode
        self._now = now_provider or (lambda: datetime.now(UTC))

    async def _build(
        self, actor: ActorContext
    ) -> tuple[tuple[TaskRecommendationProjection, TaskTermsSnapshot], ...]:
        marketplace = await self._work.marketplace(actor)
        task_ids = tuple(item.task.aggregate.task_id for item in marketplace)
        store = self._work.store
        (
            applications,
            assignment_counts,
            bookmarks,
            assignments,
            evidence,
            roadmaps,
        ) = await asyncio.gather(
            store.applications_for_person_tasks(actor.person_id, task_ids),
            store.assignment_counts_for_tasks(task_ids),
            store.bookmarked_task_ids(actor.person_id, task_ids),
            store.assignments_for_person(actor.person_id),
            self._work.participant_case_evidence(actor),
            self._development.roadmaps(actor),
        )
        customer_ids = {item.task.aggregate.customer_id for item in marketplace}
        customers = dict(
            zip(
                customer_ids,
                await asyncio.gather(
                    *(self._identity.get_persona_by_id(person_id) for person_id in customer_ids)
                ),
                strict=True,
            )
        )
        assignment_by_task = {item.task_id: item for item in assignments}
        now = self._now().astimezone(UTC)
        context = matching_context(roadmaps, evidence, now)
        evidence_by_skill = accepted_skill_evidence(evidence, now)
        result: list[tuple[TaskRecommendationProjection, TaskTermsSnapshot]] = []
        for marketplace_item in marketplace:
            task = marketplace_item.task
            terms = marketplace_item.terms
            task_id = task.aggregate.task_id
            assigned_count = assignment_counts.get(task_id, 0)
            application = applications.get(task_id)
            assignment = assignment_by_task.get(task_id)
            deadline_passed = terms.deadline_at <= now
            task_full = assigned_count >= task.places
            if (deadline_passed or task_full) and application is None and assignment is None:
                # Closed and full tasks are not admitted into the public catalog.
                continue
            missing_prerequisites = tuple(
                sorted(_normalized(task.catalog.prerequisite_tags) - context.verified_tags)
            )
            reason_codes: list[str] = []
            if deadline_passed:
                reason_codes.append("TASK_DEADLINE_PASSED")
            if task_full:
                reason_codes.append("TASK_FULL")
            if missing_prerequisites:
                reason_codes.append("PREREQUISITES_NOT_MET")
            if (
                task.mode is TaskMode.INVITATION_ONLY
                and marketplace_item.invitation_status != "accepted"
            ):
                reason_codes.append("INVITATION_NOT_ACCEPTED")
            eligibility = EligibilityProjection(
                status=(
                    EligibilityStatus.INELIGIBLE if reason_codes else EligibilityStatus.ELIGIBLE
                ),
                reason_codes=tuple(reason_codes),
                missing_prerequisites=missing_prerequisites,
            )
            state = _application_state(application, assignment)
            brief_source = ProjectionSource(
                kind="task_brief", ref=task.task_key, version="1", observed_at=now
            )
            terms_source = ProjectionSource(
                kind="task_terms",
                ref=task.task_key,
                version=str(terms.version),
                observed_at=now,
            )
            customer = customers.get(task.aggregate.customer_id)
            customer_name = customer.display_name if customer is not None else "Заказчик не указан"
            customer_verification = (
                CustomerVerification(customer.customer_verification)
                if customer is not None and customer.customer_verification is not None
                else (
                    CustomerVerification.DEMO
                    if self._demo_mode
                    else CustomerVerification.UNVERIFIED
                )
            )
            # Source logos are visual examples ONLY for known synthetic demo
            # tasks. Their publisher/person ID remains the authority for every
            # application, access check, notification and audit record.
            mock_company = catalog_demo_company_name(
                demo_mode=self._demo_mode,
                task_key=task.task_key,
                customer_name=customer_name,
                customer_verification=customer_verification.value,
            )
            if mock_company is not None:
                customer_name = mock_company
            match = calculate_task_match(task, context, calculated_at=now)
            impacts = tuple(
                SkillImpactProjection(
                    skill_id=tag,
                    title=tag,
                    status=ForecastStatus.QUALITATIVE,
                    current_level=None,
                    projected_level=None,
                    model_version=None,
                    explanation=(
                        "Компетенция указана в опубликованной задаче. "
                        "Числовой прогноз уровня не рассчитывается; результат требует проверки."
                    ),
                    verification_required=True,
                    sources=(brief_source,),
                    accepted_evidence_count=len(evidence_by_skill.get(tag.strip().casefold(), {})),
                    last_evidence_submitted_at=max(
                        (row.submitted_at for row in evidence_by_skill.get(tag.strip().casefold(), {}).values()),
                        default=None,
                    ),
                )
                for tag in task.competency_tags
            )
            plan = StagePlanProjection(
                version=1,
                stages=tuple(
                    StagePlanItem(
                        key=stage.key,
                        position=position,
                        title=stage.title,
                        summary=stage.summary,
                        estimated_minutes=stage.estimated_minutes,
                        state=StagePlanState.PLANNED,
                    )
                    for position, stage in enumerate(task.catalog.stage_plan, start=1)
                ),
            )
            projection = TaskRecommendationProjection(
                task_id=task_id,
                schema_version=TASK_CATALOG_SCHEMA_VERSION,
                snapshot_version=_task_snapshot(marketplace_item),
                brief_version=1,
                terms_version=terms.version,
                title=task.title,
                customer=CustomerSummary(
                    id=task.aggregate.customer_id,
                    display_name=customer_name,
                    verification=customer_verification,
                ),
                brief_summary=task.aggregate.brief.problem or "Описание не указано заказчиком.",
                competency_tags=task.competency_tags,
                difficulty=task.catalog.difficulty,
                duration_minutes=task.catalog.duration_minutes,
                work_format=task.catalog.work_format,
                places_total=task.places,
                places_available=max(0, task.places - assigned_count),
                deadline_at=terms.deadline_at,
                eligibility=eligibility,
                match=match,
                skill_impact=impacts,
                stage_plan=plan,
                benefits=_benefits(marketplace_item, terms_source),
                application_state=state,
                allowed_actions=_actions(state, eligibility),
                sources=(brief_source, terms_source),
                generated_at=now,
                bookmarked=task_id in bookmarks,
                application_id=application.id if application is not None else None,
                assignment_id=assignment.id if assignment is not None else None,
                direction_keys=task.catalog.direction_keys,
                weekly_workload_minutes=task.catalog.weekly_workload_minutes,
                created_at=task.created_at,
                support_model=terms.support_mode or None,
            )
            terms_snapshot = TaskTermsSnapshot(
                task_id=task_id,
                terms_version=terms.version,
                brief_version=1,
                deliverable=terms.deliverable or "not_provided",
                prerequisites=task.catalog.prerequisite_tags,
                selection_criteria=task.catalog.selection_criteria,
                support_model=terms.support_mode or "not_provided",
                ip_terms=task.aggregate.brief.ip_terms or "not_provided",
                portfolio_permission=task.catalog.portfolio_permission,
                paid=terms.compensation.paid,
                payout_condition=terms.compensation.payout_condition,
                deadline_at=terms.deadline_at,
                data_constraints=task.aggregate.brief.data_constraints or None,
                acceptance_criteria=terms.acceptance_criteria,
            )
            result.append((projection, terms_snapshot))
        return tuple(result)

    async def projections(self, actor: ActorContext) -> tuple[TaskRecommendationProjection, ...]:
        return tuple(item for item, _terms in await self._build(actor))

    async def pairs(
        self, actor: ActorContext
    ) -> tuple[tuple[TaskRecommendationProjection, TaskTermsSnapshot], ...]:
        return await self._build(actor)


__all__ = [
    "ALGORITHM_VERSION",
    "EVIDENCE_FRESHNESS_DAYS",
    "FORMAT_FIT",
    "GROWTH_FIT",
    "MINIMUM_COVERAGE",
    "ROLE_REQUIREMENTS",
    "VERIFIED_COMPETENCIES",
    "FactorScore",
    "FactorValue",
    "MatchingContext",
    "TaskCatalogProjectionService",
    "calculate_task_match",
    "fresh_verified_tags",
    "matching_context",
    "score_factors",
]
