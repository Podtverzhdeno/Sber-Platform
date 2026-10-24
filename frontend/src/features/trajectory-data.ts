import type { components } from "../api/schema";

import type { EvidenceAnchorView, GrowthSnapshotView } from "./kpi-data";

export type TrajectoryGrowthView = components["schemas"]["TrajectoryGrowthView"];
export type RoadmapView = components["schemas"]["RoadmapView"];
export type GrowthMilestoneView = components["schemas"]["impulse__api__v1__growth__MilestoneView"];
export type DevMilestoneView = components["schemas"]["impulse__api__v1__development__MilestoneView"];

export type TrajectoryViewMode = "cards" | "list";

export const TRAJECTORY_VIEW_MODES: readonly TrajectoryViewMode[] = ["cards", "list"];

export const TRAJECTORY_MODE_LABELS: Record<TrajectoryViewMode, string> = {
  cards: "Карточки",
  list: "Список",
};

export function isTrajectoryViewMode(value: string | null): value is TrajectoryViewMode {
  return value === "cards" || value === "list";
}

export function trajectorySlug(trackKey: string): string {
  const slug = trackKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "track";
}

export function trajectoryColorClass(trackKey: string): string {
  return `trajectory--${trajectorySlug(trackKey)}`;
}

const TRACK_COLOR_NAMES: Record<string, string> = {
  "python-dev": "сине-бирюзовый",
  data: "бирюзовый",
  analyst: "фиолетовый",
  product: "золотистый",
};

export const DEFAULT_COLOR_NAME = "синий";

export function trajectoryColorName(trackKey: string): string {
  return TRACK_COLOR_NAMES[trackKey.toLowerCase()] ?? DEFAULT_COLOR_NAME;
}

export const percentText = (percent: number | null | undefined): string =>
  percent === null || percent === undefined ? "—" : `${String(Math.round(percent))}%`;

export function remainderText(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "остаток неизвестен, пока нет подтверждённых данных";
  if (percent >= 100) return "цель направления достигнута";
  return `до цели ${String(100 - Math.round(percent))}%`;
}

export const STATUS_LABELS: Record<string, string> = {
  completed: "Подтверждено",
  available: "Доступно",
  unknown: "Данных нет",
};

const LEVEL_RANK: Record<string, number> = { базовый: 0, уверенный: 1 };
const LEVEL_LABELS = ["базовый", "уверенный"];

export interface SkillContour {
  title: string;
  known: boolean;
  currentLevel: string | null;
  targetLevel: string | null;
  progressText: string;
  cycleText: string;
}

const cyclePercentText = (current: number, target: number): string => {
  if (target <= 0) return "цель не определена";
  const percent = Math.round((current / target) * 100);
  return `${String(Math.min(percent, 100))}% пути к целевому уровню`;
};

export function buildSkillContours(
  skills: TrajectoryGrowthView["readiness_skills"] | null,
): SkillContour[] {
  const source: TrajectoryGrowthView["readiness_skills"] = skills ?? [];
  return source.map((skill) => {
    if (!skill.known) {
      return {
        title: skill.title,
        known: false,
        currentLevel: null,
        targetLevel: null,
        progressText: "уровень пока неизвестен",
        cycleText: "циклограмма недоступна",
      };
    }
    const currentRank = LEVEL_RANK[skill.current_level];
    const targetRank = LEVEL_RANK[skill.target_level];
    if (currentRank === undefined || targetRank === undefined) {
      return {
        title: skill.title,
        known: true,
        currentLevel: skill.current_level,
        targetLevel: skill.target_level,
        progressText: `${skill.current_level} → целевой уровень не определён формулой`,
        cycleText: "целевой уровень не определён формулой",
      };
    }
    const current = LEVEL_LABELS[currentRank] ?? skill.current_level;
    const target = LEVEL_LABELS[targetRank] ?? skill.target_level;
    return {
      title: skill.title,
      known: true,
      currentLevel: current,
      targetLevel: target,
      progressText: `${current} → ${target}`,
      cycleText: cyclePercentText(currentRank + 1, targetRank + 1),
    };
  });
}

export interface DayAnalytics {
  qualifiedDays: number;
  quietDays: number;
  todayKey: string;
  note: string;
}

const PERIOD_LENGTH_DAYS = 14;

export function buildDayAnalytics(events: GrowthSnapshotView["events"] | null): DayAnalytics {
  const days = new Set<string>();
  for (const event of events ?? []) days.add(event.occurred_at.slice(0, 10));
  const todayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(new Date());
  const qualifiedDays = days.size;
  const quietDays = Math.max(
    0,
    PERIOD_LENGTH_DAYS - qualifiedDays - (days.has(todayKey) ? 0 : 1),
  );
  return {
    qualifiedDays,
    quietDays,
    todayKey,
    note:
      "Пропуски фиксируются только после завершения дня и grace period с учётом timezone, заморозки и выходных плана; подтверждённые интервалы не повторяются как пропуски.",
  };
}

export interface TrajectoryCard {
  trackKey: string;
  slug: string;
  title: string;
  version: number;
  colorClass: string;
  colorName: string;
  percentText: string;
  completionPercent: number | null;
  remainderText: string;
  partial: boolean;
  coverage: number;
  readinessPercentText: string;
  completedCount: number;
  totalMilestones: number;
  nextStepTitle: string | null;
}

export function buildTrajectoryCards(trajectories: TrajectoryGrowthView[] | null): TrajectoryCard[] {
  const source: TrajectoryGrowthView[] = trajectories ?? [];
  return source.map((trajectory) => {
    const knownMilestones = trajectory.milestones.filter((milestone) => milestone.known);
    const completedCount = knownMilestones.filter((milestone) => milestone.status === "completed").length;
    const nextStep = knownMilestones.find((milestone) => milestone.status !== "completed");
    return {
      trackKey: trajectory.track_key,
      slug: trajectorySlug(trajectory.track_key),
      title: trajectory.track_title,
      version: trajectory.policy_version,
      colorClass: trajectoryColorClass(trajectory.track_key),
      colorName: trajectoryColorName(trajectory.track_key),
      percentText: percentText(trajectory.completion.percent),
      completionPercent: trajectory.completion.percent ?? null,
      remainderText: remainderText(trajectory.completion.percent),
      partial: trajectory.completion.partial,
      coverage: trajectory.completion.coverage,
      readinessPercentText: percentText(trajectory.readiness.percent),
      completedCount,
      totalMilestones: knownMilestones.length,
      nextStepTitle: nextStep?.target_title ?? nextStep?.title ?? null,
    };
  });
}

export interface TrajectoryOverviewFacts {
  title: string;
  slug: string;
  colorClass: string;
  colorName: string;
  version: number;
  purpose: string[];
  audience: string;
  outcome: string;
  skills: string[];
  stages: { key: string; title: string; purpose: string; statusLabel: string }[];
  evidenceRule: string;
}

export function buildTrackOverview(
  trajectory: TrajectoryGrowthView,
): TrajectoryOverviewFacts {
  const milestones = trajectory.milestones.filter((milestone) => milestone.known);
  return {
    title: trajectory.track_title,
    slug: trajectorySlug(trajectory.track_key),
    colorClass: trajectoryColorClass(trajectory.track_key),
    colorName: trajectoryColorName(trajectory.track_key),
    version: trajectory.policy_version,
    purpose: milestones.slice(0, 3).map((milestone) => milestone.purpose),
    audience: `Для участников, развивающих направление «${trajectory.track_title}».`,
    outcome: "Подтверждённые milestones попадают в Skill Passport и портфолио направления.",
    skills: trajectory.readiness_skills.map((skill) => skill.title),
    stages: milestones.map((milestone) => ({
      key: milestone.key,
      title: milestone.target_title.length > 0 ? milestone.target_title : milestone.title,
      purpose: milestone.purpose,
      statusLabel: STATUS_LABELS[milestone.status] ?? "По плану",
    })),
    evidenceRule: "Учитываются только подтверждённые checkpoints, принятые вклады и выданные сертификаты.",
  };
}

export interface TrajectoryDetailFacts {
  title: string;
  slug: string;
  colorClass: string;
  colorName: string;
  formulaId: string | null;
  formulaText: string;
  percentText: string;
  completionPercent: number | null;
  remainderText: string;
  partial: boolean;
  readinessPercent: number | null;
  readinessPercentText: string;
  readinessCycleText: string;
  contours: SkillContour[];
  calendar: { day: string; label: string; count: number; kindsLabel: string }[];
  days: DayAnalytics;
  hoursKnown: boolean;
  trustedHoursText: string | null;
  selfReportedHoursText: string | null;
  intervalsCount: number;
  evidence: {
    key: string;
    label: string;
    title: string;
    countedLabel: string;
    level: string;
    observedAt: string;
  }[];
  nextStepRef: string | null;
  planChange: string | null;
}

const KIND_LABELS: Record<string, string> = {
  project_submission: "Проектный вклад",
  course_checkpoint: "Checkpoint курса",
  event_participation: "Событие",
  revision_accepted: "Принятая доработка",
};

const EVIDENCE_KIND_LABELS: Record<string, string> = {
  contribution: "Вклад",
  checkpoint: "Checkpoint",
  certificate: "Сертификат",
  event: "Событие",
  workspace_assignment: "Проектная работа",
};

const RU_DAY = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Moscow",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export function buildEventCalendar(
  events: GrowthSnapshotView["events"] | null,
): TrajectoryDetailFacts["calendar"] {
  const groups = new Map<string, { count: number; kinds: Set<string> }>();
  for (const event of events ?? []) {
    const day = event.occurred_at.slice(0, 10);
    const group = groups.get(day) ?? { count: 0, kinds: new Set<string>() };
    group.count += 1;
    group.kinds.add(event.kind);
    groups.set(day, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([day, group]) => ({
      day,
      label: RU_DAY.format(new Date(`${day}T00:00:00`)),
      count: group.count,
      kindsLabel: [...group.kinds].map((kind) => KIND_LABELS[kind] ?? kind).join(", "),
    }));
}

export function hoursText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${String(rest)} мин`;
  if (rest <= 0) return `${String(hours)} ч`;
  return `${String(hours)} ч ${String(rest)} мин`;
}

export function buildTrackDetail(
  trajectory: TrajectoryGrowthView,
  snapshot: GrowthSnapshotView | null,
  anchors: EvidenceAnchorView[] | null,
  roadmap?: { replacement_reason: string | null } | null,
): TrajectoryDetailFacts {
  const formulaId = snapshot?.definitions.milestones ?? null;
  const readinessPercent = trajectory.readiness.percent ?? null;
  return {
    title: trajectory.track_title,
    slug: trajectorySlug(trajectory.track_key),
    colorClass: trajectoryColorClass(trajectory.track_key),
    colorName: trajectoryColorName(trajectory.track_key),
    formulaId,
    formulaText: `Подтверждённые обязательные этапы имеют равный вес; optional-этапы не влияют на процент. Формула ${formulaId ?? "без версии"}`,
    percentText: percentText(trajectory.completion.percent),
    completionPercent: trajectory.completion.percent ?? null,
    remainderText: remainderText(trajectory.completion.percent),
    partial: trajectory.completion.partial,
    readinessPercent: trajectory.readiness.percent ?? null,
    readinessPercentText: percentText(trajectory.readiness.percent),
    readinessCycleText:
      readinessPercent === null
        ? "циклограмма готовности недоступна"
        : cyclePercentText(readinessPercent, 100),
    contours: buildSkillContours(trajectory.readiness_skills),
    calendar: buildEventCalendar(snapshot?.events ?? null),
    days: buildDayAnalytics(snapshot?.events ?? null),
    hoursKnown: snapshot?.hours.known ?? false,
    trustedHoursText: snapshot ? hoursText(snapshot.hours.trusted_minutes) : null,
    selfReportedHoursText: snapshot ? hoursText(snapshot.hours.self_reported_minutes) : null,
    intervalsCount: snapshot?.hours.intervals.length ?? 0,
    evidence: (anchors ?? []).map((anchor) => ({
      key: `${anchor.source_kind}-${anchor.source_ref}`,
      label: EVIDENCE_KIND_LABELS[anchor.source_kind] ?? anchor.source_kind,
      title: anchor.reason,
      countedLabel: anchor.counted
        ? "учтено в Skill Passport"
        : "не учтено: навык не совпал с активным портфелем",
      level: anchor.level,
      observedAt: RU_TIME.format(new Date(anchor.observed_at)),
    })),
    nextStepRef: trajectory.next_step_ref,
    planChange:
      roadmap?.replacement_reason && roadmap.replacement_reason.length > 0
        ? roadmap.replacement_reason
        : null,
  };
}

export interface TrajectoryStage {
  key: string;
  title: string;
  purpose: string;
  skill: string;
  kind: string;
  targetKey: string;
  completed: boolean;
}

export function buildStages(
  roadmapStages: Array<Pick<DevMilestoneView, "key" | "title" | "purpose" | "skill" | "target_kind" | "target_key" | "completed">> | null,
  growthStages: GrowthMilestoneView[] | null,
): TrajectoryStage[] {
  if (roadmapStages) {
    return roadmapStages.map((milestone) => ({
      key: milestone.key,
      title: milestone.title,
      purpose: milestone.purpose,
      skill: milestone.skill,
      kind: milestone.target_kind,
      targetKey: milestone.target_key,
      completed: milestone.completed,
    }));
  }
  const growth = growthStages ?? [];
  return growth
    .filter((milestone) => milestone.known)
    .map((milestone) => ({
      key: milestone.key,
      title: milestone.target_title.length > 0 ? milestone.target_title : milestone.title,
      purpose: milestone.purpose,
      skill: milestone.skill,
      kind: milestone.target_kind,
      targetKey: milestone.target_key,
      completed: milestone.status === "completed",
    }));
}

export function formatVersionMeta(version: number): string {
  return `версия плана ${String(version)} (техническая)`;
}
