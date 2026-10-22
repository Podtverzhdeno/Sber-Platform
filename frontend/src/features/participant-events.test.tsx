import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDetailBody, ParticipantEventCatalog, type EventDetail, type RegistrationAggregate } from "./participant-events";

const detail: EventDetail = {
  key: "event-1", title: "AI Journey", event_type: "Хакатон", organizer: "Сбер",
  conditions: "Команда до четырёх человек", source_url: "https://example.test/event",
  deadline_at: null, status: "open", track_keys: ["python"],
  recommendation_reason: "Соответствует траектории", source_checked_at: "2026-10-20T08:00:00Z",
  source_status: "current", description: "Практический хакатон по AI-агентам",
  target_audience: "Разработчики", prerequisites: ["Базовый Python"],
  program: [{ day: "День 1", title: "Прототип", detail: "Собрать рабочий контур" }],
  expected_result: "Проверяемый прототип", participation_rules: "По регистрации",
  venue_format: "Онлайн", timezone: "Europe/Moscow",
};

function aggregate(state: "ok" | "zero" | "unknown"): RegistrationAggregate {
  return {
    confirmed_registrations: state === "unknown" ? null : state === "zero" ? 0 : 18,
    participations: state === "unknown" ? null : state === "zero" ? 0 : 7,
    counter_state: state,
    definition_text: "Подтверждённые регистрации не содержат персональных данных.",
  };
}

describe("participant event detail (openspec 22.19)", () => {
  it("shows description, program, conditions, relevance source and confirmed aggregates", () => {
    render(<EventDetailBody detail={detail} aggregate={aggregate("ok")} />);
    expect(screen.getByText(/Практический хакатон/)).toBeInTheDocument();
    expect(screen.getByText(/Команда до четырёх/)).toBeInTheDocument();
    expect(screen.getByText(/День 1 · Прототип/)).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Открыть первоисточник/ })).toHaveAttribute("href", detail.source_url);
  });

  it("distinguishes a real zero from unavailable data", () => {
    const { rerender } = render(<EventDetailBody detail={detail} aggregate={aggregate("zero")} />);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByText(/не показано как ноль/)).not.toBeInTheDocument();
    rerender(<EventDetailBody detail={detail} aggregate={aggregate("unknown")} />);
    expect(screen.getAllByText("Нет данных")).toHaveLength(2);
    expect(screen.getByText(/не показано как ноль/)).toBeInTheDocument();
  });
});

const listItem = {
  key: "event-open",
  title: "AI Journey 2026",
  event_type: "Хакатон",
  organizer: "Сбер",
  conditions: "Команда до четырёх человек",
  source_url: "https://example.test/event",
  deadline_at: "2026-12-01T20:59:00Z",
  starts_at: null,
  status: "open",
  track_keys: ["python"],
  recommendation_reason: "Соответствует траектории",
  source_checked_at: "2026-10-20T08:00:00Z",
  source_status: "current",
};

const completedItem = {
  ...listItem,
  key: "event-completed",
  title: "Маяки 2025",
  deadline_at: "2025-09-20T18:00:00Z",
  starts_at: null,
  status: "completed",
  source_status: "verified",
};

const reportedClaim = {
  id: "00000000-0000-0000-0000-000000000099",
  event_key: "event-completed",
  claim_type: "winner",
  status: "reported",
  trophy_created: false,
  evidence_state: "provisional",
  verification_explanation: "Участие заявлено вами; трофей и баллы не созданы.",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(options: { claims?: unknown[]; claimed?: boolean; claimsError?: boolean; onlyOpenEvents?: boolean } = {}): { posts: number; url: string | null; method: string | null; body: string | null } {
  let claims: unknown[] = options.claims ?? (options.claimed ? [reportedClaim] : []);
  const probes = { posts: 0, url: null as string | null, method: null as string | null, body: null as string | null };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/ecosystem/events")) {
      return Promise.resolve(jsonResponse({ items: options.onlyOpenEvents ? [listItem] : [listItem, completedItem], next_cursor: null, has_more: false }));
    }
    if (url.includes("/me/event-claims")) {
      if (options.claimsError) return Promise.resolve(jsonResponse({}, 500));
      return Promise.resolve(jsonResponse(claims));
    }
    if ((init?.method ?? "GET") === "POST" && url.includes("/me/events/")) {
      probes.posts += 1;
      probes.url = url;
      probes.method = init?.method ?? null;
      probes.body = typeof init?.body === "string" ? init.body : null;
      claims = [reportedClaim];
      return Promise.resolve(jsonResponse(reportedClaim));
    }
    throw new Error(`unmocked fetch ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return probes;
}

function renderCatalog(url = "/workspace/3") {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="*" element={<ParticipantEventCatalog />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("participant event catalog claim lifecycle (7.2/7.4)", () => {
  it("freezes +5 points on registration and keeps the source link safe", async () => {
    const probes = installFetch();
    renderCatalog();
    const source = await screen.findByRole("link", { name: /Перейти к событию/ });
    expect(source).toHaveAttribute("href", "https://example.test/event");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("button", { name: "Подтвердить результат" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Зарегистрироваться · +5" }));
    expect(await screen.findByText("+5 frozen")).toBeInTheDocument();
    expect(screen.getByText("5 баллов заморожены до окончания события и проверки результата.")).toBeInTheDocument();
    expect(probes.posts).toBe(0);
    expect(screen.queryAllByRole("button", { name: "Зарегистрироваться · +5" })).toHaveLength(0);
  });

  it("reports a completed-event result and shows the provisional claim state", async () => {
    const probes = installFetch();
    renderCatalog();
    const proof = await screen.findByRole("button", { name: "Подтвердить результат" });
    fireEvent.click(proof);
    const claimDialog = await screen.findByRole("dialog", { name: /Подтвердить результат/ });
    fireEvent.change(within(claimDialog).getByLabelText("Результат"), { target: { value: "winner" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить на проверку" }));
    await waitFor(() => { expect(probes.posts).toBe(1); });
    expect(probes.url).toContain("/me/events/event-completed/claims");
    expect(probes.method).toBe("POST");
    expect(JSON.parse(String(probes.body))).toEqual({ claim_type: "winner", result: "Участвовал в команде и подготовил рабочий прототип.", evidence_url: "https://example.org/demo-evidence" });
    expect(await screen.findByText("Участие заявлено вами; трофей и баллы не созданы.")).toBeInTheDocument();
    expect(screen.getByText("Предварительно")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Подтвердить результат" })).toHaveLength(0);
  });

  it("keeps exactly one card when the claims read fails", async () => {
    installFetch({ claimsError: true, onlyOpenEvents: true });
    renderCatalog();
    await screen.findByRole("button", { name: "Зарегистрироваться · +5" });
    expect(screen.getAllByRole("button", { name: "Подробнее" })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: "Подтвердить результат" })).toHaveLength(0);
  });
});
