/**
 * Интерактивная карта траектории (openspec 24.1, импульс).
 * Данные — только из read-only API /me/trajectory-map (карта) и
 * /me/trajectory-map/checkpoints/{key} (детали). Карта не мутирует прогресс:
 * submission/verdict остаётся вехой работ, а «сдача на проверке» приходит
 * из живых зачислений платформы. Прогноз Skill Passport — только обещание
 * от API, помечено как прогноз.
 */

export type MapCheckpointState =
  | "AVAILABLE"
  | "CURRENT"
  | "SUBMITTED"
  | "LOCKED"
  | "COMPLETED"
  | "BRANCH"
  | "OPTIONAL"
  | "SKIPPED_BY_RULE";

export interface MapLockedPrerequisiteView {
  milestone_key: string;
  title: string;
  ref: string;
}

export interface MapBranchView {
  group_key: string;
  member_keys: string[];
  satisfied: boolean;
  rule: string;
}

export interface MapCheckpointView {
  key: string;
  position: number;
  title: string;
  purpose: string;
  skill: string;
  target_kind: string;
  target_key: string;
  state: MapCheckpointState;
  state_label: string;
  mandatory: boolean;
  actionable: boolean;
  points_available: number;
  points_earned: number;
  points_rule: string;
  policy_version: number;
  locked_reasons: MapLockedPrerequisiteView[];
  branch: MapBranchView | null;
}

export interface MapProgressView {
  completed_mandatory: number;
  total_mandatory: number;
  percent: number;
}

export interface TrajectoryMapTrackView {
  track_key: string;
  policy_version: number;
  replacement_reason: string | null;
  current_key: string | null;
  checkpoints: MapCheckpointView[];
  progress: MapProgressView;
}

export interface PrerequisiteFactView {
  milestone_key: string;
  title: string;
  met: boolean;
}

export interface SkillImpactView {
  skill: string;
  current_level: string;
  target_level: string;
  projected_level: string | null;
  forecast_only: boolean;
  explanation: string;
  missing_evidence: string[];
  fallback: string | null;
}

export interface TrajectoryCheckpointDetailView {
  checkpoint: MapCheckpointView;
  goal: string;
  outcome: string;
  prerequisites: PrerequisiteFactView[];
  evidence_refs: string[];
  skill_impact: SkillImpactView;
  replay: boolean;
  policy_version: number;
}
