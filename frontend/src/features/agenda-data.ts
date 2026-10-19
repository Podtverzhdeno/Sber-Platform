import type { components } from "../api/schema";

export type AgendaState = "pending" | "error" | "success";

export type GrowthSnapshotView = components["schemas"]["GrowthSnapshotView"];
export type WorkItemView = components["schemas"]["WorkItemView"];

const KIND_LABELS: Record<string, string> = {
  course_checkpoint: "Checkpoint курса",
  project_submission: "Вклад по проекту",
  revision_accepted: "Принятая доработка",
  event_participation: "Событие",
};

const MOSCOW_DATE = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Moscow",
});

const MOSCOW_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

const RU_DAY = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

const dateISO = (value: Date) => MOSCOW_DATE.format(value);

export const dayStamp = (value: string) => dateISO(new Date(value));

export const todayISO = () => dateISO(new Date());

const dayDate = (dateString: string) => new Date(`${dateString}T00:00:00Z`);
export const shiftDate = (dateString: string, days: number) =>
  dateISO(new Date(dayDate(dateString).getTime() + days * 86400000));

export const formatAgendaDate = (dateString: string) => RU_DAY.format(dayDate(dateString));

export interface AgendaItem {
  key: string;
  time: string | null;
  label: string;
  title: string;
  origin: string;
  planned: boolean;
}

export function agendaItems(
  snapshot: GrowthSnapshotView,
  work: WorkItemView[],
  selectedDate: string,
): AgendaItem[] {
  const items: AgendaItem[] = [];
  snapshot.events.forEach((event) => {
    if (dayStamp(event.occurred_at) !== selectedDate) return;
    items.push({
      key: `event:${event.kind}:${event.source_ref}`,
      time: MOSCOW_TIME.format(new Date(event.occurred_at)),
      label: KIND_LABELS[event.kind] ?? event.kind,
      title: event.title,
      origin: event.source_kind,
      planned: false,
    });
  });
  snapshot.hours.intervals.forEach((interval) => {
    if (dayStamp(interval.start) !== selectedDate) return;
    items.push({
      key: `hours:${interval.source_kind}:${interval.source_ref}`,
      time: MOSCOW_TIME.format(new Date(interval.start)),
      label: "Занятие",
      title: INTERVAL_TITLES[interval.source_kind] ?? interval.source_ref,
      origin: interval.source_kind,
      planned: false,
    });
  });
  work.forEach((item) => {
    if (dayStamp(item.terms.deadline_at) !== selectedDate) return;
    items.push({
      key: `deadline:${item.assignment.id}`,
      time: null,
      label: "Дедлайн",
      title: item.task.title,
      origin: "workspace",
      planned: true,
    });
  });
  items.sort((first, second) =>
    (first.time ?? "").localeCompare(second.time ?? "") || first.label.localeCompare(second.label),
  );
  return items;
}

const INTERVAL_TITLES: Record<string, string> = {
  checkpoint: "Учебный checkpoint",
  workspace: "Проектная сессия",
  event: "Событие",
  self_reported: "Самоотчёт о практике",
};
