import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrajectoryGrowthAnalytics, VerifiedDocumentsPanel } from "./analytics";

const snapshot = {
  snapshot_id: "growth-safe",
  generated_at: "2026-10-20T10:00:00Z",
  actor_timezone: "Europe/Moscow",
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
      track_title: "Инженер данных",
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

describe("trajectory growth analytics", () => {
  it("keeps partial and unknown values distinct from zero and explains contour colors", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("Недостаточно данных");
    expect(screen.getByRole("status")).toHaveTextContent("Неизвестные уровни не заменены нулём");
    expect(screen.getByText("Сейчас: нет подтверждённых данных")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/жёлтая цель, красный дефицит, зелёный достигнутый уровень, серый неизвестный уровень/);
    expect(container.querySelector(".growth-deficit-fill")).toBeInTheDocument();
    expect(container.querySelector(".growth-unknown-fill")).toBeInTheDocument();
  });

  it("switches trajectories without mixing their skill scales", () => {
    const { container } = render(<TrajectoryGrowthAnalytics snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Траектория"), { target: { value: "data" } });
    expect(screen.getAllByText("Data pipelines").length).toBeGreaterThan(0);
    expect(screen.queryByText("Проектирование API")).not.toBeInTheDocument();
    expect(screen.getByText("Готовность роли:").parentElement).toHaveTextContent("100%");
    expect(container.querySelector(".growth-achieved")).toBeInTheDocument();
    expect(container.querySelector(".growth-deficit")).not.toBeInTheDocument();
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

