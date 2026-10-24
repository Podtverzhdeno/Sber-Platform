import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { overviewFixture } from "../../participant-home-v2/fixture";
import type { RoadmapView, RoleCardView } from "../client";
import { SourceTrajectoryLayout } from "./source-layout";

const roles: RoleCardView[] = [
  { track_key: "product", title: "Продуктовый аналитик", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 3 },
  { track_key: "ml", title: "ML-инженер", state: "paused", attempt_number: 1, completed_milestones: 1, total_milestones: 2 },
  { track_key: "data", title: "Аналитик данных", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
];

const roadmap: RoadmapView = {
  track_key: "product",
  policy_version: 1,
  replacement_reason: null,
  milestones: [
    { key: "intro", position: 1, title: "База и основы", purpose: "База", skill: "Бизнес-анализ", target_kind: "course", target_key: "course-1", completed: true },
    { key: "hypotheses", position: 2, title: "Продуктовые гипотезы", purpose: "Проверить гипотезы", skill: "Продукт", target_kind: "task", target_key: "task-1", completed: false },
    { key: "project", position: 3, title: "Реальный проект", purpose: "Практика", skill: "Продукт", target_kind: "task", target_key: "task-2", completed: false },
  ],
  next_step: { key: "hypotheses", position: 2, title: "Продуктовые гипотезы", purpose: "Проверить гипотезы", skill: "Продукт", target_kind: "task", target_key: "task-1", completed: false },
};

function renderSource(options: { grade?: typeof overviewFixture.concepts.career_grade; stageTasks?: [] } = {}) {
  const onOpenTask = vi.fn();
  const onSelectRole = vi.fn();
  render(<SourceTrajectoryLayout
    roles={roles}
    selectedRoleKey="product"
    primaryRoleKey="product"
    roadmap={roadmap}
    selectedStageKey="hypotheses"
    grade={options.grade ?? overviewFixture.concepts.career_grade}
    nextOutcome={overviewFixture.next_outcome}
    competencies={[]}
    stageTasks={options.stageTasks}
    onSelectRole={onSelectRole}
    onSelectStage={vi.fn()}
    onOpenRole={vi.fn()}
    onOpenActions={vi.fn()}
    onOpenGrades={vi.fn()}
    onOpenTask={onOpenTask}
    onOpenNext={vi.fn()}
    onOpenPassport={vi.fn()}
  />);
  return { onOpenTask, onSelectRole };
}

describe("source-first trajectory layout", () => {
  it("preserves source DOM hierarchy and actual number of roles", () => {
    renderSource();
    expect(screen.getByRole("region", { name: "Профессиональные роли" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Продуктовый аналитик|ML-инженер|Аналитик данных/ })).toHaveLength(3);
    expect(screen.getByRole("complementary", { name: "Грейд и компетенции" })).toBeInTheDocument();
    expect(screen.getByText("Путь освоения роли")).toBeInTheDocument();
    const path = screen.getByRole("list", { name: "Этапы развития роли" });
    expect(within(path).getAllByRole("listitem")).toHaveLength(7);
    expect(within(path).getAllByText("Не опубликован")).toHaveLength(4);
    expect(within(path).getAllByRole("button")).toHaveLength(3);
    expect(path.getAttribute("style")).toContain("--completed-width: 17%");
    const stage = screen.getByRole("region", { name: "Этап выбранной роли" });
    expect(within(stage).getByRole("heading", { name: "Продуктовые гипотезы" })).toBeInTheDocument();
  });

  it("does not invent grade numbers, XP, verified tasks or skill levels", () => {
    renderSource();
    expect(screen.getByText("Грейд —")).toBeInTheDocument();
    expect(screen.getByText("Проверяем")).toBeInTheDocument();
    expect(screen.getByText(/детализация отдельных заданий пока недоступна/)).toBeInTheDocument();
    expect(screen.queryByText(/150 XP|88%|12%|Грейд 5/)).not.toBeInTheDocument();
  });

  it("keeps the roadmap target actionable when the authorized work list is empty", () => {
    renderSource({ stageTasks: [] });
    expect(screen.getByRole("button", { name: /Продолжить/ })).toBeInTheDocument();
    expect(screen.getByText(/Показана цель этапа из дорожной карты/)).toBeInTheDocument();
  });

  it("routes the authorized roadmap goal through callback, never performs a fake completion", () => {
    const { onOpenTask, onSelectRole } = renderSource();
    fireEvent.click(screen.getByRole("button", { name: /Продолжить/ }));
    expect(onOpenTask).toHaveBeenCalledWith("hypotheses");
    fireEvent.click(screen.getByRole("button", { name: /Аналитик данных/ }));
    expect(onSelectRole).toHaveBeenCalledWith("data");
  });
});
