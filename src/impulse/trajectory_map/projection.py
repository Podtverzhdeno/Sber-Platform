"""Versioned interactive trajectory map projection (openspec 24.1).

Политика карты траектории (TRAJECTORY_MAP_POLICY_VERSION=1):
- источник — опубликованная versioned roadmap (RoadmapProjection), а не
  frontend-константы; карта только читает дорожку и никогда не меняет
  прогресс: build-функции чистые и не имеют побочных эффектов;
- узел зафиксирован в состоянии `completed`, пока запись подтверждена;
  повторное выполнение не начисляет баллы (verified replay);
- обязательные checkpoints образуют цепочку: за шаг, который ещё не
  подтверждён и не заявлен, все следующие узлы получают `locked` с
  объяснением каждого блокирующего prerequisite; шаг «на проверке»
  (`submitted`) цепочку не блокирует, но и не добавляет баллов;
- первый неподтверждённый и незаявленный обязательный шаг становится
  `current` (auto-position), следующие незаблокированные — `available`;
- заявленный шаг открывает цепочку дальше: пока он на проверке, валидатор
  цепочки не блокирует последующие узлы (они остаются observation-only,
  баллы не начисляются); если заявлений нет вовсе, все шаги после
  первого строгого разрыва цепочки получают `locked` с объяснением
  каждого блокирующего prerequisite;
- необязательные (`mandatory=False`) checkpoints, идущие подряд с одним
  навыком, образуют развилку `branch` взаимозаменяемых вариантов:
  достаточно подтвердить один, остальные получают `skipped_by_rule`
  (даже если цепочка не дошла до них);
- одиночный необязательный checkpoint с выполненной цепочкой —
  `optional`;
- checkpoint курса со заявленным, но не подтверждённым завершением
  показывает `submitted` («На проверке»): баллы не начисляются.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from impulse.domain.development import CompletionStatus, RoadmapMilestone, RoadmapProjection
from impulse.domain.passport import SkillGapProjection

TRAJECTORY_MAP_POLICY_VERSION = 1
"""Version of the interactive map checkpoint-state policy."""

CHECKPOINT_POINTS = 20
"""Траектория прибавляет 20 баллов за подтверждённый checkpoint."""

POINTS_RULE = (
    "Checkpoint добавляет 20 баллов в траекторию после подтверждения evidence; "
    "итоговое начисление зависит от результата проверки."
)

BRANCH_RULE = "Варианты взаимозаменяемы: этап закрывается подтверждением любого одного из них."

FALLBACK_NO_PASSPORT = (
    "Навык не связан с фреймворком компетенций: карта не подтверждает и не "
    "обещает повышение уровня."
)

FALLBACK_LOCKED_NO_FORECAST = (
    "Checkpoint заблокирован: уровень не прогнозируется, пока prerequisites не выполнены."
)

OUTCOME_BY_TARGET_KIND = {
    "course": "Проверяемый артефакт курса в портфолио после подтверждения завершения.",
    "task": "Принятый результат проектной практики с описанием личного вклада.",
}

OUTCOME_FALLBACK = "Результат подтверждается проверкой evidence связанных объектов."


class MapCheckpointState(StrEnum):
    COMPLETED = "completed"
    CURRENT = "current"
    AVAILABLE = "available"
    SUBMITTED = "submitted"
    LOCKED = "locked"
    BRANCH = "branch"
    OPTIONAL = "optional"
    SKIPPED_BY_RULE = "skipped_by_rule"


STATE_LABELS = {
    MapCheckpointState.COMPLETED.value: "Завершён",
    MapCheckpointState.CURRENT.value: "Текущий шаг",
    MapCheckpointState.AVAILABLE.value: "Доступен",
    MapCheckpointState.SUBMITTED.value: "На проверке",
    MapCheckpointState.LOCKED.value: "Заблокирован",
    MapCheckpointState.BRANCH.value: "Развилка · вариантов в группе",
    MapCheckpointState.OPTIONAL.value: "Необязательный",
    MapCheckpointState.SKIPPED_BY_RULE.value: "Не требуется: этап закрыт другим вариантом",
}


@dataclass(frozen=True, slots=True)
class BranchGroup:
    """Run of consecutive optional checkpoints solving the same skill result."""

    group_key: str
    member_keys: tuple[str, ...]
    satisfied: bool
    rule: str = BRANCH_RULE


@dataclass(frozen=True, slots=True)
class LockedPrerequisite:
    milestone_key: str
    title: str
    ref: str


@dataclass(frozen=True, slots=True)
class MapCheckpointNode:
    key: str
    position: int
    title: str
    purpose: str
    skill: str
    target_kind: str
    target_key: str
    state: MapCheckpointState
    mandatory: bool
    state_label: str
    points_available: int
    points_earned: int
    points_rule: str = POINTS_RULE
    policy_version: int = TRAJECTORY_MAP_POLICY_VERSION
    locked_reasons: tuple[LockedPrerequisite, ...] = ()
    branch: BranchGroup | None = None

    @property
    def actionable(self) -> bool:
        return self.state in {
            MapCheckpointState.CURRENT,
            MapCheckpointState.AVAILABLE,
            MapCheckpointState.BRANCH,
            MapCheckpointState.OPTIONAL,
        }


@dataclass(frozen=True, slots=True)
class MapProgress:
    completed_mandatory: int
    total_mandatory: int

    @property
    def percent(self) -> float:
        if self.total_mandatory == 0:
            return 0.0
        return round(self.completed_mandatory / self.total_mandatory * 100, 1)


@dataclass(frozen=True, slots=True)
class TrajectoryMapView:
    track_key: str
    policy_version: int
    replacement_reason: str | None
    current_key: str | None
    checkpoints: tuple[MapCheckpointNode, ...]
    progress: MapProgress


@dataclass(frozen=True, slots=True)
class PrerequisiteFact:
    milestone_key: str
    title: str
    met: bool


@dataclass(frozen=True, slots=True)
class SkillImpact:
    """Honest current/projected/target impact of one checkpoint (openspec 24.1)."""

    skill: str
    current_level: str
    target_level: str
    projected_level: str | None
    forecast_only: bool
    explanation: str
    missing_evidence: tuple[str, ...]
    fallback: str | None


@dataclass(frozen=True, slots=True)
class TrajectoryCheckpointDetail:
    node: MapCheckpointNode
    goal: str
    outcome: str
    prerequisites: tuple[PrerequisiteFact, ...]
    evidence_refs: tuple[str, ...]
    skill_impact: SkillImpact
    replay: bool


def checkpoint_ref(milestone: RoadmapMilestone) -> str:
    """Canonical object ref of a roadmap checkpoint."""
    return f"checkpoint:{milestone.key}"


def _branch_groups(
    milestones: tuple[RoadmapMilestone, ...],
) -> dict[str, BranchGroup]:
    groups: dict[str, BranchGroup] = {}
    run: list[RoadmapMilestone] = []
    iterator = (*milestones, None)
    for milestone in iterator:
        if (
            milestone is not None
            and not milestone.mandatory
            and run
            and run[-1].skill == milestone.skill
        ):
            run.append(milestone)
            continue
        if len(run) > 1:
            keys = tuple(item.key for item in run)
            group_key = f"branch:{keys[0]}"
            groups.update({key: BranchGroup(group_key, keys, False) for key in keys})
        run = [] if milestone is None else [milestone]
    return groups


def build_trajectory_map(
    projection: RoadmapProjection,
    enrollments: Mapping[str, CompletionStatus] | None = None,
) -> TrajectoryMapView:
    """Derive the interactive map state machine from a published roadmap version."""
    milestones = projection.milestones
    completed = projection.completed_keys
    live_status: Mapping[str, CompletionStatus] = (
        enrollments if enrollments is not None else {}
    )
    groups = _branch_groups(milestones)
    satisfied_groups = {
        group.group_key
        for group in groups.values()
        if any(key in completed for key in group.member_keys)
    }
    mandatory = [item for item in milestones if item.mandatory]
    completed_mandatory = sum(1 for item in mandatory if item.key in completed)

    def in_flight(item: RoadmapMilestone) -> bool:
        return (
            item.target_kind == "course"
            and live_status.get(item.target_key) is CompletionStatus.REPORTED
        )

    def strict_unmet(item: RoadmapMilestone) -> tuple[LockedPrerequisite, ...]:
        """Mandatory predecessors that block by chain: neither confirmed nor submitted."""
        return tuple(
            LockedPrerequisite(
                milestone_key=previous.key,
                title=previous.title,
                ref=checkpoint_ref(previous),
            )
            for previous in mandatory
            if previous.position < item.position
            and previous.key not in completed
            and not in_flight(previous)
        )

    current_seen = False
    chain_released = False
    nodes: list[MapCheckpointNode] = []
    for milestone in milestones:
        state: MapCheckpointState
        locked_reasons: tuple[LockedPrerequisite, ...] = ()
        branch = groups.get(milestone.key)
        reported = in_flight(milestone)
        group_open = branch is not None and branch.group_key not in satisfied_groups
        strict = strict_unmet(milestone)
        group_open = branch is not None and branch.group_key not in satisfied_groups
        if milestone.key in completed:
            state = MapCheckpointState.COMPLETED
        elif (
            not milestone.mandatory and branch is not None and branch.group_key in satisfied_groups
        ):
            state = MapCheckpointState.SKIPPED_BY_RULE
        elif not chain_released and strict:
            state = MapCheckpointState.LOCKED
        elif reported and milestone.mandatory:
            state = MapCheckpointState.SUBMITTED
            chain_released = True
        elif group_open:
            state = MapCheckpointState.BRANCH
            current_seen = True  # the live branch decision owns the auto-position
        elif reported:
            state = MapCheckpointState.SUBMITTED
        elif not milestone.mandatory:
            if branch is not None:
                state = MapCheckpointState.BRANCH
                current_seen = True
            else:
                state = MapCheckpointState.OPTIONAL
        elif not current_seen:
            state = MapCheckpointState.CURRENT
            current_seen = True
        else:
            state = MapCheckpointState.AVAILABLE
        # explanations follow every unfinished node; fixed states carry none
        if state in {
            MapCheckpointState.COMPLETED,
            MapCheckpointState.SUBMITTED,
            MapCheckpointState.SKIPPED_BY_RULE,
        }:
            locked_reasons = ()
        elif state is MapCheckpointState.BRANCH:
            # an open branch also explains unverified in-flight prerequisites:
            # the group cannot close while a mandatory step awaits verification
            locked_reasons = (
                strict
                if strict
                else tuple(
                    LockedPrerequisite(
                        milestone_key=previous.key,
                        title=previous.title,
                        ref=checkpoint_ref(previous),
                    )
                    for previous in mandatory
                    if previous.position < milestone.position
                    and previous.key not in completed
                    and in_flight(previous)
                )
            )
        else:
            locked_reasons = strict
        nodes.append(
            MapCheckpointNode(
                key=milestone.key,
                position=milestone.position,
                title=milestone.title,
                purpose=milestone.purpose,
                skill=milestone.skill,
                target_kind=milestone.target_kind,
                target_key=milestone.target_key,
                state=state,
                mandatory=milestone.mandatory,
                state_label=(
                    f"Развилка · {len(branch.member_keys)} вариантов, шаг закроется одним из них"
                    if state is MapCheckpointState.BRANCH and branch is not None
                    else STATE_LABELS[state.value]
                ),
                points_available=CHECKPOINT_POINTS,
                points_earned=CHECKPOINT_POINTS if state is MapCheckpointState.COMPLETED else 0,
                locked_reasons=locked_reasons,
                branch=branch,
            )
        )
    # auto-position: the map points at the first actionable chain focus; the
    # live branch decision takes precedence once the chain has moved past the
    # current step.
    actionable_order = (
        MapCheckpointState.CURRENT,
        MapCheckpointState.BRANCH,
        MapCheckpointState.SUBMITTED,
        MapCheckpointState.OPTIONAL,
        MapCheckpointState.AVAILABLE,
    )
    current_key = next(
        (item.key for wanted in actionable_order for item in nodes if item.state is wanted),
        None,
    )
    return TrajectoryMapView(
        track_key=projection.track_key,
        policy_version=projection.policy_version,
        replacement_reason=projection.replacement_reason,
        current_key=current_key,
        checkpoints=tuple(nodes),
        progress=MapProgress(completed_mandatory, len(mandatory)),
    )


def build_skill_impact(
    node: MapCheckpointNode,
    gap: SkillGapProjection | None,
) -> SkillImpact:
    """Map the passport gap projection on one checkpoint, never confirming growth."""
    if gap is None:
        return SkillImpact(
            skill=node.skill,
            current_level="не подтверждено",
            target_level="уверенный",
            projected_level=None,
            forecast_only=False,
            explanation=FALLBACK_NO_PASSPORT,
            missing_evidence=(),
            fallback=FALLBACK_NO_PASSPORT,
        )
    missing = tuple(f"{kind}:{ref}" for kind, ref in gap.missing_evidence)
    if node.state is MapCheckpointState.COMPLETED:
        return SkillImpact(
            skill=gap.title,
            current_level=gap.current_level,
            target_level=gap.target_level,
            projected_level=None,
            forecast_only=False,
            explanation=(
                f"Уровень «{gap.current_level}» уже отражает этот подтверждённый "
                "checkpoint: повторное выполнение не начисляет баллы."
            ),
            missing_evidence=missing,
            fallback=None,
        )
    if gap.skill_key is None:
        return SkillImpact(
            skill=gap.title,
            current_level=gap.current_level,
            target_level=gap.target_level,
            projected_level=None,
            forecast_only=False,
            explanation=gap.explanation,
            missing_evidence=missing,
            fallback=gap.fallback,
        )
    if node.state is MapCheckpointState.LOCKED:
        return SkillImpact(
            skill=gap.title,
            current_level=gap.current_level,
            target_level=gap.target_level,
            projected_level=None,
            forecast_only=False,
            explanation=f"{gap.explanation} {FALLBACK_LOCKED_NO_FORECAST}",
            missing_evidence=missing,
            fallback=FALLBACK_LOCKED_NO_FORECAST,
        )
    # любой доступный к исполнению checkpoint известного навыка даёт честный
    # forecast: повышение уровня станет подтверждённым только после проверки
    # evidence (openspec 22.16 / 24.1), поэтому projected всегда forecast_only.
    return SkillImpact(
        skill=gap.title,
        current_level=gap.current_level,
        target_level=gap.target_level,
        projected_level=gap.target_level,
        forecast_only=True,
        explanation=(
            f"{gap.explanation} Прогноз «{gap.current_level} → {gap.target_level}» "
            "станет подтверждённым уровнем только после проверки evidence."
        ),
        missing_evidence=missing,
        fallback=None,
    )


def build_checkpoint_detail(
    view: TrajectoryMapView,
    node: MapCheckpointNode,
    *,
    gap: SkillGapProjection | None,
) -> TrajectoryCheckpointDetail:
    """Full checkpoint detail: goal, prerequisites, evidence, points and skill impact."""
    completed = _completed_keys(view)
    prerequisites = tuple(
        PrerequisiteFact(
            milestone_key=previous.key,
            title=previous.title,
            met=previous.key in completed,
        )
        for previous in view.checkpoints
        if previous.mandatory and previous.position < node.position
    )
    evidence_refs: tuple[str, ...] = ()
    if gap is not None:
        evidence_refs = tuple(f"{kind}:{ref}" for kind, ref in gap.counted_sources)
    return TrajectoryCheckpointDetail(
        node=node,
        goal=node.purpose,
        outcome=OUTCOME_BY_TARGET_KIND.get(node.target_kind, OUTCOME_FALLBACK),
        prerequisites=prerequisites,
        evidence_refs=evidence_refs,
        skill_impact=build_skill_impact(node, gap),
        replay=node.state is MapCheckpointState.COMPLETED,
    )


def _completed_keys(view: TrajectoryMapView) -> frozenset[str]:
    return frozenset(
        item.key for item in view.checkpoints if item.state is MapCheckpointState.COMPLETED
    )


__all__ = [
    "BRANCH_RULE",
    "CHECKPOINT_POINTS",
    "FALLBACK_LOCKED_NO_FORECAST",
    "FALLBACK_NO_PASSPORT",
    "OUTCOME_BY_TARGET_KIND",
    "POINTS_RULE",
    "STATE_LABELS",
    "TRAJECTORY_MAP_POLICY_VERSION",
    "BranchGroup",
    "LockedPrerequisite",
    "MapCheckpointNode",
    "MapCheckpointState",
    "MapProgress",
    "PrerequisiteFact",
    "SkillImpact",
    "TrajectoryCheckpointDetail",
    "TrajectoryMapView",
    "build_checkpoint_detail",
    "build_skill_impact",
    "build_trajectory_map",
    "checkpoint_ref",
]
