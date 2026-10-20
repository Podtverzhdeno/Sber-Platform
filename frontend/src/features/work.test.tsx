import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompensationDetails, ParticipantTasks } from "./work";

type RecordedCall = { method: string; path: string; body: Record<string, unknown> };

const taskId = "00000000-0000-0000-0000-000000000701";
const assignmentId = "00000000-0000-0000-0000-000000000702";
const applicationId = "00000000-0000-0000-0000-000000000704";

const task = { id: taskId, title: "MVP поиска программ", status: "published", places: 1 };
const compensation = { paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1", a_multiplier: "1", b_total: null, a_total: null, quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "" };
const terms = { version: 2, deadline_at: "2026-11-01T18:00:00Z", deliverable: "Работающий MVP и отчёт по метрикам.", acceptance_criteria: ["MVP воспроизводим"], support_mode: "buddy", compensation };

function detail(applicationStatus: string) {
  return {
    task, problem: "Собери MVP.", deliverable: terms.deliverable, acceptance_criteria: terms.acceptance_criteria,
    deadline_at: terms.deadline_at, data_constraints: "нет", ip_terms: "нет", terms,
    terms_history: [{ version: 1, deadline_at: terms.deadline_at, deliverable: terms.deliverable }],
    accepted_terms_version: 2, invitation_status: null,
    customer: { id: "00000000-0000-0000-0000-000000000003", display_name: "Роман Заказчик" }, mentor: null, support: null,
    team: [], membership: null, checkpoints: [], personal: [], feedback: [],
    applications: [{ id: applicationId, status: applicationStatus }],
  };
}

const contributionsClosed = [{ id: "00000000-0000-0000-0000-000000000801", assignment_id: assignmentId, version: 1, personal_summary: "Реализовал MVP поиска.", artifact_keys: ["personal-proof"], status: "accepted" }];
const decisionsClosed = [{ id: "00000000-0000-0000-0000-000000000802", contribution_id: "00000000-0000-0000-0000-000000000801", decision: "accepted", reason: "Метрика зафиксирована", deadline_at: null, owner_id: "00000000-0000-0000-0000-000000000003" }];

const workItemsClosed = [
  {
    assignment: { id: assignmentId, task_id: taskId, person_id: "00000000-0000-0000-0000-000000000001", status: "closed" },
    task, terms,
    allowed_artifacts: [],
    contributions: contributionsClosed,
    decisions: decisionsClosed,
  },
];

const workItemsActive = [
  {
    assignment: { id: assignmentId, task_id: taskId, person_id: "00000000-0000-0000-0000-000000000001", status: "in_progress" },
    task, terms, allowed_artifacts: [], contributions: [], decisions: [],
  },
];

const deadlineList = [
  { id: "00000000-0000-0000-0000-000000000706", task_id: taskId, requested_by: "00000000-0000-0000-0000-000000000001", addressee_id: "00000000-0000-0000-0000-000000000003", base_terms_version: 2, proposed_deadline_at: "2026-11-15T18:00:00Z", reason: "Нагрузка выросла.", impact: "Переносит приёмку.", status: "pending", decision_comment: null, decided_at: null, created_at: "2026-10-20T10:00:00Z" },
];

let calls: RecordedCall[];
let applicationStatus: string;
let withdrawStatus: number;
let withdrawBody: Record<string, unknown> | undefined;
let listing: typeof workItemsClosed;

function mockWorkspaceFetch(proposalsStatus = 201) {
  calls = [];
  applicationStatus = "applied";
  withdrawStatus = proposalsStatus === 409 ? 200 : 200;
  withdrawBody = { id: applicationId, status: "withdrawn" };
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
    const method = init?.method ?? "GET";
    const rawBody = typeof init?.body === "string" && init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (method !== "GET") calls.push({ method, path, body: rawBody });
    if (path === "/api/v1/marketplace/tasks") return Promise.resolve(new Response(JSON.stringify([{ task, terms, accepted_terms_version: 2 }]), { status: 200 }));
    if (path === "/api/v1/me/work") return Promise.resolve(new Response(JSON.stringify(listing), { status: 200 }));
    if (path === "/api/v1/me/reward-evidence") return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    if (path === "/api/v1/me/tasks/" + taskId) return Promise.resolve(new Response(JSON.stringify(detail(applicationStatus)), { status: 200 }));
    if (path === "/api/v1/me/applications/" + applicationId + "/withdraw") {
      applicationStatus = withdrawStatus === 200 ? "withdrawn" : applicationStatus;
      return Promise.resolve(new Response(JSON.stringify(withdrawBody ?? {}), { status: withdrawStatus }));
    }
    if (path === `/api/v1/me/assignments/${assignmentId}/deadline-requests`) {
      if (method === "GET") return Promise.resolve(new Response(JSON.stringify(deadlineList), { status: 200 }));
      if (proposalsStatus !== 201) return Promise.resolve(new Response(JSON.stringify({ code: "DEADLINE_CHANGE_PENDING", message: "Уже есть активный запрос." }), { status: proposalsStatus }));
      const deadlineVersion = typeof rawBody["base_terms_version"] === "number" ? rawBody["base_terms_version"] : 2;
      const deadlineAt = typeof rawBody["proposed_deadline_at"] === "string" ? rawBody["proposed_deadline_at"] : "";
      const deadlineReason = typeof rawBody["reason"] === "string" ? rawBody["reason"] : "";
      const deadlineImpact = typeof rawBody["impact"] === "string" ? rawBody["impact"] : "";
      const proposed = { id: "00000000-0000-0000-0000-000000000709", task_id: taskId, requested_by: "00000000-0000-0000-0000-000000000001", addressee_id: "00000000-0000-0000-0000-000000000003", base_terms_version: deadlineVersion, proposed_deadline_at: deadlineAt, reason: deadlineReason, impact: deadlineImpact, status: "pending", decision_comment: null, decided_at: null, created_at: "2026-10-20T15:00:00Z" };
      deadlineList.push(proposed);
      return Promise.resolve(new Response(JSON.stringify(proposed), { status: 201 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function renderWorkspace(view: "catalog" | "projects", initialPath = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <ParticipantTasks view={view} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

afterEach(() => { vi.restoreAllMocks(); });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); listing = workItemsClosed; });

async function waitForText(text: string) {
  await waitFor(() => {
    expect(screen.getByText(text)).toBeInTheDocument();
  });
}

async function waitForFunctionButton(name: string) {
  await waitFor(() => {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });
}

describe("task terms", () => {
  it("does not render financial terms", () => {
    const { container } = render(
      <CompensationDetails
        terms={{ paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1", a_multiplier: "1", b_total: null, a_total: null, quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("withdrawal", () => {
  it("stays transient until confirmed and revives the apply CTA after withdraw", async () => {
    sessionStorage.setItem("impulse_applied_tasks", JSON.stringify([taskId]));
    mockWorkspaceFetch();
    renderWorkspace("catalog");

    await waitForText("Ожидает решения");
    await waitForFunctionButton("Отозвать заявку");
    fireEvent.click(screen.getByRole("button", { name: "Отозвать заявку" }));
    const dialog = screen.getByRole("dialog", { name: "Отозвать заявку?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
    expect(calls.some((entry) => entry.path.endsWith("/withdraw"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Отозвать заявку" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Отозвать заявку?" })).getByRole("button", { name: "Подтвердить отзыв" }));

    await waitForText("Заявка отозвана");
    const withdrawCall = calls.find((entry) => entry.path.endsWith("/withdraw"));
    expect(withdrawCall?.method).toBe("POST");
        await waitForFunctionButton("Откликнуться");
  });

  it("keeps the honest error when customer already accepted the application", async () => {
    sessionStorage.setItem("impulse_applied_tasks", JSON.stringify([taskId]));
    mockWorkspaceFetch();
    withdrawStatus = 409;
    withdrawBody = { code: "ACCEPTED_WITHDRAW_FORBIDDEN", message: "Принятые заявки не отзываются." };
    renderWorkspace("catalog");

    await waitForText("Ожидает решения");
    await waitForFunctionButton("Отозвать заявку");
    fireEvent.click(screen.getByRole("button", { name: "Отозвать заявку" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Отозвать заявку?" })).getByRole("button", { name: "Подтвердить отзыв" }));

    await waitFor(() => { expect(screen.getAllByText("Заявка уже принята — отзыв недоступен. Продолжайте работу в рабочей области.").length).toBeGreaterThan(0); });
  });
});

describe("project detail", () => {
  it("renders the completed project as read-only evidence history", async () => {
    mockWorkspaceFetch();
    renderWorkspace("projects", `/?project=${assignmentId}&detail=1`);

    await waitForText("История доказательств");
    expect(screen.getByText("Личный вклад · версия 1")).toBeInTheDocument();
    expect(screen.getByText("Реализовал MVP поиска.")).toBeInTheDocument();
    expect(screen.getByText("Результат принят заказчиком")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть рабочую область →" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Запросить перенос срока" })).toBeNull();
    expect(screen.getByText(/Для принятых проектов история переносов остаётся документацией/)).toBeInTheDocument();
  });

  it("proposes a deadline change with honest state for the customer decision", async () => {
    mockWorkspaceFetch();
    listing = workItemsActive;
    renderWorkspace("projects", `/?project=${assignmentId}&detail=1`);

    await waitForText("Обсуждение сроков");
    await waitForText("Ожидает решения заказчика");
    fireEvent.change(screen.getByLabelText(/Предлагаемый срок/), { target: { value: "2026-11-05T18:00" } });
    fireEvent.change(screen.getByLabelText(/Обоснование/), { target: { value: "Нагрузка выросла." } });
    fireEvent.change(screen.getByLabelText(/Влияние на приёмку/), { target: { value: "Перенос приёмки." } });
    fireEvent.click(screen.getByRole("button", { name: "Запросить перенос срока" }));

    await waitFor(() => {
      const proposeCalls = calls.filter((entry) => entry.path.endsWith("/deadline-requests") && entry.method === "POST");
      expect(proposeCalls.length).toBeGreaterThan(0);
      expect(proposeCalls[0]?.body).toEqual({
        base_terms_version: 2,
        proposed_deadline_at: new Date("2026-11-05T18:00").toISOString(),
        reason: "Нагрузка выросла.",
        impact: "Перенос приёмки.",
      });
    });
  });
});
