import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api/client";
import { CustomerAnalytics } from "./customer-analytics";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const sampleTasks = [
  { id: "project-a", title: "Поиск научных статей", status: "in_progress", places: 2,
    application_count: 7, assignment_count: 2, pending_result_count: 1, accepted_result_count: 0,
    deadline_at: "2026-11-01T00:00:00Z" },
  { id: "project-b", title: "Обработка документов", status: "draft", places: 1,
    application_count: 0, assignment_count: 0, pending_result_count: 0, accepted_result_count: 0,
    deadline_at: null },
];
const period = { period_start: "2026-09-25T00:00:00Z", period_end: "2026-10-25T00:00:00Z", cohort: "test:customer:30d", freshness: "fresh" };
const apiMetrics = [
  { ...period, key: "customer_applications", label: "Заявки на задачи", numerator: 7,
    denominator: 1, value: "7", unit: "count", definition: "Заявки на собственные задачи.", suppressed: false, suppression_reason: null },
  { ...period, key: "customer_active_people", label: "Назначенные участники", numerator: 2,
    denominator: 1, value: "2", unit: "count", definition: "Уникальные назначения.", suppressed: false, suppression_reason: null },
  { ...period, key: "customer_acceptance_rate", label: "Доля принятых", numerator: 1,
    denominator: 2, value: null, unit: "percent", definition: "Принятые решения.", suppressed: true, suppression_reason: "cohort_below_5" },
  { ...period, key: "customer_revisions", label: "Доработки", numerator: 1,
    denominator: 1, value: "1", unit: "count", definition: "Запросы доработки.", suppressed: false, suppression_reason: null },
];
function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>
    <CustomerAnalytics navigation={["Главная", "Мои задачи", "Приёмка", "База участников"]}/>
  </MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiRequest).mockImplementation(async path => {
    await Promise.resolve();
    if (path === "/api/v1/customer/tasks") return sampleTasks;
    if (path === "/api/v1/analytics/role") return { role: "customer", metrics: apiMetrics };
    throw new Error("Unexpected route");
  });
});
describe("customer analytics from API evidence", () => {
  it("shows actual owned tasks and no fixed mock platform totals", async () => {
    renderDashboard();
    expect(await screen.findByText("Результаты под контролем")).toBeInTheDocument();
    expect(await screen.findByText("Поиск научных статей")).toBeInTheDocument();
    expect(screen.queryByText("1 840")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", {name:"Обзор"})).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", {name:"Активность"})).toBeVisible();
  });
  it("filters task table by status and updates the detail panel", async () => {
    renderDashboard();
    await screen.findAllByText("Поиск научных статей");
    fireEvent.click(screen.getByRole("tab", {name:"Проекты"}));
    fireEvent.change(screen.getByRole("combobox", {name:"Фильтр статуса"}), { target: { value: "draft" } });
    const table = screen.getByRole("table", {name:"Показатели проектов"});
    expect(within(table).getByText("Обработка документов")).toBeVisible();
    expect(within(table).queryByText("Поиск научных статей")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", {name:"Обработка документов"})).toBeVisible();
  });
  it("does not reveal a suppressed acceptance percentage", async () => {
    renderDashboard();
    await screen.findAllByText("Поиск научных статей");
    fireEvent.click(screen.getByRole("tab", {name:"Результаты"}));
    expect(screen.getByText("Доля решений о приёмке").previousElementSibling).toHaveTextContent("—");
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
  });
});
