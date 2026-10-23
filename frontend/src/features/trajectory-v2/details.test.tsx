import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { overviewFixture } from "../participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import { StageTaskDrawer } from "./details";
import { TrajectoryV2Body } from "./page";
import type { RoadmapView } from "./client";

const rolesFixture: DevelopmentOverviewView["roles"] = [
  {
    track_key: "python",
    title: "Python-разработчик",
    state: "active",
    attempt_number: 2,
    completed_milestones: 1,
    total_milestones: 2,
  },
  {
    track_key: "data",
    title: "Data-аналитик",
    state: "paused",
    attempt_number: 1,
    completed_milestones: 0,
    total_milestones: 3,
  },
  {
    track_key: "product",
    title: "Продакт-менеджер",
    state: "unselected",
    attempt_number: null,
    completed_milestones: 0,
    total_milestones: 4,
  },
];

const roadmapFixture: RoadmapView = {
  track_key: "python",
  policy_version: 1,
  replacement_reason: null,
  milestones: [
    {
      key: "foundation",
      position: 1,
      title: "Фундамент",
      purpose: "База языка",
      skill: "python-core",
      target_kind: "course",
      target_key: "python-base",
      completed: true,
    },
    {
      key: "api",
      position: 2,
      title: "API и сервисы",
      purpose: "Сервисный слой",
      skill: "python-web",
      target_kind: "course",
      target_key: "python-api",
      completed: false,
    },
    {
      key: "capstone",
      position: 3,
      title: "Итоговый проект",
      purpose: "Комплексный проект",
      skill: "python-project",
      target_kind: "task",
      target_key: "demo-task-1",
      completed: false,
    },
  ],
  next_step: null,
};

const roadmapWithNext: RoadmapView = {
  ...roadmapFixture,
  next_step: roadmapFixture.milestones[1] ?? null,
};

const productRoadmap: RoadmapView = {
  ...roadmapFixture,
  track_key: "product",
  milestones: roadmapFixture.milestones.map((m) => ({ ...m, key: `product-${m.key}` })),
};

function shell(url: string, roadmaps: RoadmapView[]): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(roadmaps), { status: 200 })),
  );
  const overview: DevelopmentOverviewView = { ...overviewFixture, roles: rolesFixture };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/workspace/:section" element={<TrajectoryV2Body overview={overview} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trajectory v2 task/evidence drawer", () => {
  it("opens from the stage with server-derived facts and a course continuation", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    fireEvent.click(await screen.findByRole("button", { name: "Подробнее об этапе" }));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    expect(drawer.textContent).toContain("Сейчас · Курс · python-api");
    expect(drawer.textContent).toContain("Сервисный слой");
    expect(drawer.textContent).toContain("Раздел не публикуется в снимке");
    expect(drawer.textContent).toContain("Навык: python-web");
    expect(drawer.textContent).toContain("Этап не завершён");
    expect(
      within(drawer).getByRole("button", { name: "Открыть курс" }),
    ).toHaveAttribute("type", "button");
  });

  it("closes on Escape and restores focus to the initiating task trigger", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    const trigger = await screen.findByRole("button", { name: "Подробнее об этапе" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-drawer-overlay")).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Детали этапа" }), {
      key: "Escape",
    });
    await waitFor(() => {
      expect(screen.queryByTestId("trajectory-drawer-overlay")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps Tab cycling inside the drawer", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    fireEvent.click(await screen.findByRole("button", { name: /Фундамент/ }));
    const open = screen.getByRole("button", { name: "Подробнее об этапе" });
    open.focus();
    fireEvent.click(open);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-drawer-overlay")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    const continueButton = within(drawer).getByRole("button", { name: /Открыть/ });
    continueButton.focus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(document.activeElement).toBe(within(drawer).getByRole("button", { name: "Закрыть" }));
    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("trajectory-drawer-overlay")).toBeNull();
    });
  });

  it("keeps role/stage context for an unselected role without inert actions", async () => {
    shell("/workspace/1?role=product", [roadmapWithNext, productRoadmap]);
    fireEvent.click(await screen.findByRole("button", { name: "Подробнее об этапе" }));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(
      drawer.textContent,
    ).toContain(
      "Роль не выбрана: доступ к цели появится после входа в каталог траекторий",
    );
    expect(within(drawer).queryByRole("button", { name: /Открыть/ })).toBeNull();
  });

  it("labels task continuation as result for a completed stage", () => {
    const milestone: NonNullable<RoadmapView["milestones"][number]> = {
      key: "capstone",
      position: 3,
      title: "Итоговый проект",
      purpose: "Комплексный проект",
      skill: "python-project",
      target_kind: "task",
      target_key: "demo-task-1",
      completed: true,
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/workspace/1"]}>
          <Routes>
            <Route
              path="/workspace/:section"
              element={
                <StageTaskDrawer
                  milestone={milestone}
                  state="completed"
                  role={rolesFixture[0] as NonNullable<DevelopmentOverviewView["roles"][number]>}
                  policyVersion={1}
                  onClose={() => {}}
                  triggerRef={{ current: null }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(drawer.textContent).toContain("Задача · demo-task-1");
    expect(drawer.textContent).toContain("Открыть результат");
  });
});

describe("trajectory v2 role info dialog", () => {
  it("shows six keyboard-operable sections with the snapshot version", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    fireEvent.click(await screen.findByRole("button", { name: "Подробнее о роли" }));
    const dialog = screen.getByRole("dialog", { name: "Роль: Python-разработчик" });
    expect(dialog.textContent).toContain("Дорожная карта v1");
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    fireEvent.click(screen.getByRole("tab", { name: "Компетенции" }));
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe("trajectory-role-tab-competencies");
    expect(panel.textContent).toContain("python-core");
    expect(panel.textContent).toContain("python-project");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Компетенции" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Представительные задачи" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Представительные задачи" }),
    );
  });

  it("describes honest entry state for an unselected role", async () => {
    shell("/workspace/1?role=product", [roadmapWithNext, productRoadmap]);
    fireEvent.click(await screen.findByRole("button", { name: "Подробнее о роли" }));
    fireEvent.click(screen.getByRole("tab", { name: "Вход и переходы" }));
    expect(screen.getByRole("tabpanel").textContent).toContain("Вход — через каталог траекторий");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Роль: Продакт-менеджер" }), {
      key: "Escape",
    });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
