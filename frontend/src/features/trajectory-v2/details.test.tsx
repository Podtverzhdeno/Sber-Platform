import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, getByRole, queryByRole, getAllByRole, getByText } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function RouteProbe() {
  const location = useLocation();
  return <span data-testid="route-probe">{location.pathname}{location.search}</span>;
}

const DEFAULT_NAVIGATION = ["Главная", "Мой путь", "Bootcamp", "Задачи", "Аналитика"];

function shell(url: string, roadmaps: RoadmapView[], navigation = DEFAULT_NAVIGATION): void {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
    Promise.resolve(new Response(
      JSON.stringify((typeof input === "string" ? input : input instanceof URL ? input.href : input.url) === "/api/v1/me" ? { navigation } : roadmaps),
      { status: 200 },
    )),
  );
  const overview: DevelopmentOverviewView = { ...overviewFixture, roles: rolesFixture };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/workspace/:section" element={<><TrajectoryV2Body overview={overview} /><RouteProbe /></>} />
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
    fireEvent.click(await waitFor(() => getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ })));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    expect(drawer.textContent).toContain("Курс · python-api");
    expect(drawer.textContent).toContain("Сервисный слой");
    expect(drawer.textContent).toContain("не публикуются");
    expect(drawer.textContent).toContain("python-web");
    expect(drawer.textContent).toContain("Этап ещё не завершён");
    expect(
      await waitFor(() => getByRole(drawer, "button", { name: "Открыть курс" })),
    ).toHaveAttribute("type", "button");
  });


  it("uses the authenticated role navigation rather than hard-coded workspace indexes", async () => {
    shell("/workspace/1", [roadmapWithNext], ["Главная", "Задачи", "Мой путь", "Bootcamp"]);
    fireEvent.click(await waitFor(() => getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ })));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    fireEvent.click(await waitFor(() => getByRole(drawer, "button", { name: "Открыть курс" })));
    expect(screen.getByTestId("route-probe")).toHaveTextContent("/workspace/3?course=python-api");
  });

  it("does not offer navigation to a section absent from the authorized role", async () => {
    shell("/workspace/1", [roadmapWithNext], ["Главная", "Мой путь", "Задачи"]);
    fireEvent.click(await waitFor(() => getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ })));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(await waitFor(() => getByText(drawer, "Раздел «Bootcamp» недоступен для текущей роли."))).toBeInTheDocument();
    expect(queryByRole(drawer, "button", { name: "Открыть курс" })).toBeNull();
  });

  it("closes on Escape and restores focus to the initiating task trigger", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    const trigger = await waitFor(() => getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ }));
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
    const open = getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ });
    open.focus();
    fireEvent.click(open);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-drawer-overlay")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    const continueButton = await waitFor(() => getByRole(drawer, "button", { name: /Открыть/ }));
    continueButton.focus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(document.activeElement).toBe(getAllByRole(drawer, "button", { name: "Закрыть" })[0]);
    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("trajectory-drawer-overlay")).toBeNull();
    });
  });

  it("keeps role/stage context for an unselected role without inert actions", async () => {
    shell("/workspace/1?role=product", [roadmapWithNext, productRoadmap]);
    fireEvent.click(await waitFor(() => getByRole(screen.getByTestId("trajectory-stage-detail"), "button", { name: /Продолжить|Посмотреть/ })));
    const drawer = screen.getByRole("dialog", { name: "Детали этапа" });
    expect(
      drawer.textContent,
    ).toContain(
      "Роль не выбрана: доступ к цели появится после входа в каталог траекторий",
    );
    expect(queryByRole(drawer, "button", { name: /Открыть/ })).toBeNull();
  });

  it("labels task continuation as result for a completed stage", async () => {
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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ navigation: DEFAULT_NAVIGATION }), { status: 200 }),
    );
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
    const drawer = screen.getByRole("dialog", { name: "✓ Этап пройден" });
    expect(drawer.textContent).toContain("Задача · demo-task-1");
    expect(await waitFor(() => getByRole(drawer, "button", { name: "Открыть результат" }))).toBeVisible();
  });
});

describe("trajectory v2 role info dialog", () => {
  it("shows six keyboard-operable sections with the snapshot version", async () => {
    shell("/workspace/1", [roadmapWithNext]);
    fireEvent.click(await screen.findByRole("button", { name: "О роли →" }));
    const dialog = screen.getByRole("dialog", { name: "Python-разработчик" });
    expect(dialog.textContent).toContain("Дорожная карта v1");
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    fireEvent.click(screen.getByRole("tab", { name: "Компетенции" }));
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe("trajectory-role-tab-competencies");
    expect(panel.textContent).toContain("python-core");
    expect(panel.textContent).toContain("python-project");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Компетенции" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Примеры задач" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Примеры задач" }),
    );
  });

  it("describes honest entry state for an unselected role", async () => {
    shell("/workspace/1?role=product", [roadmapWithNext, productRoadmap]);
    fireEvent.click(await screen.findByRole("button", { name: "О роли →" }));
    fireEvent.click(screen.getByRole("tab", { name: "Кому подойдёт" }));
    expect(screen.getByRole("tabpanel").textContent).toContain("Вход — через каталог траекторий");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Продакт-менеджер" }), {
      key: "Escape",
    });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
