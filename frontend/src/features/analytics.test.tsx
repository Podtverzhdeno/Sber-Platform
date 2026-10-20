import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrajectoryGrowthAnalytics } from "./analytics";

const snapshot = {
  snapshot_id: "growth-safe",
  generated_at: "2026-10-20T10:00:00Z",
  actor_timezone: "Europe/Moscow",
  freshness: { known: true, latest_observed_at: "2026-10-20T09:00:00Z" },
  trajectories: [
    {
      track_key: "python",
      track_title: "Python-разработчик",
      policy_version: 7,
      completion: { percent: 50, coverage: 1, partial: false },
      readiness: { percent: null, coverage: 0.5, partial: true },
      readiness_skills: [
        { skill_key: "api", title: "Проектирование API", current_level: "базовый", target_level: "уверенный", known: true },
        { skill_key: "tests", title: "Автоматические тесты", current_level: "не подтверждено", target_level: "уверенный", known: false },
      ],
    },
    {
      track_key: "data",
      track_title: "Инженер данных",
      policy_version: 4,
      completion: { percent: 100, coverage: 1, partial: false },
      readiness: { percent: 100, coverage: 1, partial: false },
      readiness_skills: [
        { skill_key: "pipelines", title: "Data pipelines", current_level: "уверенный", target_level: "уверенный", known: true },
        { skill_key: "quality", title: "Качество данных", current_level: "уверенный", target_level: "уверенный", known: true },
      ],
    },
  ],
};

describe("trajectory growth analytics", () => {
  it("keeps partial and unknown values distinct from zero and explains contour colors", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("Недостаточно данных");
    expect(screen.getByRole("status")).toHaveTextContent("Неизвестные уровни не заменены нулём");
    expect(screen.getByText("Сейчас: нет подтверждённых данных")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/жёлтая цель, красный дефицит, зелёный достигнутый уровень, серый неизвестный уровень/);
    expect(container.querySelector(".growth-deficit-fill")).toBeInTheDocument();
    expect(container.querySelector(".growth-unknown-fill")).toBeInTheDocument();
  });

  it("switches trajectories without mixing their skill scales", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Траектория"), { target: { value: "data" } });
    expect(screen.getAllByText("Data pipelines").length).toBeGreaterThan(0);
    expect(screen.queryByText("Проектирование API")).not.toBeInTheDocument();
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("100%");
    expect(container.querySelector(".growth-achieved")).toBeInTheDocument();
    expect(container.querySelector(".growth-deficit")).not.toBeInTheDocument();
  });
});
