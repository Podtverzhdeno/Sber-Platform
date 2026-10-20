import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerCandidates } from "./customer-candidates";

const closedTask = {
  id: "task-closed",
  title: "Прототип разговорного Ассистента",
  status: "published",
  mode: "invitation_only",
  competency_tags: ["nlp"],
  places: 1,
};
const caseTask = {
  id: "task-case",
  title: "Сжатие канонических изображений",
  status: "published",
  mode: "open",
  competency_tags: ["nlp", "cv"],
};
const maria = {
  person_id: "p-maria",
  display_name: "Мария Ковалёва",
  request_version: 1,
  matched_required: ["nlp"],
  matched_preferred: ["cv"],
  evidence: [{
    task_id: "task-case",
    contribution_id: "c-maria",
    personal_summary: "Собрала прототип и воспроизводимый benchmark.",
    competency_tags: ["nlp"],
    artifact_keys: ["repo"],
  }],
};
const ivan = {
  person_id: "p-ivan",
  display_name: "Иван Антоновский",
  request_version: 1,
  matched_required: ["ml"],
  matched_preferred: [],
  evidence: [{
    task_id: "task-case",
    contribution_id: "c-ivan",
    personal_summary: "Развернул воспроизводимый дашборд метрик.",
    competency_tags: ["ml"],
    artifact_keys: ["repo-2"],
  }],
};
const teamRequest = { id: "req-1", version: 1, title: "Ищем NLP инженера", required_tags: ["nlp"], preferred_tags: [], relevant_case_task_ids: ["task-case"] };
const savedCandidate = { id: "s-1", request_id: "req-1", person_id: maria.person_id, created_at: "2026-10-01T09:00:00Z", match: maria };

type LoggedCall = { path: string; method: string; body: Record<string, unknown> };

function installFetch(candidates: (typeof maria | typeof ivan)[] = [maria, ivan], saved: (typeof savedCandidate)[] = []) {
  const calls: LoggedCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    let rawBody: Record<string, unknown> = {};
    if (typeof init?.body === "string") rawBody = JSON.parse(init.body) as Record<string, unknown>;
    if (method !== "GET") calls.push({ path, method, body: rawBody });
    if (path === "/api/v1/customer/tasks") return Promise.resolve(new Response(JSON.stringify([closedTask]), { status: 200 }));
    if (path === "/api/v1/customer/cases") return Promise.resolve(new Response(JSON.stringify([caseTask]), { status: 200 }));
    if (path === "/api/v1/customer/team-requests" && method === "POST") return Promise.resolve(new Response(JSON.stringify(teamRequest), { status: 200 }));
    if (/\/api\/v1\/customer\/team-requests\/req-1\/matches$/.test(path)) return Promise.resolve(new Response(JSON.stringify(candidates), { status: 200 }));
    if (/\/api\/v1\/customer\/team-requests\/req-1\/saved\/[\w-]+$/.test(path)) {
      const personId = path.split("/").pop() ?? "";
      const record = { ...savedCandidate, id: `s-${String(saved.length + 1)}`, person_id: personId, match: candidates.find((candidate) => candidate.person_id === personId) ?? maria };
      saved.push(record);
      return Promise.resolve(new Response(JSON.stringify(record), { status: 200 }));
    }
    if (path === "/api/v1/customer/saved-candidates") return Promise.resolve(new Response(JSON.stringify(saved), { status: 200 }));
    if (/\/api\/v1\/customer\/tasks\/[\w-]+\/invitations$/.test(path) && method === "POST") {
      return Promise.resolve(new Response(JSON.stringify({ id: "inv-1", task_id: closedTask.id, person_id: rawBody.person_id, status: "pending", expires_at: "2026-10-24T09:00:00Z", terms_version: 1 }), { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  return calls;
}

async function openPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CustomerCandidates /></QueryClientProvider>);
  await screen.findByText("Подбор по подтверждённым кейсам");
  fireEvent.input(screen.getByLabelText("Задача команды"), { target: { value: "Ищем NLP инженера" } });
  fireEvent.input(screen.getByLabelText("Обязательные навыки через запятую"), { target: { value: "NLP" } });
  fireEvent.change(screen.getByLabelText("Релевантный завершённый кейс"), { target: { value: "task-case" } });
  fireEvent.click(screen.getByRole("button", { name: "Показать кандидатов" }));
  await screen.findByRole("heading", { name: "Подходящие участники" });
  await screen.findByText("Причина совпадения: обязательные навыки nlp совпали с принятым вкладом. Согласие участника действительно — подбор показывает только кандидатов с действующими согласиями.");
}

afterEach(() => { vi.restoreAllMocks(); });

describe("customer candidate picker", () => {
  it("preselects confirmed relevant candidates, supports text search and explicit selection state", async () => {
    installFetch();
    await openPicker();

    expect(screen.getByLabelText("Выбрать адресата Мария Ковалёва")).toBeChecked();
    expect(screen.getByLabelText("Выбрать адресата Иван Антоновский")).toBeChecked();
    expect(screen.getByTestId("selection-count")).toHaveTextContent("Адресаты к приглашению: 2 из 2");
    expect(screen.getByText(/Собрала прототип и воспроизводимый benchmark/)).toBeInTheDocument();
    expect(screen.getByText(/Развернул воспроизводимый дашборд метрик/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Поиск кандидата"), { target: { value: "Ковалёва" } });
    expect(screen.queryByText("Иван Антоновский")).not.toBeInTheDocument();
    expect(screen.getByText("Мария Ковалёва")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Поиск кандидата"), { target: { value: "машинному обучению" } });
    expect(screen.queryByText("Мария Ковалёва")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Поиск кандидата"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Закрытая задача для приглашения"), { target: { value: "task-closed" } });
    fireEvent.click(screen.getByLabelText("Выбрать адресата Иван Антоновский"));
    await waitFor(() => { expect(screen.getByTestId("selection-count")).toHaveTextContent("Адресаты к приглашению: 1 из 2"); });
    expect(screen.getByTestId("invite-selected")).toBeEnabled();
  });

  it("blocks over-limit invitations with the platform rule and keeps the selection intact", async () => {
    const calls = installFetch();
    await openPicker();

    fireEvent.change(screen.getByLabelText("Закрытая задача для приглашения"), { target: { value: "task-closed" } });
    await waitFor(() => { expect(screen.getByTestId("invitation-blocked")).toBeInTheDocument(); });
    expect(screen.getByTestId("invitation-blocked")).toHaveTextContent(/выбрано больше адресатов, чем мест \(1\)/);
    expect(screen.getByTestId("invite-selected")).toBeDisabled();
    expect(screen.getByLabelText("Выбрать адресата Мария Ковалёва")).toBeChecked();
    expect(screen.getByLabelText("Выбрать адресата Иван Антоновский")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Выбрать адресата Иван Антоновский"));
    await waitFor(() => { expect(screen.queryByTestId("invitation-blocked")).not.toBeInTheDocument(); });
    expect(screen.getByTestId("invite-selected")).toBeEnabled();
    fireEvent.click(screen.getByTestId("invite-selected"));

    await screen.findByText("Приглашения отправлены. Участники увидят условия задачи и решат сами.");
    const invitationCalls = calls.filter((call) => call.path === "/api/v1/customer/tasks/task-closed/invitations");
    expect(invitationCalls).toHaveLength(1);
    expect(invitationCalls[0]?.body.person_id).toBe("p-maria");
    expect(invitationCalls[0]?.body.request_id).toBe("req-1");
  });

  it("keeps the per-row invite flow with honest cases and reserve saving", async () => {
    const calls = installFetch();
    await openPicker();

    fireEvent.change(screen.getByLabelText("Закрытая задача для приглашения"), { target: { value: "task-closed" } });
    fireEvent.click(screen.getByLabelText("Выбрать адресата Иван Антоновский"));
    await waitFor(() => { expect(screen.queryByTestId("invitation-blocked")).not.toBeInTheDocument(); });
    const inviteButton = screen.getAllByRole("button", { name: "Пригласить в задачу" })[0];
    if (!inviteButton) throw new Error("invite button not found");
    fireEvent.click(inviteButton);

    await screen.findByText("Приглашение отправлено. Участник увидит условия задачи.");
    const invitationCalls = calls.filter((call) => call.path === "/api/v1/customer/tasks/task-closed/invitations");
    expect(invitationCalls[0]?.body.person_id).toBe("p-maria");
    expect(invitationCalls[0]?.body.evidence_contribution_id).toBe("c-maria");

    const reserveButton = screen.getAllByRole("button", { name: "Сохранить в резерв" })[0];
    if (!reserveButton) throw new Error("reserve button not found");
    fireEvent.click(reserveButton);
    await screen.findByText("Кандидат сохранён в резерве.");
    const savedCalls = calls.filter((call) => call.path.startsWith("/api/v1/customer/team-requests/req-1/saved/"));
    expect(savedCalls).toHaveLength(1);
    expect(await screen.findByText("В резерве")).toBeInTheDocument();
  });
});
