import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MonthlyGoalBody, MonthlyGoalDiagram } from "./monthly-goal-card";
import type { MonthlyGoalView } from "./monthly-goal-client";

const goal: MonthlyGoalView = {
  policy_version: 1,
  generated_at: "2026-10-20T08:00:00Z",
  track_key: "python",
  track_title: "Python-разработчик",
  goal_title: "Практический checkpoint до 2026-10-31",
  goal_ref: "checkpoint:practice",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
  days_left: 12,
  timezone: "Europe/Moscow",
  plan_version: 2,
  history_count: 2,
  contours: { baseline: 0, current: 0, projected: 1, target: 2 },
  remaining: 2,
  next_checkpoint: "Освоить основу",
  next_checkpoint_ref: "checkpoint:foundation",
  feasibility: {
    known: true,
    capacity_days: 1,
    required_steps: 2,
    feasible: false,
    deficit: 1,
    text: "План не помещается: дефицит 1 день.",
  },
  partial_forecast: true,
  coverage: 0.5,
  missing_mappings: ["checkpoint:practice"],
  assumptions: ["Current меняется только после проверки evidence."],
  steps: [
    {
      key: "foundation",
      position: 1,
      title: "Освоить основу",
      skill: "Python",
      mandatory: true,
      status: "submitted",
      ref: "checkpoint:foundation",
    },
    {
      key: "practice",
      position: 2,
      title: "Применить на практике",
      skill: "Проектная работа",
      mandatory: true,
      status: "unknown",
      ref: "checkpoint:practice",
    },
  ],
};

describe("monthly goal card (openspec 24.6)", () => {
  it("keeps current separate from an unverified projected checkpoint", () => {
    render(<MonthlyGoalDiagram goal={goal} />);
    expect(screen.getByText(/Текущий:/).textContent).toContain("0");
    expect(screen.getByText(/Прогноз:/).textContent).toContain("1");
    expect(screen.getByText(/Цель:/).textContent).toContain("2");
  });

  it("shows time risk, deficit, partial coverage and calculation assumptions", () => {
    render(
      <MonthlyGoalBody
        state="success"
        goal={goal}
        claiming={false}
        onClaim={() => undefined}
      />,
    );
    expect(screen.getByText(/дефицит 1 день/)).toBeInTheDocument();
    expect(screen.getByText(/покрытие 50%/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Как считается прогноз"));
    expect(screen.getByText(/только после проверки evidence/)).toBeInTheDocument();
    expect(screen.getByText(/Ожидает проверки/)).toBeInTheDocument();
  });

  it("requires an explicit click before claiming a recommended goal", () => {
    const onClaim = vi.fn();
    render(
      <MonthlyGoalBody
        state="success"
        goal={null}
        claiming={false}
        onClaim={onClaim}
      />,
    );
    expect(onClaim).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Поставить рекомендованную цель" }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });
});
