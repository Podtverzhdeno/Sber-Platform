"""Immutable contracts for the participant Bootcamp V2 overview.

The module contains no persistence or demo fallback.  Application services compose
these records from the existing development, competency and career-grade owners.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from impulse.bootcamp.catalog import CourseCard, MustTakeReason

SCHEMA_VERSION = "2.0"


class DataOrigin(StrEnum):
    PRODUCTION = "production"
    DEMO_SEED = "demo_seed"
    TEST_FIXTURE = "test_fixture"


class TrackSelectionState(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    UNSELECTED = "unselected"


class KnowledgeState(StrEnum):
    KNOWN = "known"
    UNKNOWN = "unknown"
    NOT_EVALUABLE = "not_evaluable"


class RequirementKind(StrEnum):
    COURSE = "course"
    PROJECT = "project"
    CHECKPOINT = "checkpoint"
    COMPETENCY = "competency"
    EVIDENCE = "evidence"


class RequirementState(StrEnum):
    OPEN = "open"
    REPORTED = "reported"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REVOKED = "revoked"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class VersionedFact:
    """Version and freshness metadata for one authoritative source."""

    source: str
    version: str
    as_of: datetime
    data_origin: DataOrigin
    stale: bool = False
    stale_reason: str | None = None

    def __post_init__(self) -> None:
        if not self.source.strip() or not self.version.strip():
            raise ValueError("Versioned facts require non-empty source and version")
        if self.as_of.tzinfo is None or self.as_of.utcoffset() is None:
            raise ValueError("Versioned fact as_of must be timezone-aware")
        if self.stale != (self.stale_reason is not None):
            raise ValueError("A stale fact requires exactly one stale reason")


@dataclass(frozen=True, slots=True)
class RoleOption:
    track_key: str
    title: str
    state: TrackSelectionState
    roadmap: VersionedFact | None

    def __post_init__(self) -> None:
        if not self.track_key.strip() or not self.title.strip():
            raise ValueError("Role option requires key and title")


@dataclass(frozen=True, slots=True)
class ProgressMetric:
    """A known normalized metric; unknown values use ``None`` at the owner level."""

    numerator: int
    denominator: int
    percent: Decimal
    definition: str
    provenance: VersionedFact

    def __post_init__(self) -> None:
        if self.numerator < 0 or self.denominator <= 0 or self.numerator > self.denominator:
            raise ValueError("Progress requires 0 <= numerator <= denominator")
        expected = (Decimal(self.numerator) * Decimal(100)) / Decimal(self.denominator)
        if self.percent != expected:
            raise ValueError("Progress percent must be derived from numerator and denominator")
        if not self.definition.strip():
            raise ValueError("Progress metric requires its definition")


@dataclass(frozen=True, slots=True)
class RoleSummary:
    track_key: str
    grade_state: KnowledgeState
    current_grade_key: str | None
    current_grade_title: str | None
    target_grade_key: str | None
    target_grade_title: str | None
    matrix_skill_count: int | None
    readiness: ProgressMetric | None
    grade_policy: VersionedFact | None
    unavailable_reason: str | None

    def __post_init__(self) -> None:
        grade_values = (
            self.current_grade_key,
            self.current_grade_title,
            self.target_grade_key,
            self.target_grade_title,
        )
        if self.grade_state is KnowledgeState.KNOWN:
            if any(value is None or not value.strip() for value in grade_values):
                raise ValueError("Known grade state requires current and target grade identity")
            if self.grade_policy is None:
                raise ValueError("Known grade state requires published policy provenance")
            if self.unavailable_reason is not None:
                raise ValueError("Known grade state cannot have an unavailable reason")
        elif any(value is not None for value in grade_values):
            raise ValueError("Unknown/not-evaluable grade state cannot expose grade identities")
        elif self.unavailable_reason is None or not self.unavailable_reason.strip():
            raise ValueError("Unknown/not-evaluable grade state requires a reason")
        if self.matrix_skill_count is not None and self.matrix_skill_count < 0:
            raise ValueError("Matrix skill count cannot be negative")
        if self.grade_state is KnowledgeState.NOT_EVALUABLE and self.readiness is not None:
            raise ValueError("Readiness is unavailable without an evaluable grade policy")


@dataclass(frozen=True, slots=True)
class ContinueLearning:
    course_key: str
    checkpoint_key: str | None
    action: str
    reason_code: str
    progress: ProgressMetric | None
    deadline: datetime | None
    last_meaningful_activity_at: datetime | None
    selection_provenance: VersionedFact

    def __post_init__(self) -> None:
        if not self.course_key.strip() or not self.action.strip() or not self.reason_code.strip():
            raise ValueError("Continuation requires course, action and reason")
        for value in (self.deadline, self.last_meaningful_activity_at):
            if value is not None and (value.tzinfo is None or value.utcoffset() is None):
                raise ValueError("Continuation timestamps must be timezone-aware")


@dataclass(frozen=True, slots=True)
class CurriculumRequirement:
    key: str
    title: str
    kind: RequirementKind
    state: RequirementState
    source_key: str
    source_version: str
    allowed_action: str | None

    def __post_init__(self) -> None:
        required = (self.key, self.title, self.source_key, self.source_version)
        if any(not value.strip() for value in required):
            raise ValueError("Curriculum requirement identity and provenance are required")
        if self.state is RequirementState.VERIFIED and self.allowed_action is not None:
            raise ValueError("Verified requirement cannot expose a completion action")


@dataclass(frozen=True, slots=True)
class CurriculumRemainder:
    state: KnowledgeState
    current_grade_key: str | None
    target_grade_key: str | None
    policy_version: str | None
    curriculum_version: str | None
    requirements: tuple[CurriculumRequirement, ...]
    provenance: VersionedFact | None
    unavailable_reason: str | None

    def __post_init__(self) -> None:
        versioned = (
            self.current_grade_key,
            self.target_grade_key,
            self.policy_version,
            self.curriculum_version,
        )
        if self.state is KnowledgeState.KNOWN:
            if any(value is None or not value.strip() for value in versioned):
                raise ValueError("Known curriculum requires grade and version identity")
            if self.provenance is None:
                raise ValueError("Known curriculum requires provenance")
            if self.unavailable_reason is not None:
                raise ValueError("Known curriculum cannot have an unavailable reason")
            keys = [item.key for item in self.requirements]
            if len(keys) != len(set(keys)):
                raise ValueError("Curriculum requirement keys must be unique")
        else:
            if any(value is not None for value in versioned) or self.requirements:
                raise ValueError("Unknown curriculum cannot expose partial policy data")
            if self.provenance is not None:
                raise ValueError("Unknown curriculum cannot expose policy provenance")
            if self.unavailable_reason is None or not self.unavailable_reason.strip():
                raise ValueError("Unknown curriculum requires a reason")

    @property
    def remaining(self) -> tuple[CurriculumRequirement, ...]:
        return tuple(
            item for item in self.requirements if item.state is not RequirementState.VERIFIED
        )


@dataclass(frozen=True, slots=True)
class CourseRoleContext:
    """Role-scoped reasons for one canonical course identity."""

    track_key: str
    relevant: bool
    reasons: tuple[str, ...]
    must_take: MustTakeReason | None
    provenance: VersionedFact

    def __post_init__(self) -> None:
        if not self.track_key.strip():
            raise ValueError("Course role context requires a track key")
        if self.relevant and not self.reasons:
            raise ValueError("A relevant role context requires explainable reasons")
        if not self.relevant and (self.reasons or self.must_take is not None):
            raise ValueError("A non-relevant role context cannot expose recommendation facts")


@dataclass(frozen=True, slots=True)
class CourseSnapshot:
    card: CourseCard
    course_version: str
    access_policy_version: str
    freshness: VersionedFact
    enrollment_provenance: VersionedFact
    checkpoint_provenance: VersionedFact | None
    evidence_provenance: VersionedFact | None
    allowed_actions: tuple[str, ...]
    role_contexts: tuple[CourseRoleContext, ...]

    def __post_init__(self) -> None:
        if not self.course_version.strip() or not self.access_policy_version.strip():
            raise ValueError("Course and access-policy versions are required")
        if len(self.allowed_actions) != len(set(self.allowed_actions)):
            raise ValueError("Allowed course actions must be unique")
        if (
            self.card.relevant
            or self.card.relevance_reasons
            or self.card.must_take is not None
            or self.card.recommendation_reason
        ):
            raise ValueError("Overview CourseCard must be role-neutral; use CourseRoleContext")
        has_evidence = self.card.verified_evidence is not None
        if has_evidence != (self.evidence_provenance is not None):
            raise ValueError("Verified evidence and its provenance must appear together")
        context_keys = [item.track_key for item in self.role_contexts]
        if len(context_keys) != len(set(context_keys)):
            raise ValueError("Course role contexts must be unique per track")


@dataclass(frozen=True, slots=True)
class BootcampOverviewV2:
    schema_version: str
    snapshot_version: str
    as_of: datetime
    data_origin: DataOrigin
    selected_track_key: str
    roles: tuple[RoleOption, ...]
    continue_learning: ContinueLearning | None
    role_summary: RoleSummary
    curriculum: CurriculumRemainder
    courses: tuple[CourseSnapshot, ...]

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"Unsupported Bootcamp overview schema: {self.schema_version}")
        if not self.snapshot_version.strip():
            raise ValueError("Snapshot version is required")
        if self.as_of.tzinfo is None or self.as_of.utcoffset() is None:
            raise ValueError("Overview as_of must be timezone-aware")
        role_keys = [item.track_key for item in self.roles]
        if len(role_keys) != len(set(role_keys)):
            raise ValueError("Role keys must be unique")
        if self.selected_track_key not in role_keys:
            raise ValueError("Selected track must be present in role options")
        if self.role_summary.track_key != self.selected_track_key:
            raise ValueError("Role summary must belong to the selected track")
        course_keys = [item.card.key for item in self.courses]
        if len(course_keys) != len(set(course_keys)):
            raise ValueError("Each course identity must occur once in the overview")
        if (
            self.continue_learning is not None
            and self.continue_learning.course_key not in course_keys
        ):
            raise ValueError("Continuation course must be present in the overview")
        if self.data_origin is DataOrigin.PRODUCTION:
            facts: list[VersionedFact] = []
            facts.extend(role.roadmap for role in self.roles if role.roadmap is not None)
            if self.role_summary.grade_policy is not None:
                facts.append(self.role_summary.grade_policy)
            if self.role_summary.readiness is not None:
                facts.append(self.role_summary.readiness.provenance)
            if self.curriculum.provenance is not None:
                facts.append(self.curriculum.provenance)
            if self.continue_learning is not None and self.continue_learning.progress is not None:
                facts.append(self.continue_learning.progress.provenance)
            if self.continue_learning is not None:
                facts.append(self.continue_learning.selection_provenance)
            for course in self.courses:
                facts.append(course.freshness)
                facts.append(course.enrollment_provenance)
                if course.checkpoint_provenance is not None:
                    facts.append(course.checkpoint_provenance)
                if course.evidence_provenance is not None:
                    facts.append(course.evidence_provenance)
                facts.extend(context.provenance for context in course.role_contexts)
            if any(fact.data_origin is not DataOrigin.PRODUCTION for fact in facts):
                raise ValueError("Production overview cannot include non-production provenance")
        role_key_set = set(role_keys)
        if any(
            context.track_key not in role_key_set
            for course in self.courses
            for context in course.role_contexts
        ):
            raise ValueError("Course role contexts must reference overview roles")


__all__ = [
    "SCHEMA_VERSION",
    "BootcampOverviewV2",
    "ContinueLearning",
    "CourseRoleContext",
    "CourseSnapshot",
    "CurriculumRemainder",
    "CurriculumRequirement",
    "DataOrigin",
    "KnowledgeState",
    "ProgressMetric",
    "RequirementKind",
    "RequirementState",
    "RoleOption",
    "RoleSummary",
    "TrackSelectionState",
    "VersionedFact",
]
