import { apiRequest } from "../../api/client";
import type { components } from "../../api/schema";

export type DevelopmentOverviewView =
  components["schemas"]["DevelopmentOverviewView"];
export type NextOutcomeView = components["schemas"]["NextOutcomeView"];
export type WeekFocusView = components["schemas"]["WeekFocusView"];
export type DayFocusView = components["schemas"]["DayFocusView"];
export type ActiveTaskView = components["schemas"]["ActiveTaskView"];
export type RoleCardView = components["schemas"]["RoleCardView"];
export type CareerGradeSummaryView =
  components["schemas"]["CareerGradeSummaryView"];

export const DEVELOPMENT_OVERVIEW_PATH =
  "/api/v1/participant/me/development-overview";
export const overviewQueryKey = ["development-overview"] as const;

export function loadDevelopmentOverview(): Promise<DevelopmentOverviewView> {
  return apiRequest<DevelopmentOverviewView>(DEVELOPMENT_OVERVIEW_PATH);
}

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Local date of the selected focus row; the week range is server-scoped. */
export function parseFocusDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDayLabel(value: string): string {
  const parsed = parseFocusDate(value);
  if (parsed === null) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

export function formatWeekdayShort(value: string): string {
  const parsed = parseFocusDate(value);
  if (parsed === null) return "";
  return WEEKDAY_LABELS[parsed.getDay() === 0 ? 6 : parsed.getDay() - 1] ?? "";
}

/**
 * Deep-link targets reuse the canonical routes of the current shell
 * (Bootcamp + course key, task section). The mapping lives with the page
 * caller so the feature stays decoupled from the routing layout.
 */
export type OpenTarget = (kind: string, key: string, roleKey?: string) => void;

export const TASK_NEXT_ACTION_LABELS: Record<string, string | undefined> = {
  start: "Начать работу",
  send_work: "Отправить работу",
  await_review: "Ожидает проверки",
  revise: "Доработать по ревью",
  dispute_pending: "Идёт спор по оригинальности",
};
