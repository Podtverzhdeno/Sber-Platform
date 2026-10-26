import { useQuery } from "@tanstack/react-query";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import type { components } from "../api/schema";

export type GrowthSnapshotView = components["schemas"]["GrowthSnapshotView"];
export type WorkItemView = components["schemas"]["WorkItemView"];
export type EvidenceAnchorView = components["schemas"]["EvidenceAnchorView"];
export type CourseCertificateView = components["schemas"]["CourseCertificateView"];

export type KpiKey = "progress" | "projects" | "verified";

export const KPI_KEYS: KpiKey[] = ["progress", "projects", "verified"];

export const KPI_TITLES: Record<KpiKey, string> = {
  progress: "Прогресс маршрута: формула и вклад этапов",
  projects: "Проекты: активные, завершённые и требующие внимания",
  verified: "Подтверждённый опыт: навыки, вклады и сертификаты",
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  staffed: "Распределён",
  in_progress: "В работе",
  submitted: "На проверке",
  revision_requested: "Требует доработки",
  disputed: "Оспорен",
  accepted: "Принят",
  closed: "Закрыт",
};

export const ACTIVE_STATUSES = new Set(["staffed", "in_progress", "submitted"]);
export const HISTORY_STATUSES = new Set(["accepted", "closed"]);
export const ATTENTION_STATUSES = new Set(["revision_requested", "disputed"]);

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  contribution: "Вклад",
  checkpoint: "Checkpoint курса",
  certificate: "Сертификат",
  event: "Событие",
  workspace_assignment: "Проектная работа",
};

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

export const dayLabel = (value: string) => RU_DATE.format(new Date(value)).replace(" г.", "");

export function useRouter<T>(path: RuntimeApiPath, queryKey: unknown[], enabled: boolean) {
  return useQuery<T>({
    queryKey,
    queryFn: () => apiRequest<T>(path),
    enabled,
  });
}

export function useGrowthSnapshot(enabled: boolean) {
  return useRouter<GrowthSnapshotView>("/api/v1/me/growth/snapshot", ["growth-snapshot"], enabled);
}

export function useWorkItems(enabled: boolean) {
  return useRouter<WorkItemView[]>("/api/v1/me/work", ["me-work"], enabled);
}

export function useEvidenceAnchors(enabled: boolean) {
  return useRouter<EvidenceAnchorView[]>("/api/v1/me/competency-evidence", ["me-evidence"], enabled);
}

export function useCertificates(enabled: boolean) {
  return useRouter<CourseCertificateView[]>(
    "/api/v1/me/bootcamp/certificates",
    ["me-certificates"],
    enabled,
  );
}

export function useStudentStreak(enabled: boolean) {
  return useRouter<components["schemas"]["StreakView"]>(
    "/api/v1/me/learning/streak",
    ["me-streak"],
    enabled,
  );
}

export type KpiValues = Partial<Record<KpiKey | "streak", { value: string; delta: string }>>;

export function useKpiDataSources(enabled: boolean) {
  return {
    growth: useGrowthSnapshot(enabled),
    work: useWorkItems(enabled),
    anchors: useEvidenceAnchors(enabled),
    certificates: useCertificates(enabled),
    streak: useStudentStreak(enabled),
  };
}

export function buildKpiValues(sources: {
  growth: ReturnType<typeof useGrowthSnapshot>;
  work: ReturnType<typeof useWorkItems>;
  anchors: ReturnType<typeof useEvidenceAnchors>;
  certificates: ReturnType<typeof useCertificates>;
  streak: ReturnType<typeof useStudentStreak>;
}): KpiValues {
  const { growth, work, anchors, certificates, streak } = sources;
  const values: KpiValues = {};
  if (growth.isSuccess) {
    // Malformed or stale API responses must not crash the participant dashboard.
    // An absent trajectory is unknown progress, never a fabricated 0%.
    const trajectories = Array.isArray(growth.data.trajectories)
      ? growth.data.trajectories : [];
    const trajectory = trajectories[0];
    const percent = trajectory?.completion.percent ?? null;
    values.progress = {
      value: percent === null ? "—" : `${String(Math.round(percent))}%`,
      delta:
        trajectory === undefined
          ? "этапы маршрута ещё не назначены"
          : trajectory.completion.partial
            ? `точность частична (coverage ${String(trajectory.completion.coverage)})`
            : "по формуле этапов",
    };
  } else if (growth.isError) {
    values.progress = { value: "—", delta: "данные недоступны" };
  } else {
    values.progress = { value: "…", delta: "загрузка" };
  }
  if (work.isSuccess) {
    const items = Array.isArray(work.data) ? work.data : [];
    const active = items.filter((item) => ACTIVE_STATUSES.has(item.assignment.status));
    const history = items.filter((item) => HISTORY_STATUSES.has(item.assignment.status));
    const attention = items.filter((item) => ATTENTION_STATUSES.has(item.assignment.status));
    values.projects = {
      value: String(active.length),
      delta:
        attention.length > 0
          ? `${String(attention.length)} требует внимания · история: ${String(history.length)}`
          : history.length > 0
            ? `история: ${String(history.length)}`
            : "история пуста",
    };
  } else if (work.isError) {
    values.projects = { value: "—", delta: "данные недоступны" };
  } else {
    values.projects = { value: "…", delta: "загрузка" };
  }
  if (anchors.isSuccess && certificates.isSuccess) {
    const counted = (Array.isArray(anchors.data) ? anchors.data : []).filter(
      (anchor) => anchor.counted,
    ).length;
    const total = counted + (Array.isArray(certificates.data) ? certificates.data.length : 0);
    values.verified = {
      value: String(total),
      delta: "сертификаты и подтверждённые навыки",
    };
  } else if (anchors.isError || certificates.isError) {
    values.verified = { value: "—", delta: "данные недоступны" };
  } else {
    values.verified = { value: "…", delta: "загрузка" };
  }
  if (streak.isSuccess) {
    values.streak = { value: String(streak.data.current_days), delta: "дней подряд" };
  } else if (streak.isError) {
    values.streak = { value: "—", delta: "данные недоступны" };
  } else {
    values.streak = { value: "…", delta: "загрузка" };
  }
  return values;
}
