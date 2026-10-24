import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { overviewFixture } from "../participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
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

const pythonRoadmap: RoadmapView = {
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
  ],
  next_step: null,
};

const dataRoadmap: RoadmapView = {
  track_key: "data",
  policy_version: 1,
  replacement_reason: null,
  milestones: [
    {
      key: "data-basics",
      position: 1,
      title: "Основы данных",
      purpose: "Стартовый навык",
      skill: "data-sql",
      target_kind: "course",
      target_key: "data-sql",
      completed: false,
    },
    {
      key: "data-model",
      position: 2,
      title: "Моделирование",
      purpose: "Структурный навык",
      skill: "data-model",
      target_kind: "task",
      target_key: "demo-task-1",
      completed: false,
    },
    {
      key: "data-viz",
      position: 3,
      title: "Визуализация",
      purpose: "Отчётные навыки",
      skill: "data-viz",
      target_kind: "course",
      target_key: "data-viz",
      completed: false,
    },
  ],
  next_step: null,
};

function shell(url: string): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify([pythonRoadmap, dataRoadmap]), { status: 200 })),
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

function openActionsMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: "Действия роли" }));
  expect(screen.getByTestId("trajectory-actions-menu")).toBeInTheDocument();
}

function clickMenuItem(name: string): void {
  fireEvent.click(screen.getByRole("menuitem", { name }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  if ("clipboard" in navigator) {
    try {
      Reflect.deleteProperty(navigator, "clipboard");
    } catch {
      // leave as-is when the property cannot be removed
    }
  }
});

describe("trajectory v2 context actions", () => {
  it("pin/unpin completes with visible feedback and keeps localStorage contract", async () => {
    shell("/workspace/1?role=data");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-actions")).toBeInTheDocument();
    });
    openActionsMenu();
    clickMenuItem("Закрепить");
    expect(screen.getByTestId("trajectory-action-status").textContent).toContain("закреплена");
    expect(window.localStorage.getItem("trajectory-v2-pinned")).toBe("data");
    expect(screen.getAllByText("Закреплена")[0]).toBeInTheDocument();
    openActionsMenu();
    clickMenuItem("Открепить");
    expect(screen.getByTestId("trajectory-action-status").textContent).toContain("откреплена");
    expect(window.localStorage.getItem("trajectory-v2-pinned")).toBeNull();
  });

  it("pins reorder role cards to the top of the list", async () => {
    shell("/workspace/1?role=data");
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Data-аналитик/ }).length).toBeGreaterThan(0);
    });
    openActionsMenu();
    clickMenuItem("Закрепить");
    const cards = screen.getAllByTestId("trajectory-role-card");
    expect(cards[0]?.getAttribute("data-role-key")).toBe("data");
  });

  it("compare opens a chooser and renders the shared metric table", async () => {
    shell("/workspace/1");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-actions")).toBeInTheDocument();
    });
    openActionsMenu();
    clickMenuItem("Сравнить роль…");
    expect(screen.getByTestId("trajectory-compare-chooser")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Data-аналитик" }));
    const compare = screen.getByTestId("trajectory-compare");
    expect(compare.textContent).toContain("Python-разработчик");
    expect(compare.textContent).toContain("Data-аналитик");
    expect(compare.textContent).toContain("Этапов в каталоге");
    expect(compare.textContent).toContain("не сворачиваются в одну оценку");
    fireEvent.click(screen.getByRole("button", { name: "Свернуть сравнение" }));
    expect(screen.queryByTestId("trajectory-compare")).toBeNull();
  });

  it("offers no public anonymous share, even when clipboard is available", async () => {
    shell("/workspace/1");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-actions")).toBeInTheDocument();
    });
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    openActionsMenu();
    expect(screen.queryByRole("menuitem", { name: /общедоступную ссылку/ })).toBeNull();
    clickMenuItem("Поделиться внутри Impulse…");
    expect(screen.getByTestId("trajectory-action-status")).toHaveTextContent(
      "Сервис внутреннего обмена пока не подключён",
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("internal share and configure path explain unavailability instead of staying inert", async () => {
    shell("/workspace/1");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-actions")).toBeInTheDocument();
    });
    openActionsMenu();
    clickMenuItem("Поделиться внутри Impulse…");
    expect(screen.getByTestId("trajectory-action-status").textContent).toContain(
      "Сервис внутреннего обмена пока не подключён",
    );
    openActionsMenu();
    clickMenuItem("Настроить путь");
    expect(screen.getByTestId("trajectory-action-status").textContent).toContain(
      "Конфигурирование пути недоступно",
    );
  });

  it("hides unselected roles and brings them back", async () => {
    shell("/workspace/1");
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Продакт-менеджер/ }).length).toBeGreaterThan(0);
    });
    openActionsMenu();
    clickMenuItem("Скрыть не выбранные роли");
    await waitFor(() => {
      expect(screen.queryAllByText("Продакт-менеджер")[0]).toBeUndefined();
    });
    expect(screen.getByTestId("trajectory-action-status").textContent).toContain("Не выбранные роли скрыты");
    openActionsMenu();
    clickMenuItem("Показать не выбранные роли");
    await waitFor(() => {
      expect(screen.getAllByText("Продакт-менеджер").length).toBeGreaterThan(0);
    });
  });

  it("Escape closes the open menu", async () => {
    shell("/workspace/1");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-actions")).toBeInTheDocument();
    });
    openActionsMenu();
    fireEvent.keyDown(screen.getByTestId("trajectory-actions"), { key: "Escape" });
    expect(screen.queryByTestId("trajectory-actions-menu")).toBeNull();
  });
});
