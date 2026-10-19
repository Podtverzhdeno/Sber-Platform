import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { components } from "../api/schema";

import { agendaItems, shiftDate, todayISO, type WorkItemView } from "./agenda-data";
import { DayAgendaBody } from "./day-agenda";

type Snapshot = components["schemas"]["GrowthSnapshotView"];

const snapshot: Snapshot = {
  snapshot_id: "growth-snapshot-1",
  generated_at: "2026-10-19T17:55:00+03:00",
  snapshot_version: 2,
  actor_timezone: "Europe/Moscow",
  definitions: {
    activity: "impulse-growth-activity-v3",
    hours: "impulse-growth-hours-v1",
    milestones: "impulse-growth-milestones-v2",
    readiness: "impulse-growth-readiness-v1",
    snapshot: "impulse-growth-snapshot-v2",
  },
  period_boundaries: {
    day: { start: "2026-10-19T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
    week: { start: "2026-10-13T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
    month: { start: "2026-10-01T00:00:00+03:00", end: "2026-11-01T00:00:00+03:00" },
    year: { start: "2026-01-01T00:00:00+03:00", end: "2027-01-01T00:00:00+03:00" },
  },
  activity: {
    day: { total: 2, course_checkpoint: 1, project_submission: 1, revision_accepted: 0, event_participation: 0 },
    week: { total: 4, course_checkpoint: 2, project_submission: 1, revision_accepted: 1, event_participation: 0 },
    month: { total: 1, course_checkpoint: 0, project_submission: 1, revision_accepted: 0, event_participation: 0 },
    year: { total: 14, course_checkpoint: 7, project_submission: 4, revision_accepted: 2, event_participation: 1 },
  },
  activity_state: {
    day: neutralState(),
    week: neutralState(),
    month: neutralState(),
    year: neutralState(),
  },
  events: [
    {
      kind: "project_submission",
      title: "Вклад: API поиска",
      occurred_at: "2026-10-18T12:00:00+03:00",
      source_kind: "contribution",
      source_ref: "contribution-1",
    },
    {
      kind: "course_checkpoint",
      title: "Checkpoint RAG",
      occurred_at: "2026-10-16T09:30:00+03:00",
      source_kind: "checkpoint",
      source_ref: "rag-mvp",
    },
  ],
  hours: {
    known: true,
    trusted_minutes: 210,
    self_reported_minutes: 45,
    intervals: [
      {
        start: "2026-10-16T09:30:00+03:00",
        end: "2026-10-16T11:00:00+03:00",
        source_kind: "checkpoint",
        source_ref: "rag-mvp",
      },
    ],
  },
  freshness: { known: true, latest_observed_at: "2026-10-18T12:00:00+03:00" },
  trajectories: [],
};

function neutralState() {
  return {
    version: 1,
    state: "neutral",
    total: 0,
    target_min: null,
    target_max: null,
    missing_category: null,
    text: "состояние нейтральное",
    action: null,
  };
}

const work = [
  {
    assignment: {
      id: "assignment-1",
      task_id: "task-1",
      person_id: "person-1",
      application_id: "application-1",
      status: "in_progress",
    },
    task: { title: "RAG: надёжный поиск по документам" },
    terms: { deadline_at: "2026-10-20T18:00:00Z" },
    contributions: [],
    decisions: [],
  },
] as unknown as WorkItemView[];

describe("agenda items on moscow days", () => {
  it("lists events and sessions only for their own local day", () => {
    expect(agendaItems(snapshot, [], "2026-10-18")).toHaveLength(1);
    expect(agendaItems(snapshot, [], "2026-10-18")[0]?.title).toBe("Вклад: API поиска");
    expect(agendaItems(snapshot, [], "2026-10-18")[0]?.planned).toBe(false);
    expect(agendaItems(snapshot, [], "2026-10-17")).toHaveLength(0);
    const sessionDay = agendaItems(snapshot, [], "2026-10-16");
    expect(sessionDay).toHaveLength(2);
    expect(sessionDay.map((item) => item.label)).toEqual(["Checkpoint курса", "Занятие"]);
    expect(sessionDay[0]?.time).toBe("09:30");
  });

  it("adds workspace deadlines as planned items", () => {
    const items = agendaItems(snapshot, work, "2026-10-20");
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("Дедлайн");
    expect(items[0]?.title).toContain("RAG");
    expect(items[0]?.planned).toBe(true);
  });

  it("sorts mixed items by local time", () => {
    const sorted: Snapshot = {
      ...snapshot,
      hours: {
        known: true,
        trusted_minutes: 210,
        self_reported_minutes: 45,
        intervals: [
          {
            start: "2026-10-16T14:00:00+03:00",
            end: "2026-10-16T15:30:00+03:00",
            source_kind: "checkpoint",
            source_ref: "rag-mvp",
          },
        ],
      },
    };
    const items = agendaItems(sorted, [], "2026-10-16");
    expect(items[0]?.time).toBe("09:30");
    expect(items[1]?.time).toBe("14:00");
  });
});

describe("day agenda body", () => {
  it("shows an empty state instead of borrowing other days", () => {
    const empty = render(
      <DayAgendaBody
        state="success"
        snapshot={snapshot}
        work={[]}
        selectedDate="2026-10-15"
        onDateChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(empty.getByTestId("agenda-empty").textContent).toContain("квалифицированных действий нет");
    expect(empty.getByTestId("agenda-empty").textContent).toContain("15");
    expect(empty.getByTestId("agenda-empty").textContent).not.toContain("Checkpoint RAG");
    expect(empty.queryByTestId("agenda-items")).not.toBeInTheDocument();
  });

  it("keeps the history note for a day with performed actions", () => {
    const view = render(
      <DayAgendaBody
        state="success"
        snapshot={snapshot}
        work={[]}
        selectedDate="2026-10-18"
        onDateChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(view.getByTestId("agenda-items").textContent).toContain("Вклад: API поиска");
    expect(view.getByTestId("agenda-history-note").textContent).toContain("не требуют повторного участия");
  });

  it("navigates to previous days and back to today", () => {
    const today = todayISO();
    const onDateChange = vi.fn();
    const view = render(
      <DayAgendaBody
        state="success"
        snapshot={snapshot}
        work={[]}
        selectedDate={shiftDate(today, -1)}
        onDateChange={onDateChange}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(view.getByTestId("agenda-prev"));
    expect(onDateChange).toHaveBeenCalledWith(shiftDate(today, -2));
    fireEvent.click(view.getByTestId("agenda-today"));
    expect(onDateChange).toHaveBeenCalledWith(null);
    expect(view.getByTestId("agenda-next")).toBeEnabled();
  });

  it("blocks the next-day step on today and shows plan marking in the future", () => {
    const today = todayISO();
    const todayView = render(
      <DayAgendaBody
        state="success"
        snapshot={snapshot}
        work={[]}
        selectedDate={today}
        onDateChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(todayView.getByTestId("agenda-next")).toBeDisabled();
    expect(todayView.queryByTestId("agenda-today")).not.toBeInTheDocument();
    todayView.unmount();

    const targetDay = shiftDate(today, 1);
    const futureWork = [
      {
        assignment: {
          id: "assignment-1",
          task_id: "task-1",
          person_id: "person-1",
          application_id: "application-1",
          status: "in_progress",
        },
        task: { title: "RAG: надёжный поиск по документам" },
        terms: { deadline_at: `${targetDay}T18:00:00Z` },
        contributions: [],
        decisions: [],
      },
    ] as unknown as WorkItemView[];
    const onDateChange = vi.fn();
    const futureView = render(
      <DayAgendaBody
        state="success"
        snapshot={snapshot}
        work={futureWork}
        selectedDate={targetDay}
        onDateChange={onDateChange}
        onClose={() => undefined}
      />,
    );
    expect(futureView.getByTestId("agenda-body").className).toContain("agenda--plan");
    expect(futureView.getByTestId("agenda-plan-note").textContent).toContain("Будущий день — план");
    expect(futureView.queryByTestId("agenda-history-note")).not.toBeInTheDocument();
    expect(futureView.getByTestId("agenda-item-deadline:assignment-1").textContent).toContain("RAG");
  });

  it("explains unavailable and pending states", () => {
    const pending = render(
      <DayAgendaBody
        state="pending"
        selectedDate={todayISO()}
        onDateChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(pending.getByTestId("agenda-loading")).toBeInTheDocument();
    pending.unmount();
    render(
      <DayAgendaBody
        state="error"
        selectedDate={todayISO()}
        onDateChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("agenda-unavailable").textContent).toContain("не показывает выдуманные числа");
  });
});
