import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BuddySuggestionBody,
  BuddySuggestionCard,
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

function renderBody(
  props: {
    state: "pending" | "error" | "success";
    data: BuddySuggestionStateView | undefined;
  } = { state: "success", data: suggestionState },
) {
  return render(
    <BuddySuggestionBody
      {...props}
      dismissPending={false}
      onDismiss={() => undefined}
      onOpenWorkspace={() => undefined}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buddy suggestion card", () => {
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
        state="success"
        data={suggestionState}
        dismissPending={false}
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
      state: "success",
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

  it("stays honest when the service is unavailable", () => {
    renderBody({ state: "error", data: undefined });
    expect(screen.getByTestId("buddy-suggestion-unavailable").textContent).toContain(
      "не вызывает модель",
    );
    expect(screen.queryByTestId("buddy-suggestion-observation")).not.toBeInTheDocument();
  });

  it("shows the pending state without data", () => {
    renderBody({ state: "pending", data: undefined });
    expect(screen.getByTestId("buddy-suggestion-loading")).toBeInTheDocument();
  });
});
