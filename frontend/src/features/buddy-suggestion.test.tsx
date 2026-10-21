import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BuddySuggestionBody,
  BuddySuggestionCard,
  type BuddySuggestionView,
  type BuddySuggestionStateView,
} from "./buddy-suggestion";

const suggestionState: BuddySuggestionStateView = {
  policy_version: 1,
  ai_model_available: false,
  dismissed: false,
  suggestion: {
    kind: "bootcamp_idle",
    version: 1,
    suggestion_id: "bootcamp_idle:2026-09-20T09:00:00+00:00:2026-10-19",
    generated_at: "2026-10-19T17:55:00+03:00",
    observation:
      "Практика Bootcamp давно не подтверждалась: 60 дн. без проверенного checkpoint.",
    gap: "Навыки траектории «Python-разработчик» растут, пока checkpoint не пройден.",
    action: {
      kind: "checkpoint",
      ref: "checkpoint:openspec-sdd",
      title: "Начать checkpoint: OpenSpec и SDD",
    },
    benefit:
      "Проверочный checkpoint даёт подтверждённый результат и закрывает недостающий источник в Skill Passport.",
    source_categories: ["checkpoint", "course", "skill_evidence"],
    explanation:
      "Автоматический анализ разрешённых данных: дата последнего verified course-checkpoint из Bootcamp-сертификатов и целевой шаг активной траектории. Модель не вызывается.",
    idle_days: 60,
    model_called: false,
    auto_enrolled: false,
  },
};

const baseSuggestion = suggestionState.suggestion;
if (baseSuggestion === null || baseSuggestion.action === null) {
  throw new Error("Buddy fixture requires an action");
}
const richAction = {
  ...baseSuggestion.action,
  target_kind: "course",
  target_id: "openspec-sdd",
  checkpoint_id: "checkpoint-1",
  target_version: 3,
  canonical_path: "/workspace/2?course=openspec-sdd&checkpoint=checkpoint-1",
  estimated_minutes: 45,
  deadline_at: "2026-10-25T12:00:00+03:00",
  points: null,
  points_note: "После проверки evidence",
  skill_forecast: "ИИ-агенты: прогноз 1 → 2",
  effect_state: "projected",
  available: true,
  stale_reason: null,
};

const richSuggestions: BuddySuggestionView[] = [0, 1, 2].map((index) => ({
  ...baseSuggestion,
  suggestion_id: `suggestion-${String(index + 1)}`,
  observation: `Наблюдение ${String(index + 1)}`,
  action: {
    ...richAction,
    checkpoint_id: `checkpoint-${String(index + 1)}`,
    canonical_path: `/workspace/2?course=openspec-sdd&checkpoint=checkpoint-${String(index + 1)}`,
  },
  partial: true,
  coverage_note: "Частичный прогноз по опубликованным mapping.",
  rank_score: String(90 - index),
}));
const firstRichSuggestion = richSuggestions[0];
if (firstRichSuggestion === undefined || firstRichSuggestion.action === null) {
  throw new Error("Rich Buddy fixture requires a first action");
}
const firstRichAction = firstRichSuggestion.action;

function renderBody(
  props: {
    phase: "idle" | "loading" | "error" | "result";
    data: BuddySuggestionStateView | undefined;
  } = { phase: "result", data: suggestionState },
  onActivate: () => void = () => undefined,
) {
  return render(
    <BuddySuggestionBody
      {...props}
      dismissPending={false}
      onActivate={onActivate}
      onDismiss={() => undefined}
      onOpenWorkspace={() => undefined}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buddy suggestion card (openspec 22.26)", () => {
  it("starts with purpose and activation button, without any personal advice", () => {
    renderBody({ phase: "idle", data: undefined });
    expect(
      screen.getByTestId("buddy-suggestion-purpose").textContent,
    ).toContain("объяснимый следующий шаг");
    expect(screen.getByTestId("buddy-suggestion-activate")).toBeInTheDocument();
    expect(
      screen.queryByTestId("buddy-suggestion-observation"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("buddy-suggestion-kind"),
    ).not.toBeInTheDocument();
  });

  it("shows the analysis state before the advice appears", () => {
    renderBody({ phase: "loading", data: undefined });
    expect(screen.getByTestId("buddy-suggestion-loading")).toBeInTheDocument();
  });

  it("marks the advice as automatic analysis with timestamp and sources", () => {
    renderBody();
    expect(screen.getByTestId("buddy-suggestion-kind").textContent).toBe(
      "Давно нет проверенного checkpoint",
    );
    expect(
      screen.getByTestId("buddy-suggestion-observation").textContent,
    ).toContain("60 дн.");
    expect(screen.getByTestId("buddy-suggestion-gap").textContent).toContain(
      "checkpoint",
    );
    expect(screen.getByTestId("buddy-suggestion-benefit").textContent).toContain(
      "Skill Passport",
    );
    expect(screen.getByTestId("buddy-suggestion-boundary").textContent).toContain(
      "Модель AI отключена",
    );
    expect(screen.getByTestId("buddy-suggestion-boundary").textContent).toContain(
      "расчёт",
    );
    fireEvent.click(screen.getByText("Почему это рекомендовано"));
    expect(
      screen.getByTestId("buddy-suggestion-explanation").textContent,
    ).toContain("Модель не вызывается");
    expect(
      screen.getByTestId("buddy-suggestion-sources").textContent,
    ).toContain("checkpoint, course, skill_evidence");
  });

  it("keeps the action manual and never auto-enrolls", () => {
    const onOpenWorkspace = vi.fn();
    render(
      <BuddySuggestionBody
        phase="result"
        data={suggestionState}
        dismissPending={false}
        onActivate={() => undefined}
        onDismiss={() => undefined}
        onOpenWorkspace={onOpenWorkspace}
      />,
    );
    const action = screen.getByRole("button", {
      name: "Начать checkpoint: OpenSpec и SDD",
    });
    fireEvent.click(action);
    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
    expect(suggestionState.suggestion?.auto_enrolled).toBe(false);
  });

  it("fires the recommendation request only after explicit activation", async () => {
    const paths: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const rawPath =
        input instanceof Request
          ? new URL(input.url).pathname
          : input instanceof URL
            ? input.pathname
            : input;
      const path = typeof rawPath === "string" ? rawPath : "";
      paths.push(path);
      if (path === "/api/v1/agents/buddy/suggestion") {
        return Promise.resolve(
          new Response(JSON.stringify(suggestionState), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BuddySuggestionCard onOpenWorkspace={() => undefined} />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("buddy-suggestion-activate")).toBeInTheDocument();
    });
    expect(
      paths.filter((path) => path === "/api/v1/agents/buddy/suggestion"),
    ).toHaveLength(0);
    fireEvent.click(screen.getByTestId("buddy-suggestion-activate"));
    await waitFor(() => {
      expect(screen.getByTestId("buddy-suggestion-kind")).toBeInTheDocument();
    });
    expect(
      paths.filter((path) => path === "/api/v1/agents/buddy/suggestion"),
    ).toHaveLength(1);
  });

  it("keeps an honest retry without stale or invented advice", async () => {
    let failing = true;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const rawPath =
        input instanceof Request
          ? new URL(input.url).pathname
          : input instanceof URL
            ? input.pathname
            : input;
      const path = typeof rawPath === "string" ? rawPath : "";
      if (path === "/api/v1/agents/buddy/suggestion") {
        if (failing) {
          return Promise.resolve(
            new Response(JSON.stringify({ code: "UNAVAILABLE" }), { status: 503 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(suggestionState), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BuddySuggestionCard onOpenWorkspace={() => undefined} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByTestId("buddy-suggestion-activate"));
    const unavailable = await screen.findByTestId("buddy-suggestion-unavailable");
    expect(unavailable.textContent).toContain("не вызывает модель");
    expect(screen.getByTestId("buddy-suggestion-retry")).toBeInTheDocument();
    failing = false;
    fireEvent.click(screen.getByTestId("buddy-suggestion-retry"));
    await waitFor(() => {
      expect(screen.getByTestId("buddy-suggestion-kind")).toBeInTheDocument();
    });
  });

  it("dismisses by suggestion id through the mutation", async () => {
    const requests: { path: string; method: string; body: unknown }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const rawPath =
        input instanceof Request
          ? new URL(input.url).pathname
          : input instanceof URL
            ? input.pathname
            : input;
      const path = typeof rawPath === "string" ? rawPath : "";
      const method = init?.method ?? "GET";
      const rawBody = init?.body;
      requests.push({
        path,
        method,
        body: typeof rawBody === "string" ? JSON.parse(rawBody) : null,
      });
      if (path === "/api/v1/agents/buddy/suggestion") {
        return Promise.resolve(
          new Response(JSON.stringify(suggestionState), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BuddySuggestionCard onOpenWorkspace={() => undefined} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByTestId("buddy-suggestion-activate"));
    await waitFor(() => {
      expect(screen.getByTestId("buddy-suggestion-kind")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("buddy-suggestion-dismiss"));
    await waitFor(() => {
      expect(requests.some((row) => row.method === "POST")).toBe(true);
    });
    const posted = requests.find((row) => row.method === "POST");
    expect(posted?.path).toBe("/api/v1/agents/buddy/suggestion/dismiss");
    expect(posted?.body).toEqual({ suggestion_id: suggestionState.suggestion?.suggestion_id });
  });

  it("keeps a domain note after dismissal without inventing data", () => {
    renderBody({
      phase: "result",
      data: {
        policy_version: 1,
        ai_model_available: false,
        dismissed: true,
        suggestion: null,
      },
    });
    expect(screen.getByTestId("buddy-suggestion-dismissed").textContent).toContain(
      "Доменный следующий шаг остаётся",
    );
    expect(screen.queryByTestId("buddy-suggestion-kind")).not.toBeInTheDocument();
  });

  it("stays honest on empty state when no step exists", () => {
    renderBody({
      phase: "result",
      data: {
        policy_version: 1,
        ai_model_available: false,
        dismissed: false,
        suggestion: null,
      },
    });
    expect(
      screen.getByTestId("buddy-suggestion-dismissed").textContent,
    ).toContain("Пока нет шага для автоматического анализа");
    expect(
      screen.queryByTestId("buddy-suggestion-observation"),
    ).not.toBeInTheDocument();
  });

  it("renders no more than three explainable typed action cards", () => {
    renderBody({
      phase: "result",
      data: { ...suggestionState, suggestion: firstRichSuggestion, suggestions: richSuggestions },
    });
    expect(screen.getAllByTestId(/buddy-action-card/)).toHaveLength(3);
    expect(screen.getAllByText("45 мин")).toHaveLength(3);
    expect(screen.getAllByText("После проверки").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ИИ-агенты: прогноз 1 → 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/частичное покрытие/)).toHaveLength(3);
  });

  it("rechecks the target and opens the exact canonical deep link", async () => {
    const onOpenWorkspace = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const rawPath = input instanceof Request ? new URL(input.url).pathname : String(input);
      if (rawPath === "/api/v1/agents/buddy/suggestion") {
        return Promise.resolve(new Response(JSON.stringify({
          ...suggestionState,
          suggestion: firstRichSuggestion,
          suggestions: [firstRichSuggestion],
        }), { status: 200 }));
      }
      if (rawPath.startsWith("/api/v1/agents/buddy/suggestion/target")) {
        return Promise.resolve(new Response(JSON.stringify({
          suggestion_id: firstRichSuggestion.suggestion_id,
          target: firstRichSuggestion.action,
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BuddySuggestionCard onOpenWorkspace={onOpenWorkspace} /></QueryClientProvider>);
    fireEvent.click(await screen.findByTestId("buddy-suggestion-activate"));
    fireEvent.click(await screen.findByRole("button", { name: firstRichAction.title }));
    await waitFor(() => {
      expect(onOpenWorkspace).toHaveBeenCalledWith(firstRichAction.canonical_path);
    });
  });

  it("submits snooze feedback as a preference, not as completion", async () => {
    const requests: { path: string; body: unknown }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const rawPath = input instanceof Request ? new URL(input.url).pathname : String(input);
      requests.push({
        path: rawPath,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      if (rawPath === "/api/v1/agents/buddy/suggestion") {
        return Promise.resolve(new Response(JSON.stringify(suggestionState), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BuddySuggestionCard onOpenWorkspace={() => undefined} /></QueryClientProvider>);
    fireEvent.click(await screen.findByTestId("buddy-suggestion-activate"));
    fireEvent.click(await screen.findByRole("button", { name: "Напомнить через неделю" }));
    await waitFor(() => {
      expect(requests.some((item) => item.path === "/api/v1/agents/buddy/suggestion/feedback")).toBe(true);
    });
    expect(requests.find((item) => item.path.endsWith("/feedback"))?.body).toEqual({
      suggestion_id: suggestionState.suggestion?.suggestion_id,
      action: "snooze",
    });
  });
});
