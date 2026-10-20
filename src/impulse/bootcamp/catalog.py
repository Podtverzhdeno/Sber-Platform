"""Pure Bootcamp catalog projection used by cards, filters and API views.

Each course card reports independent measurements (openspec 22.15 / 22.15):

- access state — can the participant start the course right now;
- completion state — not started / reported (pending verification) /
  verified / rejected;
- recommendation state — «Надо пройти» with an explainable reason.

One badge never substitutes for another. Relevance of the «Актуальные» filter
is a separate boolean with one explainable reason per included factor.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

from impulse.domain.development import CompletionStatus

ACCESS_AVAILABLE = "available"
ACCESS_UNAVAILABLE = "unavailable"
ACCESS_PREREQUISITE = "prerequisite_not_met"

COMPLETION_NOT_STARTED = "not_started"
COMPLETION_PENDING = "reported"
COMPLETION_VERIFIED = "verified"
COMPLETION_REJECTED = "rejected"

TARGET_LEVEL_LABEL = "уверенный"

#: Published sequencing rules mirroring the program prerequisites of the catalog.
PREREQUISITE_RULES: dict[str, tuple[str, ...]] = {
    "agent-development": ("openspec-sdd",),
}


class CourseRecordLike(Protocol):
    @property
    def key(self) -> str: ...

    @property
    def title(self) -> str: ...

    @property
    def track_keys(self) -> tuple[str, ...]: ...

    @property
    def source_url(self) -> str: ...

    @property
    def availability(self) -> str: ...

    @property
    def access_note(self) -> str: ...


class RoadmapMilestoneLike(Protocol):
    @property
    def key(self) -> str: ...

    @property
    def position(self) -> int: ...

    @property
    def title(self) -> str: ...

    @property
    def purpose(self) -> str: ...

    @property
    def skill(self) -> str: ...

    @property
    def target_kind(self) -> str: ...

    @property
    def target_key(self) -> str: ...


def prerequisite_keys(course_key: str) -> tuple[str, ...]:
    """Published prerequisites of a course; empty when the course has none."""
    return PREREQUISITE_RULES.get(course_key, ())


@dataclass(frozen=True, slots=True)
class SkillPosition:
    """Known current position for one skill from the Skill Passport projection."""

    skill_key: str
    title: str
    current_level: str
    target_level: str = TARGET_LEVEL_LABEL
    known: bool = True


@dataclass(frozen=True, slots=True)
class MilestoneOnTrajectory:
    """Roadmap checkpoint that targets a course on an active trajectory."""

    milestone: RoadmapMilestoneLike
    track_key: str
    track_title: str
    completed: bool


@dataclass(frozen=True, slots=True)
class MustTakeReason:
    """Explainable «Надо пройти» reason naming skill, levels and projected impact."""

    skill: str
    current_level: str | None
    target_level: str | None
    current_known: bool
    projected_impact: str
    explanation: str


@dataclass(frozen=True, slots=True)
class Relevance:
    """Inclusion of the «Актуальные» filter with an explainable reason per factor."""

    relevant: bool
    reasons: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CourseCard:
    """State projection for one catalog card; the dimensions stay independent."""

    key: str
    title: str
    track_keys: tuple[str, ...]
    source_url: str
    access_state: str
    access_note: str
    completion_state: str
    relevant: bool
    relevance_reasons: tuple[str, ...]
    must_take: MustTakeReason | None
    pending_verification_note: str | None
    verified_evidence: str | None
    recommendation_reason: str


def determine_access_state(
    course: CourseRecordLike,
    *,
    verified_courses: frozenset[str],
) -> str:
    """Resolve the independent access dimension.

    Unavailable external courses stay closed with their source metadata; a
    course with an unmet prerequisite reports the missing prerequisite instead
    of promising enrollment.
    """
    if course.availability != ACCESS_AVAILABLE:
        return ACCESS_UNAVAILABLE
    for prerequisite in prerequisite_keys(course.key):
        if prerequisite not in verified_courses:
            return ACCESS_PREREQUISITE
    return ACCESS_AVAILABLE


def access_note_for(
    course: CourseRecordLike,
    access_state: str,
    titles: Mapping[str, str],
) -> str:
    """Honest limitation note: name the prerequisite, never promise enrollment."""
    if access_state == ACCESS_PREREQUISITE:
        prerequisite_titles = [titles.get(key, key) for key in prerequisite_keys(course.key)]
        missing = ", ".join(prerequisite_titles)
        return (
            f"Требуется подтверждённый prerequisite: {missing}. "
            "Зачисление не обещается, пока проверка не завершена."
        )
    return course.access_note


def completion_state_for(
    course_key: str,
    *,
    enrollment_status: CompletionStatus | None,
    verified_courses: frozenset[str],
) -> str:
    if course_key in verified_courses:
        return COMPLETION_VERIFIED
    if enrollment_status is None:
        return COMPLETION_NOT_STARTED
    return enrollment_status.value


def _skill_position(
    skill_label: str, skill_positions: Mapping[str, SkillPosition]
) -> SkillPosition | None:
    lowered = skill_label.strip().lower()
    for position in skill_positions.values():
        if position.title.strip().lower() == lowered or position.skill_key == lowered:
            return position
    return None


def _must_take_for(
    milestones: tuple[MilestoneOnTrajectory, ...],
    skill_positions: Mapping[str, SkillPosition],
) -> MustTakeReason | None:
    """Explain «Надо пройти»: name the skill, current/target level and the fragment."""
    open_milestone = next((item for item in milestones if not item.completed), None)
    if open_milestone is None:
        return None
    skill_label = open_milestone.milestone.skill
    position = _skill_position(open_milestone.milestone.skill, skill_positions)
    if position is not None and position.known:
        return MustTakeReason(
            skill=skill_label,
            current_level=position.current_level,
            target_level=position.target_level,
            current_known=True,
            projected_impact=(
                f"Прогноз: курс ведёт к этапу «{open_milestone.milestone.title}» "
                f"траектории «{open_milestone.track_title}». Повышение применяется "
                "только после подтверждения checkpoint."
            ),
            explanation=(
                f"Закрывает пробел навыка «{skill_label}»: сейчас "
                f"«{position.current_level}», целевой уровень «{position.target_level}»."
            ),
        )
    return MustTakeReason(
        skill=skill_label,
        current_level=None,
        target_level=None,
        current_known=False,
        projected_impact=(
            f"Курс нужен для этапа «{open_milestone.milestone.title}» "
            f"траектории «{open_milestone.track_title}». Повышение применяется "
            "только после подтверждения checkpoint."
        ),
        explanation="Уровень навыка ещё не зафиксирован в Skill Passport.",
    )


def relevance_for(
    course: CourseRecordLike,
    milestones: tuple[MilestoneOnTrajectory, ...],
    *,
    access_state: str,
    completion_state: str,
) -> Relevance:
    """Keep every inclusion factor explicit; no factors — not relevant."""
    if not milestones:
        return Relevance(relevant=False, reasons=())
    reasons: list[str] = []
    tracks = sorted(set(item.track_key for item in milestones))
    reasons.append(
        f"Связан с активными направлениями: {', '.join(tracks)} "
        f"({', '.join(sorted(course.track_keys))})."
    )
    if any(not item.completed for item in milestones):
        reasons.append("Закрывает незакрытый пробел: этап маршрута ещё не подтверждён.")
    reasons.append(
        f"Этап маршрута: «{milestones[0].milestone.title}» · навык {milestones[0].milestone.skill}."
    )
    if access_state == ACCESS_AVAILABLE:
        reasons.append("Доступен сейчас в каталоге.")
    return Relevance(relevant=True, reasons=tuple(reasons))


def recommendation_reason_for(
    milestones: tuple[MilestoneOnTrajectory, ...],
    completion_state: str,
) -> str:
    """Explanation of the card suggestion without fake completion promises."""
    if not milestones:
        return "Общий курс каталога, не привязан к активной траектории."
    milestone = milestones[0].milestone
    if completion_state == COMPLETION_VERIFIED:
        return f"Этап «{milestone.title}» подтверждён: доказательство в карточке курсов."
    if completion_state == COMPLETION_PENDING:
        return f"Этап «{milestone.title}»: завершение отправлено на проверку."
    return f"Этап «{milestone.title}»: {milestone.purpose}"


def project_cards(
    courses: tuple[CourseRecordLike, ...],
    *,
    enrollment_status: Mapping[str, CompletionStatus | None],
    milestones_by_course: Mapping[str, tuple[MilestoneOnTrajectory, ...]],
    verified_courses: frozenset[str],
    skill_positions: Mapping[str, SkillPosition],
    titles: Mapping[str, str] | None = None,
) -> tuple[CourseCard, ...]:
    """Build every catalog card with independent access/completion/recommendation."""
    resolved_titles = {item.key: item.title for item in courses} if titles is None else titles
    cards: list[CourseCard] = []
    for course in courses:
        access_state = determine_access_state(course, verified_courses=verified_courses)
        access_note = access_note_for(course, access_state, resolved_titles)
        completion_state = completion_state_for(
            course.key,
            enrollment_status=enrollment_status.get(course.key),
            verified_courses=verified_courses,
        )
        milestones = milestones_by_course.get(course.key, ())
        relevance = relevance_for(
            course,
            milestones,
            access_state=access_state,
            completion_state=completion_state,
        )
        cards.append(
            CourseCard(
                key=course.key,
                title=course.title,
                track_keys=tuple(course.track_keys),
                source_url=course.source_url,
                access_state=access_state,
                access_note=access_note,
                completion_state=completion_state,
                relevant=relevance.relevant,
                relevance_reasons=relevance.reasons,
                must_take=(
                    _must_take_for(milestones, skill_positions)
                    if completion_state != COMPLETION_VERIFIED
                    else None
                ),
                pending_verification_note=(
                    "Завершение отправлено на проверку: повторно проходить тот же шаг "
                    "не нужно, прогноз применится только после подтверждения."
                    if completion_state == COMPLETION_PENDING
                    else None
                ),
                verified_evidence=verified_evidence_for(course.key)
                if completion_state is COMPLETION_VERIFIED
                else None,
                recommendation_reason=recommendation_reason_for(milestones, completion_state),
            )
        )
    return tuple(cards)


def verified_evidence_for(course_key: str) -> str:
    """Evidence provenance of a confirmed completion, never a participant claim."""
    return f"course:{course_key}"


__all__ = [
    "ACCESS_AVAILABLE",
    "ACCESS_PREREQUISITE",
    "ACCESS_UNAVAILABLE",
    "COMPLETION_NOT_STARTED",
    "COMPLETION_PENDING",
    "COMPLETION_REJECTED",
    "COMPLETION_VERIFIED",
    "PREREQUISITE_RULES",
    "TARGET_LEVEL_LABEL",
    "CompletionStatus",
    "CourseCard",
    "CourseRecordLike",
    "MilestoneOnTrajectory",
    "MustTakeReason",
    "Relevance",
    "RoadmapMilestoneLike",
    "SkillPosition",
    "access_note_for",
    "completion_state_for",
    "determine_access_state",
    "prerequisite_keys",
    "project_cards",
    "recommendation_reason_for",
    "relevance_for",
    "verified_evidence_for",
]
