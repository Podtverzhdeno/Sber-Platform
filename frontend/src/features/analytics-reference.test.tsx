import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AnalyticsReference } from "./analytics-reference";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const roleSkills = ["prompting", "prompt_engineering", "context_management", "tools_mcp", "creating_skills", "agents_team"].map((key, i) => ({
  key, title: key, target_level: [3, 4, 3, 2, 3, 2][i], current_level: null,
  evidence_count: 0, data_state: "unknown", unresolved_methodology: false,
}));
const profile = {
  role_key: "developer", role_title: "Разработчик", profile_scope: "impulse_learning",
  scale_key: "agentic_coding_1_4", framework_version: "agentic-coding-source-map-2026-10-23",
  as_of: "2026-10-24T09:00:00Z", certification_state: "not_connected",
  certification_reason: "No issuer", known_evidence_count: 0, data_origin: "source_map", skills: roleSkills,
};
const snapshot = {
  snapshot_id: "ref-2026", generated_at: "2026-10-24T12:00:00Z", actor_timezone: "Europe/Moscow",
  freshness: { known: true, latest_observed_at: null }, trajectories: [], events: [],
};
const journey = { stages: [{ key: "verified_experience", title: "Принятые результаты", count: 0, status: "not_started" }],
  generated_at: "2026-10-24T12:00:00Z", successful: false, next_action: "Продолжить" };
function mockApi(skills = roleSkills) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (path.includes("/agentic-coding/profile")) return { ...profile, skills };
    if (path.includes("/growth/snapshot")) return snapshot;
    if (path.includes("/analytics/journey")) return journey;
    throw new Error("unexpected endpoint " + path);
  });
}
function open(url = "/workspace/9", skills = roleSkills) {
  vi.clearAllMocks(); mockApi(skills);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>
    <AnalyticsReference navigation={["Главная", "Моя траектория", "Задачи", "Аналитика"]} />
  </MemoryRouter></QueryClientProvider>);
}

describe("three canonical analytics reference layouts", () => {
  it("renders the first PNG composition by default with four KPIs and two-column passport", async () => {
    const { container } = open();
    expect(screen.getByRole("heading", { name: "Ваш Skill Passport" })).toBeInTheDocument();
    expect(container.querySelectorAll(".ref-kpi")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Матрица навыков Agentic Coding" })).toBeInTheDocument();
    expect(container.querySelector(".ref-passport")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Последние подтверждения" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Развитие за 3 месяцев" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Подтверждённых уровней пока нет/)).toBeInTheDocument());
    expect(screen.getAllByText(/официальный|корпоративный/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Нет достаточной истории цифровых следов/)).toBeInTheDocument();
    expect(container.querySelector(".ref-kpi")?.textContent).not.toContain("81%");
  });

  it("changes between the three exact structural compositions", async () => {
    const { container } = open();
    fireEvent.click(screen.getByRole("button", { name: "Мой маршрут" }));
    expect(screen.getByRole("heading", { name: "Маршрут к вашей следующей цели" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /навыка до целевого профиля|Открытые требования/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "История подтверждения" })).toBeInTheDocument();
    expect(container.querySelector(".ref-route-steps")?.children).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Результаты", exact: true }));
    expect(screen.getByRole("heading", { name: "Результаты, которым можно доверять" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Каждый уровень — с доказательством" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Как копятся цифровые доказательства" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Результаты и навыки" })).toBeInTheDocument();
    expect(container.querySelector(".ref-kpis")).toBeInTheDocument();
  });

  it("switches roles, chart type and period without manufacturing competency evidence", async () => {
    const { container } = open();
    await screen.findByText(/Данные 24.10.2026/);
    fireEvent.click(within(screen.getByRole("group", { name: "Профессиональная группа" })).getByRole("button", { name: "Аналитик" }));
    expect(screen.getAllByText(/Цель уточняется|Нет данных/).length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole("group", { name: "Вид диаграммы" })).getByRole("button", { name: "Гистограмма" }));
    expect(container.querySelector(".ref-skill-bars")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Вид диаграммы" })).getByRole("button", { name: "Тренд" }));
    expect(screen.getByText(/Нет достаточной истории цифровых следов/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Период аналитики" }), { target: { value: "8" } });
    expect(screen.getByRole("heading", { name: "Развитие за 8 месяцев" })).toBeInTheDocument();
  });

  it("shows target rather than fake 3/6 when current levels are unverified", async () => {
    open();
    await screen.findByText(/Данные 24.10.2026/);
    expect(screen.getAllByText(/Нет данных/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Нет подтверждённых уровней|Нет подтверждений/)).toBeInTheDocument();
    expect(screen.queryByText("81%")).not.toBeInTheDocument();
  });

  it("opens per-skill details and certification terms without issuing a badge", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Постановка задач агенту/ }));
    expect(screen.getByRole("dialog", { name: /Подтверждение навыка/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть Skill Passport ↗" }));
    expect(screen.getByRole("dialog", { name: "Условия Agentic Coding L1" })).toBeInTheDocument();
    expect(screen.getByText(/не официальный сертификат/i)).toBeInTheDocument();
  });
});
