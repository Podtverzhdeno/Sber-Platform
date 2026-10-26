import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AnalyticsReference } from "./analytics-reference";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

type ReferenceSkillFixture = {
  key: string; title: string; target_level: number | null; current_level: number | null;
  evidence_count: number; data_state: string; unresolved_methodology: boolean;
};
const roleSkills: ReferenceSkillFixture[] = ["prompting", "prompt_engineering", "context_management", "tools_mcp", "creating_skills", "agents_team"].map((key, i) => ({
  key, title: key, target_level: [3, 4, 3, 2, 3, 2][i] ?? null, current_level: null,
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
function mockApi(skills: ReferenceSkillFixture[] = roleSkills) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    await Promise.resolve();
    if (path.includes("/agentic-coding/profile")) return { ...profile, skills };
    if (path.includes("/growth/snapshot")) return snapshot;
    if (path.includes("/analytics/journey")) return journey;
    if (path.includes("/impulse-study/summary")) return { started_courses: 6, finished_courses: 6, completed_lessons: 56, approved_practices: 1, credited_practices: 2, courses: [] };
    if (path.includes("/me/competency-evidence")) return [{ competency_key: "prompting", source_kind: "project", source_ref: "agent-task-01", level: "базовый", observed_at: "2026-10-24T09:00:00Z", counted: true }];
    throw new Error("unexpected endpoint " + path);
  });
}
function open(url = "/workspace/9", skills: ReferenceSkillFixture[] = roleSkills) {
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
    await waitFor(() => expect(within(screen.getByTestId("reference-personal-facts")).getByText("56")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Последние подтверждения" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Развитие за 8 месяцев" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Подтверждённых уровней пока нет/)).toBeInTheDocument());
    expect(screen.getAllByText(/официальный|корпоративный/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Нет достаточной истории цифровых следов/)).toBeInTheDocument();
    expect(container.querySelector(".ref-kpi")?.textContent).not.toContain("81%");
  });

  it("changes between the three exact structural compositions", () => {
    const { container } = open();
    fireEvent.click(screen.getByRole("button", { name: "Мой маршрут" }));
    expect(screen.getByRole("heading", { name: "Маршрут к вашей следующей цели" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /навыка до целевого профиля|Открытые требования/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "История подтверждения" })).toBeInTheDocument();
    expect(container.querySelector(".ref-route-steps")?.children).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /^Результаты$/ }));
    expect(screen.getByRole("heading", { name: "Результаты, которым можно доверять" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Каждый уровень — с доказательством" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Как копятся цифровые доказательства" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Результаты и навыки" })).toBeInTheDocument();
    expect(container.querySelector(".ref-kpis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Все доказательства ↗" }));
    expect(screen.getByRole("dialog", { name: "Все квалифицированные доказательства Agentic Coding" })).toBeInTheDocument();
  });

  it("switches roles, chart type and period without manufacturing competency evidence", async () => {
    const { container } = open();
    await screen.findByText(/Данные 24.10.2026/);
    fireEvent.click(within(screen.getByRole("group", { name: "Профессиональная группа" })).getByRole("button", { name: "Аналитик" }));
    expect(screen.getAllByText(/Цель уточняется|Нет данных/).length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole("group", { name: "Вид диаграммы" })).getByRole("button", { name: "Гистограмма" }));
    expect(container.querySelector(".ref-skill-bars")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Вид диаграммы" })).getByRole("button", { name: "Тренд" }));
    expect(screen.getAllByText(/Нет достаточной истории цифровых следов/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("combobox", { name: "Период аналитики" }), { target: { value: "3" } });
    expect(screen.getByRole("heading", { name: "Развитие за 3 месяцев" })).toBeInTheDocument();
  });

  it("shows target rather than fake 3/6 when current levels are unverified", async () => {
    open();
    await screen.findByText(/Данные 24.10.2026/);
    expect(screen.getAllByText(/Нет данных/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Нет подтверждённых уровней|Нет подтверждений/)).toBeInTheDocument();
    expect(screen.queryByText("81%")).not.toBeInTheDocument();
  });

  it("shows measured zero of six rather than missing when all low levels are verified", async () => {
    open("/workspace/9", roleSkills.map((skill) => ({ ...skill, current_level: 1, data_state: "verified", evidence_count: 1 })));
    await waitFor(() => { expect(screen.getAllByText("0 / 6").length).toBeGreaterThan(0); });
  });

  it("displays a completed-profile outcome instead of claiming every skill is unverified", async () => {
    open("/workspace/9?view=path", roleSkills.map((skill) => ({
      ...skill,
      current_level: skill.target_level ?? null,
      data_state: "verified",
      evidence_count: 2,
    })));
    await waitFor(() => {
      expect(screen.getByText("Целевой профиль достигнут")).toBeInTheDocument();
    });
    expect(screen.queryByText("Все требования требуют подтверждения")).not.toBeInTheDocument();
  });

  it("opens per-skill details and certification terms without issuing a badge", () => {
    const { container } = open();
    const list = container.querySelector(".ref-skill-list");
    if (list === null) throw new Error("Missing skill list");
    fireEvent.click(within(list as HTMLElement).getByRole("button", { name: /Постановка задач агенту/ }));
    expect(screen.getByRole("dialog", { name: /Подтверждение навыка/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть Skill Passport ↗" }));
    expect(screen.getByRole("dialog", { name: "Условия Agentic Coding L1" })).toBeInTheDocument();
    expect(screen.getByText(/не официальный сертификат/i)).toBeInTheDocument();
  });
  it("renders actual user learning and accepted work inside the radar without inventing a certified level", async () => {
    const { container } = open();
    const summary = await screen.findByTestId("reference-personal-facts");
    await waitFor(() => {
      expect(within(summary).getByText("56")).toBeInTheDocument();
      expect(within(summary).getByText("6")).toBeInTheDocument();
      expect(within(summary).getByText("2")).toBeInTheDocument();
      expect(within(summary).getByText("0")).toBeInTheDocument();
    });
    expect(container.querySelectorAll(".ref-radar circle[fill='#31eaba']")).toHaveLength(0);
    expect(screen.getByText(/реальные действия ниже не являются уровнем Agentic Coding/)).toBeInTheDocument();
    await waitFor(() => { expect(container.querySelector(".ref-skill-activity")?.textContent).toContain("1"); });
    const axis = container.querySelector(".ref-radar-skill");
    expect(axis).toHaveAttribute("aria-label", expect.stringContaining("Зарегистрированных действий по этому навыку: 1"));
    if (axis === null) throw new Error("Accessible skill axis not found");
    fireEvent.click(axis);
    expect(screen.getByText(/agent-task-01/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Подтверждение навыка/ })).toBeInTheDocument();
  });

  it("keeps unknown methodology targets unknown when server explicitly provides null", async () => {
    const custom = roleSkills.map(skill => skill.key === "prompt_engineering" ? { ...skill, target_level: null } : skill);
    const { container } = open("/workspace/9", custom);
    await waitFor(() => { expect(container.querySelector(".ref-radar-skill")?.getAttribute("aria-label")).toContain("Зарегистрированных"); });
    const list = container.querySelector(".ref-skill-list");
    if (!list) throw new Error("Skill list missing");
    const row = within(list as HTMLElement).getByRole("button", { name: /Правила работы агента/ });
    expect(row).toHaveTextContent("—");
  });

});
