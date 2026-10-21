export type ChannelWorkContextView = {
  project_key: string;
  task_title: string;
  deadline_at: string | null;
  contribution_version: number | null;
  contribution_accepted: boolean | null;
  review_status: string | null;
} | null;

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: "Оценка — черновик",
  proposed: "Оценка ожидает подтверждения",
  human_confirmed: "Оценка подтверждена человеком",
  published: "Оценка опубликована",
  disputed: "Оценка оспаривается",
};

export function contributionLabel(context: NonNullable<ChannelWorkContextView>): string {
  if (!context.contribution_version) return "вклад не отправлен";
  const accepted = context.contribution_accepted === true;
  return `версия ${String(context.contribution_version)} · ${
    accepted ? "принят заказчиком" : "ожидает приёмки"
  }`;
}

export function reviewStatusLabel(status: string | null): string {
  if (!status) return "оценка не создана";
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function contextDateLabel(raw: string | null): string {
  if (!raw) return "не задан";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "не задан";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
