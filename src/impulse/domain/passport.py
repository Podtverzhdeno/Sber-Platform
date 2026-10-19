"""Skill Passport gap projection for the next-result card (openspec 22.2).

Правила честного passport gap:
- уровень навыка меняется только от проверенных (counted) источников; projections
  никогда не обещают повышение выше того, что подтверждено evidence;
- недостающие источники выводятся из фреймворка (evidence_sources), а не из
  чьих-то обещаний;
- когда подходящей задачи нет — карта говорит это прямо через fallback
  и не подменяет накопление доказательств другими словами.
"""

from __future__ import annotations

from dataclasses import dataclass

UNKNOWN_LEVEL = "не подтверждено"

"""Canonical label for a competency that has no verified anchors yet."""

SKILL_GAP_POLICY_VERSION = 1
"""Version of the passport gap calculation contract."""

FALLBACK_NO_FRAMEWORK = (
    "Навык не привязан к проверяемому фреймворку компетенций: уровень не "
    "подтверждается и повышение недоступно."
)
FALLBACK_NO_COVERING_STEP = (
    "Подходящего проекта или checkpoint для недостающего источника нет в "
    "активной траектории: уровень не повышается — нужно накопление evidence."
)
FALLBACK_TARGET_REACHED = "Навык уже на целевом уровне: следующий шаг закрепляет его в портфолио."


@dataclass(frozen=True, slots=True)
class PassportSkillFacts:
    """Everything needed to project one competency's honest gap."""

    key: str
    title: str
    evidence_sources: tuple[tuple[str, str], ...]
    counted: tuple[tuple[str, str], ...]
    excluded: tuple[tuple[str, str], ...]
    level: str


@dataclass(frozen=True, slots=True)
class SkillGapProjection:
    """Data-driven «Следующий результат» fields (openspec 22.2)."""

    policy_version: int
    skill_key: str | None
    """Framework key of the matched skill, None when the plan skill has no framework model."""

    title: str
    requested_skill: str
    current_level: str
    target_level: str
    current_known: bool
    counted_sources: tuple[tuple[str, str], ...]
    missing_evidence: tuple[tuple[str, str], ...]
    explanation: str
    fallback: str | None
    candidate_step: tuple[str, str, str] | None
    """(target_kind, target_key, target_title) of the next step, None when unavailable."""

    candidate_closes_gap: bool
    """Whether the candidate step's source satisfies one of the missing evidence rules."""


def source_ref_matches(pattern: str, value: str) -> bool:
    """Same rule the framework uses to count anchors: exact ref or `prefix*`."""
    if pattern.endswith("*"):
        return value.startswith(pattern[:-1])
    return pattern == value


def _match_skill(
    requested: str, candidates: tuple[PassportSkillFacts, ...]
) -> PassportSkillFacts | None:
    wanted = requested.casefold()
    exact = [item for item in candidates if item.key == requested]
    if exact:
        return sorted(exact, key=lambda item: item.key)[0]
    by_title = [item for item in candidates if item.title.casefold() == wanted]
    if by_title:
        return sorted(by_title, key=lambda item: item.key)[0]
    return None


def _pair_strings(values: tuple[tuple[str, str], ...]) -> tuple[str, ...]:
    return tuple(f"{kind}:{ref}" for kind, ref in sorted(values))


def _cover_step(
    missing: tuple[tuple[str, str], ...],
    candidate_step: tuple[str, str, str] | None,
) -> tuple[bool, tuple[str, str] | None]:
    if not missing or candidate_step is None:
        return False, None
    step_kind, step_ref, _ = candidate_step
    for kind, ref in missing:
        if kind == step_kind and source_ref_matches(ref, step_ref):
            return True, (kind, ref)
    return False, None


def _explanation(
    fact: PassportSkillFacts,
    target_level: str,
    missing: tuple[tuple[str, str], ...],
) -> str:
    if not fact.counted:
        return (
            f"Навык «{fact.title}» не подтверждён проверенными источниками: уровень "
            f"останется «{UNKNOWN_LEVEL}», пока evidence не пройдёт проверку."
        )
    base = (
        f"Уровень «{fact.level}» подтверждён источниками "
        + "; ".join(_pair_strings(fact.counted))
        + "."
    )
    if missing:
        return (
            base
            + f" До целевого уровня «{target_level}» нужны источники: "
            + ", ".join(_pair_strings(missing))
            + "."
        )
    if fact.level == target_level:
        return base + f" Целевой уровень «{target_level}» достигнут."
    return (
        base + " Все заявленные во фреймворке источники уже проверены: законных "
        "случаев повышения уровня больше нет."
    )


def skill_passport_gap(
    *,
    requested_skill: str,
    target_level: str,
    target_rank: int,
    candidates: tuple[PassportSkillFacts, ...],
    candidate_step: tuple[str, str, str] | None,
) -> SkillGapProjection:
    """Build the honest passport gap projection for one roadmap skill."""
    fact = _match_skill(requested_skill, candidates)
    if fact is None:
        return SkillGapProjection(
            policy_version=SKILL_GAP_POLICY_VERSION,
            skill_key=None,
            title=requested_skill,
            requested_skill=requested_skill,
            current_level=UNKNOWN_LEVEL,
            target_level=target_level,
            current_known=False,
            counted_sources=(),
            missing_evidence=(),
            explanation=(
                f"Навык «{requested_skill}» отсутствует во фреймворке компетенций: "
                "карта не может обещать повышение уровня."
            ),
            fallback=FALLBACK_NO_FRAMEWORK,
            candidate_step=candidate_step,
            candidate_closes_gap=False,
        )
    counted = tuple(dict.fromkeys(fact.counted))
    missing = tuple(
        (kind, ref) for kind, ref in fact.evidence_sources if (kind, ref) not in counted
    )
    closes_gap, covering = _cover_step(missing, candidate_step)
    if fact.level == target_level:
        fallback = (
            FALLBACK_TARGET_REACHED if candidate_step is not None else FALLBACK_NO_COVERING_STEP
        )
    elif candidate_step is None:
        fallback = FALLBACK_NO_COVERING_STEP
    elif closes_gap:
        fallback = None
    else:
        fallback = FALLBACK_NO_COVERING_STEP
    explanation = _explanation(fact, target_level, missing)
    if candidate_step is not None and closes_gap:
        assert covering is not None
        step_kind, step_ref, step_title = candidate_step
        explanation += (
            f" Шаг «{step_kind}:{step_ref} ({step_title})» закрывает требуемый "
            f"источник {covering[0]}:{covering[1]}, после проверки уровень может "
            "повыситься."
        )
    elif candidate_step is not None and fact.level != target_level:
        step_kind, step_ref, step_title = candidate_step
        explanation += (
            f" Выбран шаг «{step_kind}:{step_ref} ({step_title})», но он не закрывает "
            "недостающие источники — карта не обещает повышение уровня."
        )
    return SkillGapProjection(
        policy_version=SKILL_GAP_POLICY_VERSION,
        skill_key=fact.key,
        title=fact.title,
        requested_skill=requested_skill,
        current_level=fact.level,
        target_level=target_level,
        current_known=fact.level != UNKNOWN_LEVEL,
        counted_sources=counted,
        missing_evidence=missing,
        explanation=explanation,
        fallback=fallback,
        candidate_step=candidate_step,
        candidate_closes_gap=closes_gap,
    )


__all__ = [
    "FALLBACK_NO_COVERING_STEP",
    "FALLBACK_NO_FRAMEWORK",
    "FALLBACK_TARGET_REACHED",
    "SKILL_GAP_POLICY_VERSION",
    "UNKNOWN_LEVEL",
    "PassportSkillFacts",
    "SkillGapProjection",
    "skill_passport_gap",
    "source_ref_matches",
]
