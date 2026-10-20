"""Interactive trajectory roadmap (openspec 24.1).

Чистые projection-функции и read-only Router карты траектории. Модуль
никогда не меняет прогресс: открытие карты или checkpoint-детали не
подтверждает evidence и не начисляет баллы.
"""

from impulse.trajectory_map.api import router
from impulse.trajectory_map.projection import (
    BRANCH_RULE,
    CHECKPOINT_POINTS,
    FALLBACK_LOCKED_NO_FORECAST,
    FALLBACK_NO_PASSPORT,
    OUTCOME_BY_TARGET_KIND,
    OUTCOME_FALLBACK,
    POINTS_RULE,
    STATE_LABELS,
    TRAJECTORY_MAP_POLICY_VERSION,
    BranchGroup,
    LockedPrerequisite,
    MapCheckpointNode,
    MapCheckpointState,
    MapProgress,
    PrerequisiteFact,
    SkillImpact,
    TrajectoryCheckpointDetail,
    TrajectoryMapView,
    build_checkpoint_detail,
    build_skill_impact,
    build_trajectory_map,
    checkpoint_ref,
)

__all__ = [
    "BRANCH_RULE",
    "CHECKPOINT_POINTS",
    "FALLBACK_LOCKED_NO_FORECAST",
    "FALLBACK_NO_PASSPORT",
    "OUTCOME_BY_TARGET_KIND",
    "OUTCOME_FALLBACK",
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
    "router",
]
