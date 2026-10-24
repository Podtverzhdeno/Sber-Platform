import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { overviewFixture } from "../participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import type { RoadmapView } from "../trajectory-v2/client";
import { TrajectoryRedesignBody } from "./page";

const roles: DevelopmentOverviewView["roles"] = [
  { track_key: "python", title: "Python-разработчик", state: "active", attempt_number: 2, completed_milestones: 1, total_milestones: 3 },
  { track_key: "product", title: "Продакт-менеджер", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 2 },
];

const milestones: RoadmapView["milestones"] = [
  { key: "foundation", position: 1, title: "Базовые навыки", purpose: "Изучить основы", skill: "Python", target_kind: "course", target_key: "intro", completed: true },
  { key: "project", position: 2, title: "Практика в команде", purpose: "Решить реальную задачу", skill: "API", target_kind: "task", target_key: "api-task", completed: false },
  { key: "review", position: 3, title: "Проверка результата", purpose: "Защитить решение", skill: "Review", target_kind: "task", target_key: "review-task", completed: false },
];
const roadmaps: RoadmapView[] = [
  { track_key: "python", policy_version: 2, replacement_reason: null, milestones, next_step: milestones[1] ?? null },
  { track_key: "product", policy_version: 2, replacement_reason: null, milestones: milestones.slice(0, 1), next_step: milestones[0] ?? null },
];

const checkpoints = milestones.map((step, index) => ({
  ...step,
  state: index === 0 ? "COMPLETED" : index === 1 ? "CURRENT" : "LOCKED",
  state_label: index === 0 ? "Пройден" : index === 1 ? "Текущий шаг" : "Заблокирован",
  mandatory: true,
  actionable: index === 1,
  points_available: 20,
  points_earned: index === 0 ? 20 : 0,
  points_rule: "После проверки",
  policy_version: 2,
  locked_reasons: index === 2 ? [{ milestone_key: "project", title: "Практика в команде", ref: "checkpoint:project" }] : [],
  branch: null,
}));
const map = [{ track_key: "python", policy_version: 2, replacement_reason: null, current_key: "project",
  checkpoints, progress: { completed_mandatory: 1, total_mandatory: 3, percent: 33 } }];

function renderPage(path = "/workspace/1", data: DevelopmentOverviewView = { ...overviewFixture, roles }) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/trajectory-map/checkpoints/")) return Promise.resolve(new Response(JSON.stringify({
      checkpoint: checkpoints[2],
      goal: "Защитить решение",
      outcome: "Проверенный результат",
      prerequisites: [],
      evidence_refs: [],
      skill_impact: { skill: "Review", current_level: "не подтверждено", target_level: "базовый",
        projected_level: null, forecast_only: true, explanation: "После проверки", missing_evidence: [], fallback: null },
      replay: false,
      policy_version: 2,
    }), { status: 200 }));
    if (url.endsWith("/trajectory-map")) return Promise.resolve(new Response(JSON.stringify(map), { status: 200 }));
    if (url.endsWith("/development/roadmap-catalog")) return Promise.resolve(new Response(JSON.stringify(
      roadmaps.map((item) => ({
        ...item,
        milestones: item.milestones.map((step) => ({ ...step, completed: false })),
        next_step: null,
      })),
    ), { status: 200 }));

    if (url.endsWith("/growth/snapshot")) return Promise.resolve(new Response(JSON.stringify({ trajectories: [] }), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify(roadmaps), { status: 200 }));
  });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/workspace/:id" element={<TrajectoryRedesignBody overview={data} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe("trajectory redesign", () => {
  it("uses server role progress and does not invent a career grade", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Моя траектория" })).toBeInTheDocument();
    expect(screen.getByTestId("trajectory-role-detail")).toHaveTextContent("Python-разработчик");
    expect(screen.getByTestId("trajectory-role-detail")).toHaveTextContent("пройдено 1 из 3");
    expect(screen.getByTestId("trajectory-grade-summary")).toHaveTextContent("Каталог грейдов ещё не утверждён");
    expect(await screen.findByTestId("trajectory-stages")).toBeInTheDocument();
    expect(screen.getAllByTestId("trajectory-role-card")).toHaveLength(2);
  });

  it("shows an unselected role in muted state without fabricated progress", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Продакт-менеджер/ }));
    await waitFor(() => expect(screen.getByTestId("trajectory-role-detail")).toHaveAttribute("data-role-key", "product"));
    expect(screen.getByTestId("trajectory-role-detail")).toHaveTextContent("Познакомьтесь с направлением");
    expect(screen.getByTestId("trajectory-role-detail")).not.toHaveTextContent("пройдено 1 из 3");
    expect(screen.getByTestId("trajectory-grade-summary")).toHaveTextContent("Грейд для этой роли не определён");
  });

  it("selects roadmap steps and opens server-derived details", async () => {
    renderPage();
    await screen.findByTestId("trajectory-stages");
    fireEvent.click(within(screen.getByTestId("trajectory-stages")).getByRole("button", { name: /Проверка результата/ }));
    expect(screen.getByTestId("trajectory-stage-detail")).toHaveTextContent("Проверка результата");
    expect(screen.getByTestId("trajectory-stage-detail")).toHaveTextContent("Этап пока закрыт");
    fireEvent.click(screen.getByRole("button", { name: /Этап подробнее/ }));
    expect(screen.getByRole("dialog", { name: "Детали этапа" })).toHaveTextContent("Проверка результата");
  });

  it("opens role information and the provisional all-grades dialog", async () => {
    renderPage();
    await screen.findByTestId("trajectory-stages");
    fireEvent.click(screen.getByRole("button", { name: /О роли/ }));
    expect(screen.getByRole("dialog", { name: /Роль: Python-разработчик/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: /Все уровни/ }));
    expect(screen.getByRole("dialog", { name: "Все уровни" })).toHaveTextContent("Каталог карьерных грейдов пока не опубликован");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть уровни" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows published checkpoints for an unselected role without claiming completed progress", async () => {
    renderPage("/workspace/1?role=product");
    const stages = await screen.findByTestId("trajectory-stages");
    expect(within(stages).getAllByRole("button")).toHaveLength(1);
    expect(stages).toHaveTextContent("В каталоге");
    expect(screen.getByTestId("trajectory-role-detail")).not.toHaveTextContent("1 из 3");
  });

  it("resolves a canonical Buddy checkpoint link to the right stage and opens its details", async () => {
    renderPage("/workspace/1?checkpoint=review");
    await waitFor(() => { expect(screen.getByRole("dialog", { name: "Детали этапа" })).toHaveTextContent("Проверка результата"); });
    expect(screen.getByTestId("trajectory-stage-detail")).toHaveAttribute("data-stage-key", "review");
  });

  it("opens direction selection by focusing an accessible unselected role", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Изменить направления/ }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Продакт-менеджер/ }));
  });

  it("renders an honest empty state when no roles were granted", () => {
    renderPage("/workspace/1", { ...overviewFixture, roles: [] });
    expect(screen.getByText("Роли пока не доступны")).toBeInTheDocument();
  });
});
