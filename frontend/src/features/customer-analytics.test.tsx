import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api/client";
import { CustomerAnalytics } from "./customer-analytics";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const priorWeek = new Date(Date.now() - 8*86_400_000).toISOString();
const ownedTask = { id: "project-a", title: "Поиск научных статей", status: "in_progress" };
const activity = {
  generated_at: new Date().toISOString(),
  window_days: 84,
  events: [
    { id: "created:a", task_id: "project-a", task_title: ownedTask.title, kind: "project_created", occurred_at: priorWeek },
    { id: "accepted:b", task_id: "project-a", task_title: ownedTask.title, kind: "result_accepted", occurred_at: yesterday },
  ],
};

function renderDashboard(mockActivity: unknown = activity) {
  vi.mocked(apiRequest).mockImplementation(async path => {
    await Promise.resolve();
    if (path === "/api/v1/customer/tasks") return [ownedTask];
    if (path === "/api/v1/customer/analytics/activity") return mockActivity;
    throw new Error("Unexpected URL");
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>
    <CustomerAnalytics navigation={["Главная", "Мои задачи", "Аналитика"]}/>
  </MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { vi.resetAllMocks(); });

describe("customer activity dashboard", () => {
  it("renders only Activity with verified events, no redundant analytics tabs", async () => {
    renderDashboard();
    expect(await screen.findByText("Активность заказчика")).toBeVisible();
    expect(screen.queryByRole("tab", {name:"Результаты"})).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", {name:"Проекты"})).not.toBeInTheDocument();
    expect(screen.queryByText("1 840")).not.toBeInTheDocument();
    const heatmap = document.querySelectorAll(".ca3-heat-cell");
    expect(heatmap.length).toBe(56);
    expect(screen.getByRole("region",{name:"Дни активности заказчика, горизонтальная прокрутка"})).toBeVisible();
    expect(screen.getByText(/Один квадрат — один день/)).toBeVisible();
    expect((await screen.findAllByText("Поиск научных статей")).length).toBeGreaterThan(0);
  });

  it("updates the calendar cell count when selecting four weeks", async () => {
    renderDashboard();
    await screen.findByText("Активность заказчика");
    fireEvent.change(screen.getByRole("combobox", {name:"Период аналитики заказчика"}),{target:{value:"4"}});
    expect(document.querySelectorAll(".ca3-heat-cell").length).toBe(28);
    expect(screen.getByText("Последние 4 недели · чем ярче ячейка, тем больше событий в проектах")).toBeVisible();
  });

  it("filters event categories and lets a customer inspect a day", async () => {
    renderDashboard();
    await screen.findAllByText("Поиск научных статей");
    fireEvent.change(screen.getByRole("combobox", {name:"Тип событий"}),{target:{value:"decisions"}});
    const cells = document.querySelectorAll<HTMLButtonElement>(".ca3-heat-cell");
    const populated = Array.from(cells).find(cell=>cell.getAttribute("aria-label")?.includes("1 событий"));
    expect(populated).toBeDefined();
    if (!populated) throw new Error("Missing recorded activity cell");
    fireEvent.mouseEnter(populated);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("1 событий");
    fireEvent.click(populated);
    const dialog=screen.getByRole("dialog",{name:/Активность/});
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent("Результат принят");
    expect(dialog).toHaveTextContent(ownedTask.title);
    expect(dialog).toHaveTextContent("Часы работы не вычисляются");
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render invented counts when history cannot load", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
    await Promise.resolve();
      if (path === "/api/v1/customer/tasks") return [ownedTask];
      throw new Error("API not available");
    });
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><MemoryRouter><CustomerAnalytics/></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Часть данных недоступна");
    expect(screen.getByText("● Источник не загружен")).toBeVisible();
    expect(screen.queryByText("1 840")).not.toBeInTheDocument();
  });
});
