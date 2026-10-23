"""Published course detail projection for Bootcamp V2 (BC2-104).

Pure join of one published course version with trusted reviews.  The detail is
a strict extension of exactly one course version: modules, outcome, evidence
requirements and prerequisites come from the same published snapshot, and the
participant-facing next checkpoint is derived from that version's module order.
No readiness or eligibility logic lives here.
"""

from __future__ import annotations

from dataclasses import dataclass

from impulse.bootcamp.overview import DataOrigin, KnowledgeState, VersionedFact


@dataclass(frozen=True, slots=True)
class PublishedModule:
    key: str
    title: str
    position: int
    checkpoint_key: str | None = None

    def __post_init__(self) -> None:
        if not self.key.strip() or not self.title.strip():
            raise ValueError("Published module requires a key and a title")
        if self.position < 0:
            raise ValueError("Published module position must be non-negative")
        if self.checkpoint_key is not None and not self.checkpoint_key.strip():
            raise ValueError("A module checkpoint reference must be a non-blank key")


@dataclass(frozen=True, slots=True)
class PublishedEvidenceRequirement:
    key: str
    title: str
    description: str

    def __post_init__(self) -> None:
        required = (self.key, self.title, self.description)
        if any(not value.strip() for value in required):
            raise ValueError("Evidence requirements need key, title and description")


@dataclass(frozen=True, slots=True)
class PublishedPrerequisite:
    course_key: str
    title: str

    def __post_init__(self) -> None:
        if not self.course_key.strip() or not self.title.strip():
            raise ValueError("Prerequisites require a course key and a title")


@dataclass(frozen=True, slots=True)
class PublishedCourseVersion:
    """The authoritative published snapshot of exactly one course version."""

    course_key: str
    title: str
    course_version: str
    modules: tuple[PublishedModule, ...]
    outcome: str
    evidence_requirements: tuple[PublishedEvidenceRequirement, ...]
    prerequisites: tuple[PublishedPrerequisite, ...]
    provenance: VersionedFact

    def __post_init__(self) -> None:
        identity = (self.course_key, self.title, self.course_version)
        if any(not value.strip() for value in identity):
            raise ValueError("Published course version requires key, title and version")
        if self.provenance.data_origin is not DataOrigin.PRODUCTION:
            raise ValueError("Published course content must be production data")
        keys = [module.key for module in self.modules]
        if len(keys) != len(set(keys)):
            raise ValueError("Module keys must be unique within one course version")
        positions = [module.position for module in self.modules]
        if positions != sorted(positions) or len(positions) != len(set(positions)):
            raise ValueError("Module positions must be unique and ordered within one version")


@dataclass(frozen=True, slots=True)
class TrustedReview:
    author_role: str
    verdict: str
    comment: str
    provenance: VersionedFact

    def __post_init__(self) -> None:
        allowed = {"позитивный", "нейтральный", "критический"}
        if not self.author_role.strip():
            raise ValueError("A trusted review needs an author role")
        if self.verdict.strip().lower() not in allowed:
            raise ValueError("Review verdicts must be positive, neutral or critical")
        if not self.comment.strip():
            raise ValueError("A trusted review needs a factual comment summary")
        if self.provenance.data_origin is not DataOrigin.PRODUCTION:
            raise ValueError("Trusted reviews must be production data")


@dataclass(frozen=True, slots=True)
class CourseDetail:
    """Detail surface for one course version; unknown state keeps it honest."""

    state: KnowledgeState
    course_key: str | None
    title: str | None
    course_version: str | None
    outcome: str | None
    modules: tuple[PublishedModule, ...]
    next_checkpoint_key: str | None
    next_checkpoint_note: str | None
    evidence_requirements: tuple[PublishedEvidenceRequirement, ...]
    prerequisites: tuple[PublishedPrerequisite, ...]
    reviews: tuple[TrustedReview, ...]
    reviews_unavailable_reason: str | None
    provenance: VersionedFact | None
    unavailable_reason: str | None

    def __post_init__(self) -> None:
        if self.state is KnowledgeState.KNOWN:
            identity = (self.course_key, self.title, self.course_version, self.outcome)
            if any(value is None or not value.strip() for value in identity):
                raise ValueError("Known course detail requires identity and outcome")
            if self.provenance is None:
                raise ValueError("Known course detail requires version provenance")
            if self.unavailable_reason is not None:
                raise ValueError("Known course detail cannot carry an unavailable reason")
        else:
            published = (
                self.course_key,
                self.title,
                self.course_version,
                self.outcome,
                self.provenance,
            )
            if any(value is not None for value in published):
                raise ValueError("Unknown course detail cannot publish partial content")
            if self.modules or self.evidence_requirements or self.prerequisites:
                raise ValueError("Unknown course detail cannot publish partial content")
            if self.unavailable_reason is None or not self.unavailable_reason.strip():
                raise ValueError("Unknown course detail requires an explicit reason")
        if self.next_checkpoint_note is not None and self.next_checkpoint_key is not None:
            raise ValueError("A pending checkpoint and an all-done note cannot be present together")
        if self.reviews and self.reviews_unavailable_reason is not None:
            raise ValueError("Reviews present but a reviews-unavailable reason is set")


def build_course_detail(
    course_version: PublishedCourseVersion | None,
    *,
    reviews: tuple[TrustedReview, ...] = (),
    completed_checkpoint_keys: frozenset[str] = frozenset(),
    completed_all_note: str = "Все опубликованные чекпоинты курса пройдены.",
    unavailable_reason: str = "Детали курса не для текущего снимка.",
) -> CourseDetail:
    """Join one published version with trusted reviews; nothing is invented.

    ``course_version=None`` or participant-freshness mismatch degrade to an
    explicit not-evaluable detail instead of a fabricated empty structure.
    """

    if course_version is None:
        return CourseDetail(
            state=KnowledgeState.NOT_EVALUABLE,
            course_key=None,
            title=None,
            course_version=None,
            outcome=None,
            modules=(),
            next_checkpoint_key=None,
            next_checkpoint_note=None,
            evidence_requirements=(),
            prerequisites=(),
            reviews=(),
            reviews_unavailable_reason=None,
            provenance=None,
            unavailable_reason=unavailable_reason,
        )
    next_checkpoint = _resolve_next_checkpoint(course_version.modules, completed_checkpoint_keys)
    if next_checkpoint is not None:
        checkpoint_note: str | None = None
    elif _has_any_checkpoint(course_version.modules):
        checkpoint_note = completed_all_note
    else:
        checkpoint_note = None
    return CourseDetail(
        state=KnowledgeState.KNOWN,
        course_key=course_version.course_key,
        title=course_version.title,
        course_version=course_version.course_version,
        outcome=course_version.outcome,
        modules=course_version.modules,
        next_checkpoint_key=next_checkpoint,
        next_checkpoint_note=checkpoint_note,
        evidence_requirements=course_version.evidence_requirements,
        prerequisites=course_version.prerequisites,
        reviews=reviews,
        reviews_unavailable_reason="Отзывы о курсе ещё не собираются." if not reviews else None,
        provenance=course_version.provenance,
        unavailable_reason=None,
    )


def _has_any_checkpoint(modules: tuple[PublishedModule, ...]) -> bool:
    return any(module.checkpoint_key is not None for module in modules)


def _resolve_next_checkpoint(
    modules: tuple[PublishedModule, ...],
    completed: frozenset[str],
) -> str | None:
    for module in modules:
        checkpoint = module.checkpoint_key
        if checkpoint is not None and checkpoint not in completed:
            return checkpoint
    return None


__all__ = [
    "CourseDetail",
    "PublishedCourseVersion",
    "PublishedEvidenceRequirement",
    "PublishedModule",
    "PublishedPrerequisite",
    "TrustedReview",
    "build_course_detail",
]
