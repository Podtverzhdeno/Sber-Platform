import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ParticipantAnalytics, TrajectoryGrowthAnalytics, VerifiedDocumentsPanel } from "./analytics";
import type { MonthlyGoalView } from "./monthly-goal-client";

const snapshot = {
  snapshot_id: "growth-safe",
  generated_at: "2026-10-20T10:00:00Z",
  actor_timezone: "Europe/Moscow",
  definitions: { readiness: "impulse-growth-readiness-v3", snapshot: "impulse-growth-snapshot-v2" },
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
      track_title: "Data-инженер",
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

const monthlyGoal = {
  policy_version: 1,
  generated_at: "2026-10-20T09:30:00Z",
  track_key: "python",
  track_title: "Python-разработчик",
  goal_title: "Довести ИИ-агентов до уверенного уровня",
  goal_ref: "milestone-ai-agents",
  period_start: "2026-10-01T00:00:00Z",
  period_end: "2026-10-31T23:59:59Z",
  days_left: 9,
  timezone: "Europe/Moscow",
  plan_version: 2,
  history_count: 3,
  steps: [
    { key: "checkpoint-1", position: 1, title: "Пройти checkpoint ИИ-агенты", skill: "ИИ-агенты", mandatory: true, status: "completed", ref: "u-1" },
    { key: "checkpoint-2", position: 2, title: "Сдать второй checkpoint ИИ-агенты", skill: "ИИ-агенты", mandatory: true, status: "available", ref: "u-2" },
  ],
  contours: { baseline: 1, current: 1, projected: 2, target: 3 },
  remaining: 2,
  next_checkpoint: "2026-10-28",
  next_checkpoint_ref: "u-2",
  feasibility: { known: true, capacity_days: 6, required_steps: 6, feasible: true, deficit: 0, text: "План вмещается в ваш ритм." },
  partial_forecast: true,
  coverage: 0.75,
  missing_mappings: [],
  assumptions: ["Проекция требует подтверждения каждого обязательного шага.", "Темп подсчитан по проверяемым фактам."],
} satisfies MonthlyGoalView;

describe("trajectory growth analytics", () => {
  it("keeps partial and unknown values distinct from zero and explains contour colors", () => {
    const baseline = snapshot.trajectories[0];
    if (baseline === undefined) throw new Error("Missing baseline trajectory");
    const radarSnapshot = {
      ...snapshot,
      trajectories: [{
        ...baseline,
        readiness_skills: [
          ...baseline.readiness_skills,
          { skill_key: "ops", title: "Сопровождение", current_level: "базовый", target_level: "уверенный", known: true },
        ],
      }],
    };
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={radarSnapshot} />);
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("Недостаточно данных");
    expect(screen.getByRole("status")).toHaveTextContent("Неизвестные уровни не заменены нулём");
    expect(screen.getByText("Сейчас: нет подтверждённых данных")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/оранжевая пунктирная цель, зелёный текущий уровень, серый неизвестный уровень/);
    expect(container.querySelector(".growth-achieved-fill")).toBeInTheDocument();
    expect(container.querySelector(".growth-unknown-fill")).toBeInTheDocument();
  });

  it("switches trajectories without mixing their skill scales", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Траектория"), { target: { value: "data" } });
    expect(screen.getAllByText("Data pipelines").length).toBeGreaterThan(0);
    expect(screen.queryByText("Проектирование API")).not.toBeInTheDocument();
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("100%");
    expect(container.querySelector(".growth-achieved")).not.toBeInTheDocument();
    expect(screen.getByTestId("trajectory-growth-overview")).toBeInTheDocument();
  });
});

describe("analytics visual integrity with sparse data", () => {
  it("does not render an empty radar when no competency axes exist", () => {
    const baseline = snapshot.trajectories[0];
    if (baseline === undefined) throw new Error("Missing baseline trajectory");
    const empty = {
      ...snapshot,
      trajectories: [{
        ...baseline,
        readiness_skills: [],
        completion: { percent: 100, coverage: 1, partial: false },
        readiness: { percent: 0, coverage: 0, partial: true },
      }],
    };
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={empty} />);
    expect(screen.getByTestId("trajectory-growth-overview")).toBeInTheDocument();
    expect(screen.getByText("Прогресс пути")).toBeInTheDocument();
    expect(screen.getByText("Готовность к роли")).toBeInTheDocument();
    expect(screen.getByText(/Циклограмма появится/)).toBeInTheDocument();
    expect(container.querySelector(".trajectory-growth-radar svg")).not.toBeInTheDocument();
    expect(screen.getByText(/Это не означает, что все навыки равны нулю/)).toBeInTheDocument();
  });

  it("avoids a degenerate radar polygon when the trajectory has only two skills", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    expect(screen.getByTestId("trajectory-growth-overview")).toBeInTheDocument();
    expect(container.querySelector(".trajectory-growth-radar svg")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Подробнее о навыке Проектирование API" })).toBeInTheDocument();
  });
});

describe("trajectory monthly goal projection", () => {
  it("adds the monthly goal forecast with projected contour and checkpoint plan to the selected trajectory", () => {
    render(<TrajectoryGrowthAnalytics snapshot={snapshot} goal={monthlyGoal} />);
    const panel = screen.getByTestId("trajectory-monthly-goal");
    expect(within(panel).getByRole("heading", { name: "Довести ИИ-агентов до уверенного уровня" })).toBeInTheDocument();
    expect(within(panel).getByText("План выполним")).toBeInTheDocument();
    expect(within(panel).getByText("План вмещается в ваш ритм.")).toBeInTheDocument();
    expect(within(panel).getByText(/покрытие 75%/)).toBeInTheDocument();
    expect(within(panel).getByLabelText("Текущий, прогнозируемый и целевой контуры")).toBeInTheDocument();
    expect(within(panel).getByText("Прогноз:")).toBeInTheDocument();
    expect(panel.querySelector(".monthly-goal-ring--projected")).not.toBeNull();
    expect(within(panel).getByText("Пройти checkpoint ИИ-агенты")).toBeInTheDocument();
    expect(within(panel).getByText("Сдать второй checkpoint ИИ-агенты")).toBeInTheDocument();
    expect(within(panel).getByText("ИИ-агенты · Подтверждено")).toBeInTheDocument();
    expect(within(panel).getByText("ИИ-агенты · Доступно")).toBeInTheDocument();
    expect(panel).toHaveTextContent("9 дн. до конца периода");
  });

  it("stays silent when the projected goal belongs to another trajectory", () => {
    render(<TrajectoryGrowthAnalytics snapshot={snapshot} goal={{ ...monthlyGoal, track_key: "data" }} />);
    expect(screen.queryByTestId("trajectory-monthly-goal")).not.toBeInTheDocument();
    expect(screen.getByTestId("trajectory-growth-overview")).toBeInTheDocument();
  });
});

describe("verifiable documents panel", () => {
  const certificate = {
    certificate_id: "cert-1",
    course_key: "python-base",
    course_title: "Python: основа",
    holder_name: "Алекс Речной",
    issued_at: "2026-10-15T10:00:00Z",
    period: "Сезон 2026",
    preview_marking: "демо",
    program_version: 3,
    result: "91%",
    specialization: "Python-разработчик",
    verification_id: "ver-cert-1",
    workload_hours: 42,
    competencies: [{ competency: "Python", evidence: "итоговый тест 91%", level: "уверенный" }],
  };
  const projectCredential = {
    artifact_keys: ["benchmark-report"],
    competencies: [{ competency: "Качество решения", evidence_refs: ["ref-1"], finding: "benchmark принят", level: "уверенный" }],
    contribution_version: 2,
    credential_id: "cred-1",
    customer_name: "СБЕР",
    grade_label: "B",
    holder_name: "Алекс Речной",
    payment_status: "paid",
    period: "Сезон 2026",
    personal_summary: "Воспроизводимый benchmark",
    project_key: "python-base",
    review_explanation: "Метод повторён и подтверждён",
    signed_at: "2026-10-16T10:00:00Z",
    status: "verified",
    superseded_by: null,
    task_key: "task-benchmark",
    task_title: "Проверка прототипа на данных",
    verification_id: "ver-proj-1",
  };
  type Fixture = { certificates?: object; credentials?: object };
  function installFetch(fixture: Fixture) {
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/me/bootcamp/certificates")) {
        return Promise.resolve(justJson(fixture.certificates ?? []));
      }
      if (url.includes("/me/project-credentials")) {
        return Promise.resolve(justJson(fixture.credentials ?? []));
      }
      return Promise.resolve(justJson({ code: "RESOURCE_NOT_FOUND", message: "нет ресурса", request_id: "r" }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  function justJson(payload: object, status = 200): Response {
    const body = JSON.stringify(payload);
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  }
  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><VerifiedDocumentsPanel /></QueryClientProvider>);
  }
  it("lists real certificates and project credentials and explains each record", async () => {
    installFetch({ certificates: [certificate], credentials: [projectCredential] });
    renderPanel();
    expect(await screen.findByText("Python: основа")).toBeInTheDocument();
    expect(screen.getByText("Проверка прототипа на данных")).toBeInTheDocument();
    expect(screen.getByText(/Сертификат курса · Сезон 2026 · 42 ч/)).toBeInTheDocument();
    expect(screen.getByText(/Проектный credential · оценка B · Сезон 2026/)).toBeInTheDocument();
  });
  it("opens a verification viewer with the honest details and public link", async () => {
    installFetch({ certificates: [certificate], credentials: [projectCredential] });
    renderPanel();
    expect(await screen.findByText("Python: основа")).toBeInTheDocument();
    const certificateToggle = screen.getAllByRole("button", { name: "Проверить" })[0];
    if (!certificateToggle) throw new Error("certificate toggle missing");
    fireEvent.click(certificateToggle);
    const viewers = await screen.findAllByTestId("document-viewer");
    expect(viewers[0]).toHaveTextContent("ver-cert-1");
    expect(viewers[0]).toHaveTextContent("итоговый тест 91%");
    expect(screen.getByRole("link", { name: "Открыть публичную проверку сертификата" })).toHaveAttribute("href", "/verify/ver-cert-1");
    expect(screen.getAllByTestId("document-pdf").length).toBeGreaterThan(0);
  });
  it("shows an honest empty state when no documents exist", async () => {
    installFetch({});
    renderPanel();
    await waitFor(() => { expect(screen.getByRole("status")).toHaveTextContent("Проверяемых документов пока нет"); });
    expect(screen.queryByTestId("document-item")).not.toBeInTheDocument();
  });
});

const drilldownReports = [
  {
    framework_key: "role:product-engineer",
    domain: "role" as const,
    version: 3,
    title: "Продуктовый инженер",
    created_at: "2026-10-01T09:00:00Z",
    skills: [
      {
        skill_key: "tests",
        skill_title: "Автоматические тесты",
        level: "не подтверждено",
        explanation: "Нет подтверждённого опыта: указанные источники не наблюдались.",
        anchors: [],
        excluded: [{ competency_key: "tests", source_kind: "event", source_ref: "journey-2026", level: "уверенный", observed_at: "2026-10-05T12:00:00Z", reason: "Источник не привязан к компетенции в этой версии фреймворка", counted: false }],
      },
      {
        skill_key: "api",
        skill_title: "Проектирование API",
        level: "базовый",
        explanation: "Уровень базовый сложился из 1 источников: project semantic-search-rd · базовый",
        anchors: [{ competency_key: "api", source_kind: "project", source_ref: "semantic-search-rd", level: "базовый", observed_at: "2026-10-05T09:00:00Z", reason: "Подтверждённый источник", counted: true }],
        excluded: [],
      },
    ],
  },
];

const drilldownSuggestion = {
  suggestion_id: "s-skill-1",
  kind: "domain_next",
  observation: "В активной траектории давно нет проверенного checkpoint.",
  gap: "Автоматические тесты ждут проверяемый checkpoint.",
  benefit: "Skill Passport получит подтверждение уровня по этому навыку.",
  explanation: "Модель не вызывается.",
  source_categories: ["participant_scope"],
  model_called: false,
  auto_enrolled: false,
  partial: true,
  coverage_note: "Охват данных по сценарию неполный.",
};
const drilldownBuddy = { policy_version: 1, ai_model_available: false, dismissed: false, suggestion: drilldownSuggestion, suggestions: [drilldownSuggestion] };

describe("trajectory skill drilldown", () => {
  it("shows definition, formula, honest lineage, history, freshness and contextual buddy advice", () => {
    render(<TrajectoryGrowthAnalytics snapshot={snapshot} reports={drilldownReports} buddy={drilldownBuddy} selectedSkillKey="tests" />);
    expect(screen.getByTestId("skill-toggle-tests")).toHaveAttribute("aria-expanded", "true");
    const drill = screen.getByTestId("skill-drilldown");
    expect(within(drill).getByRole("heading", { name: "Автоматические тесты" })).toBeInTheDocument();
    expect(within(drill).getByTestId("skill-definition")).toHaveTextContent(/разрешёнными версиями фреймворков/);
    expect(within(drill).getByTestId("skill-definition")).toHaveTextContent("impulse-growth-readiness-v3");
    expect(within(drill).getByTestId("skill-formula")).toHaveTextContent(/min\(текущий, цель\)/);
    const lineage = within(drill).getByTestId("skill-lineage");
    expect(lineage).toHaveTextContent("event:journey-2026");
    expect(lineage).toHaveTextContent(/не учитывается/);
    expect(within(drill).getByTestId("skill-history")).toHaveTextContent(/пусто, не ноль/);
    expect(within(drill).getByTestId("skill-freshness")).toHaveTextContent(/снапшота/);
    const buddyBlock = within(drill).getByTestId("skill-buddy");
    expect(buddyBlock).toHaveTextContent(/Совет Buddy/);
    expect(buddyBlock).toHaveTextContent(/Автоматические тесты ждут проверяемый checkpoint/);
    expect(buddyBlock).toHaveTextContent(/не вызывает модель/);
  });

  it("counts confirmed lineage and empty lineage separately for a known skill", () => {
    render(<TrajectoryGrowthAnalytics snapshot={snapshot} reports={drilldownReports} selectedSkillKey="api" />);
    const drill = screen.getByTestId("skill-drilldown");
    expect(within(drill).getByTestId("skill-lineage")).toHaveTextContent("project:semantic-search-rd");
    expect(within(drill).getByTestId("skill-history")).toHaveTextContent(/последнее подтверждённое наблюдение/);
  });

  it("emits toggle updates through the URL handler and keeps unknown deep-link honest", () => {
    function Controlled() {
      const [skillKey, setSkillKey] = useState<string | null>("tests");
      return <TrajectoryGrowthAnalytics snapshot={snapshot} reports={drilldownReports} selectedSkillKey={skillKey ?? undefined} onSkillSelect={setSkillKey} />;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Проектирование API" }));
    expect(screen.getByTestId("skill-toggle-api")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Проектирование API" }));
    expect(screen.getByTestId("skill-toggle-api")).toHaveAttribute("aria-expanded", "false");
    render(<TrajectoryGrowthAnalytics snapshot={snapshot} reports={drilldownReports} selectedSkillKey="absent-key" />);
    expect(screen.queryByTestId("skill-drilldown")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skill-toggle-tests").every((node) => node.getAttribute("aria-expanded") === "false")).toBe(true);
  });
});

type DeepLinkFixture = { journey?: object; snapshot?: object; reports?: object; buddy?: object; goal?: object | null };
function deepLinkReply(payload: object | null, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
function installDeepLinkFetch(fixture: DeepLinkFixture) {
  const journey = { stages: [{ key: "learning", title: "Обучение", status: "completed", completed: true, count: 6 }], successful: true, next_action: "Оставьте подтверждаемый checkpoint", earnings: { calculated: "100000", approved: "90000", paid: "60000", failed: "0", currency: "RUB", unknown_items: 0 }, freshness: "fresh", generated_at: "2026-10-20T10:00:00Z" };
  return vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/me/analytics/journey")) return Promise.resolve(deepLinkReply(fixture.journey ?? journey));
    if (url.includes("/me/growth/snapshot")) return Promise.resolve(deepLinkReply(fixture.snapshot ?? snapshot));
    if (url.includes("/me/growth/monthly-goal")) return Promise.resolve(deepLinkReply(fixture.goal === undefined ? null : fixture.goal));
    if (url.includes("/me/competencies")) return Promise.resolve(deepLinkReply(fixture.reports ?? drilldownReports));
    if (url.includes("/agents/buddy/suggestion")) return Promise.resolve(deepLinkReply(fixture.buddy ?? drilldownBuddy));
    if (url.includes("/me/bootcamp/certificates") || url.includes("/me/project-credentials")) return Promise.resolve(deepLinkReply([]));
    return Promise.resolve(deepLinkReply({ code: "RESOURCE_NOT_FOUND", message: "нет ресурса", request_id: "r" }, 404));
  }));
}
function DeepLinkProbe() {
  const location = useLocation();
  return <span data-testid="url-probe">{location.pathname + location.search}</span>;
}
function renderDeepLink(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><DeepLinkProbe /><ParticipantAnalytics /></MemoryRouter></QueryClientProvider>);
}

describe("participant analytics chart rendering", () => {
  it("renders real SVG bars for the weekly activity demo instead of relying on percentage CSS heights", async () => {
    installDeepLinkFetch({});
    const { container } = renderDeepLink("/analytics");
    expect(await screen.findByTestId("skill-toggle-api")).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /Активность по восьми неделям/ });
    expect(chart).toHaveAccessibleName(/неделя 8 — 94 действий/);
    expect(chart.querySelectorAll("svg rect")).toHaveLength(8);
    expect(container.querySelector(".analytics-demo-notice")).toBeInTheDocument();
  });
});

describe("participant analytics drill-down deep links", () => {
  it("restores drilldown from a stable deep link and serializes trajectory and skill selection", async () => {
    installDeepLinkFetch({});
    renderDeepLink("/analytics?trajectory=python&skill=tests");
    await screen.findByTestId("skill-drilldown");
    expect(screen.getByTestId("url-probe")).toHaveTextContent("trajectory=python&skill=tests");
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Проектирование API" }));
    await waitFor(() => expect(screen.getByTestId("skill-drilldown")).toHaveTextContent("semantic-search-rd"));
    expect(screen.getByTestId("url-probe")).toHaveTextContent("skill=api");
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Проектирование API" }));
    await waitFor(() => expect(screen.queryByTestId("skill-drilldown")).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Траектория"), { target: { value: "data" } });
    await waitFor(() => expect(screen.getByTestId("url-probe")).toHaveTextContent("trajectory=data"));
    expect(screen.getByTestId("url-probe").textContent.includes("skill=")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Data pipelines" }));
    await waitFor(() => expect(screen.getByTestId("skill-drilldown")).toBeInTheDocument());
    expect(screen.getByTestId("url-probe")).toHaveTextContent("skill=pipelines");
  });

  it("keeps deep links with unknown referral and honest responses without fake data", async () => {
    installDeepLinkFetch({});
    renderDeepLink("/analytics?skill=absent-key");
    await screen.findByTestId("skill-toggle-api");
    expect(screen.queryByTestId("skill-drilldown")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Подробнее о навыке Автоматические тесты" }));
    expect(await screen.findByTestId("skill-drilldown")).toBeInTheDocument();
    expect(screen.getByTestId("url-probe")).toHaveTextContent("skill=tests");
  });

  it("renders the monthly goal projection on the analytics page", async () => {
    installDeepLinkFetch({ goal: monthlyGoal });
    renderDeepLink("/analytics");
    expect(await screen.findByTestId("trajectory-monthly-goal")).toHaveTextContent("Довести ИИ-агентов до уверенного уровня");
    expect(within(screen.getByTestId("trajectory-monthly-goal")).getByText("Прогноз:")).toBeInTheDocument();
    expect(screen.getByTestId("skill-toggle-tests")).toBeInTheDocument();
  });

  it("stays silent when the endpoint reports no monthly goal", async () => {
    installDeepLinkFetch({});
    renderDeepLink("/analytics?trajectory=python&skill=tests");
    await screen.findByTestId("skill-drilldown");
    expect(screen.queryByTestId("trajectory-monthly-goal")).not.toBeInTheDocument();
    expect(screen.getByTestId("trajectory-growth-overview")).toBeInTheDocument();
  });
});

