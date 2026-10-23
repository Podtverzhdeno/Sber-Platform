"""Policy-neutral contracts for the participant task recommendation catalog.

The module deliberately contains no matching weights, legal defaults or database
access.  It is the single application-level projection that cards, list rows and
permitted detail will serialize once the endpoint is wired.  Operational
assignment/checkpoint progress stays in the work domain and is not representable
as a catalog stage-plan state.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

TASK_CATALOG_SCHEMA_VERSION = 1


class CatalogContractError(ValueError):
    """Raised when a projection would make a misleading catalog claim."""


class EligibilityStatus(StrEnum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    UNKNOWN = "unknown"


class MatchStatus(StrEnum):
    CALCULATED = "calculated"
    INSUFFICIENT_DATA = "insufficient_data"
    NOT_APPLICABLE = "not_applicable"


class ForecastStatus(StrEnum):
    CALCULATED = "calculated"
    QUALITATIVE = "qualitative"
    INSUFFICIENT_DATA = "insufficient_data"


class ApplicationState(StrEnum):
    NONE = "none"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    ASSIGNED = "assigned"
    CLOSED = "closed"
    UNAVAILABLE = "unavailable"


class CustomerVerification(StrEnum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    DEMO = "demo"


class StagePlanState(StrEnum):
    PLANNED = "planned"
    LOCKED = "locked"


class BenefitState(StrEnum):
    POTENTIAL = "potential"
    ACTUAL = "actual"
    UNAVAILABLE = "unavailable"


class CatalogAction(StrEnum):
    OPEN_CONDITIONS = "open_conditions"
    APPLY = "apply"
    WITHDRAW = "withdraw"
    OPEN_APPLICATION = "open_application"
    OPEN_WORKSPACE = "open_workspace"
    BOOKMARK = "bookmark"
    SHARE = "share"


@dataclass(frozen=True, slots=True)
class ProjectionSource:
    """Permitted provenance pointer; never contains raw evidence text or URLs."""

    kind: str
    ref: str
    version: str
    observed_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.kind.strip() or not self.ref.strip() or not self.version.strip():
            raise CatalogContractError("Projection source requires kind, ref and version.")


@dataclass(frozen=True, slots=True)
class CustomerSummary:
    id: UUID
    display_name: str
    verification: CustomerVerification

    def __post_init__(self) -> None:
        if not self.display_name.strip():
            raise CatalogContractError("Permitted customer display name must not be blank.")


@dataclass(frozen=True, slots=True)
class EligibilityProjection:
    status: EligibilityStatus
    reason_codes: tuple[str, ...]
    missing_prerequisites: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.status is not EligibilityStatus.ELIGIBLE and not self.reason_codes:
            raise CatalogContractError("Limited eligibility requires an explainable reason code.")


@dataclass(frozen=True, slots=True)
class MatchReason:
    code: str
    label: str
    source_refs: tuple[ProjectionSource, ...] = ()

    def __post_init__(self) -> None:
        if not self.code.strip() or not self.label.strip():
            raise CatalogContractError("Match reason requires a stable code and readable label.")


@dataclass(frozen=True, slots=True)
class MatchProjection:
    status: MatchStatus
    percent: Decimal | None
    coverage: Decimal
    algorithm_version: str | None
    source_snapshot_version: str
    calculated_at: datetime
    reasons: tuple[MatchReason, ...] = ()
    missing_factors: tuple[str, ...] = ()
    growth_fit_percent: Decimal | None = None

    def __post_init__(self) -> None:
        if not Decimal("0") <= self.coverage <= Decimal("1"):
            raise CatalogContractError("Match coverage must be within 0..1.")
        if self.growth_fit_percent is not None and not (
            Decimal("0") <= self.growth_fit_percent <= Decimal("100")
        ):
            raise CatalogContractError("Growth fit percent must be within 0..100.")
        if not self.source_snapshot_version.strip():
            raise CatalogContractError("Match source snapshot version is required.")
        if self.status is MatchStatus.CALCULATED:
            if self.percent is None or not Decimal("0") <= self.percent <= Decimal("100"):
                raise CatalogContractError("Calculated match requires percent within 0..100.")
            if not self.algorithm_version or not self.algorithm_version.strip():
                raise CatalogContractError("Calculated match requires an algorithm version.")
            if not self.reasons:
                raise CatalogContractError("Calculated match requires structured reasons.")
        elif self.percent is not None:
            raise CatalogContractError("Non-calculated match must not serialize a numeric score.")


@dataclass(frozen=True, slots=True)
class SkillImpactProjection:
    skill_id: str
    title: str
    status: ForecastStatus
    current_level: str | None
    projected_level: str | None
    model_version: str | None
    explanation: str
    verification_required: bool = True
    sources: tuple[ProjectionSource, ...] = ()

    def __post_init__(self) -> None:
        if not self.skill_id.strip() or not self.title.strip() or not self.explanation.strip():
            raise CatalogContractError("Skill impact requires identity, title and explanation.")
        if not self.verification_required:
            raise CatalogContractError("Catalog skill impact must remain verification-required.")
        if self.status is ForecastStatus.CALCULATED:
            if not self.current_level or not self.projected_level or not self.model_version:
                raise CatalogContractError(
                    "Calculated skill impact requires current/projected levels and model version."
                )
        elif self.projected_level is not None:
            raise CatalogContractError(
                "A non-calculated skill impact must not expose a numeric/level forecast."
            )


@dataclass(frozen=True, slots=True)
class StagePlanItem:
    key: str
    position: int
    title: str
    summary: str
    estimated_minutes: int | None
    state: StagePlanState
    prerequisite_keys: tuple[str, ...] = ()
    expected_evidence: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.key.strip() or not self.title.strip() or not self.summary.strip():
            raise CatalogContractError("Plan stage requires key, title and summary.")
        if self.position < 1:
            raise CatalogContractError("Plan stage position starts at one.")
        if self.estimated_minutes is not None and self.estimated_minutes < 1:
            raise CatalogContractError("Known stage duration must be positive.")


@dataclass(frozen=True, slots=True)
class StagePlanProjection:
    version: int
    stages: tuple[StagePlanItem, ...]

    def __post_init__(self) -> None:
        if self.version < 1:
            raise CatalogContractError("Stage plan version must be positive.")
        keys = [stage.key for stage in self.stages]
        positions = [stage.position for stage in self.stages]
        if len(keys) != len(set(keys)):
            raise CatalogContractError("Stage plan keys must be unique.")
        if positions != list(range(1, len(positions) + 1)):
            raise CatalogContractError("Stage plan must be ordered with contiguous positions.")
        known = set(keys)
        if any(not set(stage.prerequisite_keys).issubset(known) for stage in self.stages):
            raise CatalogContractError("Stage prerequisite must reference this plan.")
        positions_by_key = {stage.key: stage.position for stage in self.stages}
        if any(
            positions_by_key[prerequisite] >= stage.position
            for stage in self.stages
            for prerequisite in stage.prerequisite_keys
        ):
            raise CatalogContractError("Stage prerequisite must precede its dependent stage.")


@dataclass(frozen=True, slots=True)
class BenefitEligibilityRule:
    """Structured eligibility rule behind a conditional benefit (TC-014).

    ``rule_kind`` carries the machine-meaningful gate: ``ALWAYS`` benefit is
    granted unconditionally, ``CONDITIONAL`` reads the human rule, requires
    verified evidence, and holds only while an INVITATION gate is open.
    """

    rule_kind: str
    condition: str
    evidence_refs: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.rule_kind not in (
            "always",
            "conditional",
            "evidence_required",
            "invitation_required",
        ):
            raise CatalogContractError(
                "Benefit rule kind must be always, conditional, evidence_required "
                "or invitation_required."
            )
        if not self.condition.strip():
            raise CatalogContractError("Benefit rule requires an explicit condition.")
        if self.rule_kind == "evidence_required" and not self.evidence_refs:
            raise CatalogContractError("Evidence-backed benefit rule must reference evidence.")


@dataclass(frozen=True, slots=True)
class ConditionalBenefit:
    code: str
    label: str
    state: BenefitState
    condition: str
    sources: tuple[ProjectionSource, ...]
    benefit_type: str = "other"
    eligibility: BenefitEligibilityRule | None = None

    def __post_init__(self) -> None:
        if not self.code.strip() or not self.label.strip() or not self.condition.strip():
            raise CatalogContractError("Benefit requires code, label and explicit condition.")
        if not self.sources:
            raise CatalogContractError("Benefit must be backed by an authoritative source.")
        if self.benefit_type not in (
            "compensation",
            "learning",
            "support",
            "portfolio",
            "mentorship",
            "other",
        ):
            raise CatalogContractError(
                "Benefit type must be compensation, learning, support, portfolio, "
                "mentorship or other."
            )


@dataclass(frozen=True, slots=True)
class TaskRecommendationProjection:
    """One immutable payload family for card, list row and permitted detail."""

    task_id: UUID
    schema_version: int
    snapshot_version: str
    brief_version: int
    terms_version: int
    title: str
    customer: CustomerSummary
    brief_summary: str
    competency_tags: tuple[str, ...]
    difficulty: str | None
    duration_minutes: int | None
    work_format: str | None
    places_total: int
    places_available: int | None
    deadline_at: datetime | None
    eligibility: EligibilityProjection
    match: MatchProjection
    skill_impact: tuple[SkillImpactProjection, ...]
    stage_plan: StagePlanProjection
    benefits: tuple[ConditionalBenefit, ...]
    application_state: ApplicationState
    allowed_actions: frozenset[CatalogAction]
    sources: tuple[ProjectionSource, ...]
    generated_at: datetime
    bookmarked: bool = False
    application_id: UUID | None = None
    assignment_id: UUID | None = None
    direction_keys: tuple[str, ...] = ()
    weekly_workload_minutes: int | None = None
    created_at: datetime | None = None
    support_model: str | None = None

    def __post_init__(self) -> None:
        if self.schema_version != TASK_CATALOG_SCHEMA_VERSION:
            raise CatalogContractError("Unsupported task catalog schema version.")
        if not self.snapshot_version.strip():
            raise CatalogContractError("Catalog snapshot version is required.")
        if self.brief_version < 1 or self.terms_version < 1:
            raise CatalogContractError("Brief and terms versions must be positive.")
        if not self.title.strip() or not self.brief_summary.strip():
            raise CatalogContractError("Task title and permitted brief summary are required.")
        if self.duration_minutes is not None and self.duration_minutes < 1:
            raise CatalogContractError("Known task duration must be positive.")
        if self.weekly_workload_minutes is not None and self.weekly_workload_minutes < 1:
            raise CatalogContractError("Known weekly workload must be positive.")
        if self.places_total < 1:
            raise CatalogContractError("Published task must have at least one place.")
        if (
            self.places_available is not None
            and not 0 <= self.places_available <= self.places_total
        ):
            raise CatalogContractError("Available places must fit within total places.")
        if not self.sources:
            raise CatalogContractError("Catalog task must expose permitted provenance.")
        if (
            self.eligibility.status is not EligibilityStatus.ELIGIBLE
            and CatalogAction.APPLY in self.allowed_actions
        ):
            raise CatalogContractError("Ineligible or unknown task cannot expose apply action.")
        if (
            self.application_state is ApplicationState.ASSIGNED
            and CatalogAction.OPEN_WORKSPACE not in self.allowed_actions
        ):
            raise CatalogContractError("Assigned task must expose its canonical workspace action.")

    @property
    def stable_tie_breaker(self) -> str:
        """Deterministic final ordering key; ranking policy remains separately versioned."""

        return str(self.task_id)
