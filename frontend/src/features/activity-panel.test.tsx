import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityBody, type ActivityPeriod, type GrowthSnapshotView } from "./activity-panel";

function bucket(total: number, course = 0, project = 0, revision = 0, event = 0) {
  return {
    total,
    course_checkpoint: course,
    project_submission: project,
    revision_accepted: revision,
    event_participation: event,
  };
}

const snapshot: GrowthSnapshotView = {
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
    day: bucket(2, 1, 1, 0, 0),
    week: bucket(4, 2, 1, 1, 0),
    month: bucket(1, 0, 1, 0, 0),
    year: bucket(14, 7, 4, 2, 1),
  },
  activity_state: {
    day: {
      version: 1,
      state: "risk",
      total: 2,
      target_min: 1,
      target_max: 3,
      missing_category: "event_participation",
      text: "Активность 2 в рамках цели 1–3 квалифицированных событий за период.",
      action: null,
    },
    week: {
      version: 1,
      state: "success",
      total: 4,
      target_min: 3,
      target_max: 7,
      missing_category: null,
      text: "Активность 4 в рамках цели 3–7 квалифицированных событий за период.",
      action: null,
    },
    month: {
      version: 1,
      state: "risk",
      total: 1,
      target_min: 12,
      target_max: 30,
      missing_category: "course_checkpoint",
      text: "Активность 1 ниже цели 12–30 за период: нет ни одного события категории «курсы/checkpoints».",
      action: "Начните checkpoint курса в Bootcamp",
    },
    year: {
      version: 1,
      state: "success",
      total: 14,
      target_min: 120,
      target_max: 300,
      missing_category: null,
      text: "Активность 14 в рамках цели 120–300 квалифицированных событий за период.",
      action: null,
    },
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
  trajectories: [
    {
      track_key: "python-dev",
      track_title: "Python-разработчик",
      policy_version: 2,
      milestones: [],
          completion: { percent: 66.7, coverage: 1, partial: false },
      readiness_skills: [],
      readiness: { percent: 50, coverage: 1, partial: false },
      object_refs: [],
      next_step_ref: "course:python-base",
    },
  ],
};

const neutralSnapshot: GrowthSnapshotView = {
  ...snapshot,
  trajectories: [],
  activity_state: {
    day: neutralState(),
    week: neutralState(),
    month: neutralState(),
    year: neutralState(),
  },
};

function neutralState() {
  return {
    version: 1,
    state: "neutral",
    total: 0,
    target_min: null,
    target_max: null,
    missing_category: null,
    text: "Цель периода не задана действующим планом: 0 квалифицированных событий за период — состояние нейтральное.",
    action: null,
  };
}

function renderActivity(props: {
  state?: "pending" | "error" | "success";
  data?: GrowthSnapshotView | undefined;
  period?: ActivityPeriod;
} = {}) {
  const { onPeriod } = { onPeriod: () => undefined };
  return render(
    <ActivityBody
      state={props.state ?? "success"}
      data={props.data ?? snapshot}
      period={props.period ?? "week"}
      onPeriod={onPeriod}
      onOpenAnalytics={() => undefined}
    />,
  );
}

describe("activity panel", () => {
  it("shows the week bucket with kind breakdown and total as text", () => {
    renderActivity();
    expect(screen.getByTestId("activity-total").textContent).toContain("4");
    expect(screen.getByTestId("activity-kind-course_checkpoint").textContent).toContain("2");
    expect(screen.getByTestId("activity-kind-project_submission").textContent).toContain("1");
    expect(screen.getByTestId("activity-kind-revision_accepted").textContent).toContain("1");
    expect(screen.getByTestId("activity-kind-event_participation").textContent).toContain("0");
    expect(screen.getByTestId("activity-state-success").textContent).toContain("в рамках цели 3–7");
  });

  it("switches scale to month and shows its numbers and risk text", () => {
    renderActivity({ period: "month" });
    expect(screen.getByTestId("activity-total").textContent).toContain("1");
    expect(screen.getByTestId("activity-state-risk").textContent).toContain("ниже цели 12–30");
    expect(screen.getByTestId("activity-state-action").textContent).toContain(
      "Начните checkpoint курса в Bootcamp",
    );
  });

  it("shows only the selected period and exposes the other periods in a compact selector", () => {
    renderActivity({ period: "month" });
    const selector = screen.getByRole("combobox", { name: "Период активности" });
    expect(selector).toHaveValue("month");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("passes the selected period to the activity projection", () => {
    const onPeriod = vi.fn();
    render(
      <ActivityBody
        state="success"
        data={snapshot}
        period="day"
        onPeriod={onPeriod}
        onOpenAnalytics={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Период активности" }), {
      target: { value: "year" },
    });
    expect(onPeriod).toHaveBeenCalledWith("year");
  });

  it("stays neutral without an active plan and keeps text", () => {
    renderActivity({ data: neutralSnapshot });
    expect(screen.getByTestId("activity-state-neutral").textContent).toContain("нейтральное");
    expect(screen.getByTestId("activity-state-neutral").textContent).toContain("0 квалифицированных событий");
  });

  it("explains the calculation with definition, timezone, period and freshness", () => {
    renderActivity();
    fireEvent.click(screen.getByText("Как считается"));
    expect(screen.getByTestId("activity-definition").textContent).toContain("impulse-growth-activity-v3");
    expect(screen.getByTestId("activity-timezone").textContent).toBe("Europe/Moscow");
    expect(screen.getByTestId("activity-freshness").textContent).toContain("последнее подтверждённое событие");
    expect(screen.getAllByTestId("activity-events").length).toBeGreaterThan(0);
    expect(screen.getByTestId("activity-events").textContent).toContain("Checkpoint RAG");
  });

  it("renders an honest unavailable state instead of fake numbers", () => {
    renderActivity({ state: "error", data: undefined });
    expect(screen.getByTestId("activity-unavailable").textContent).toContain("не показывает выдуманные числа");
  });
});
