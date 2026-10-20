import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PassportNextResultCard,
  NextResultBody,
  type NextStepView,
  type ScoredStepView,
} from "./next-result";

const stepFixture: ScoredStepView = {
  trajectory_key: "python-dev",
  milestone_key: "m2",
  target_kind: "course",
  target_key: "rag-mvp",
  target_title: "RAG: надёжный поиск по документам",
  position: 2,
  score: 4.2,
  factors: ["trajectory_gap", "prerequisites_met", "availability_open", "no_deadline"],
  reasons: [
    "Первый недостающий обязательный шаг активной траектории",
    "Срок ещё близок",
  ],
  available: true,
  stale_reason: null,
};

const nextStep: NextStepView = {
  policy_version: 1,
  steps: [stepFixture],
  next_available: stepFixture,
  skill: {
    policy_version: 1,
    skill_key: "python",
    title: "Python",
    requested_skill: "python",
    current_level: "базовый",
    target_level: "уверенный",
    current_known: true,
    counted_sources: ["course:openspec-sdd"],
    missing_evidence: ["checkpoint:python-quality-check", "project:semantic-search-rd"],
    explanation:
      "Уровень «базовый» подтверждён источниками course:openspec-sdd. До целевого уровня «уверенный» нужны источники: checkpoint:python-quality-check, project:semantic-search-rd. Шаг «course:openspec-sdd (Курс)» не закрывает недостающие источники — карта не обещает повышение уровня.",
    fallback: null,
  },
};

function renderCard(
  props: {
    data: NextStepView | undefined;
    state: "pending" | "error" | "success";
    onOpenTarget?: (kind: "course" | "task", key: string) => void;
  } = {
    data: nextStep,
    state: "success",
  },
) {
  return render(
    <NextResultBody
      {...props}
      onOpenWorkspace={() => undefined}
      onOpenTarget={props.onOpenTarget ?? (() => undefined)}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("passport next result card", () => {
  it("shows level progression and missing evidence from the API", () => {
    renderCard();
    expect(screen.getByTestId("next-result-badge").textContent).toBe(
      "базовый → уверенный",
    );
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByTestId("next-result-missing").textContent).toContain(
      "checkpoint:python-quality-check",
    );
    expect(screen.getByTestId("next-result-explanation").textContent).toContain(
      "карта не обещает повышение уровня",
    );
  });

  it("renders honest fallback note from the platform", () => {
    const skill = nextStep.skill;
    if (!skill) throw new Error("fixture missing skill");
    renderCard({
      data: { ...nextStep, skill: { ...skill, fallback: "Подходящего проекта нет в активной траектории." } },
      state: "success",
    });
    expect(screen.getByTestId("next-result-fallback").textContent).toContain(
      "Подходящего проекта нет",
    );
  });

  it("keeps level unknown badge honest for unverified evidence", () => {
    const skill = nextStep.skill;
    if (!skill) throw new Error("fixture missing skill");
    renderCard({
      data: {
        ...nextStep,
        skill: {
          ...skill,
          current_level: "не подтверждено",
          current_known: false,
          counted_sources: [],
        },
      },
      state: "success",
    });
    expect(screen.getByTestId("next-result-badge").textContent).toBe(
      "не подтверждено → уверенный",
    );
  });

  it("does not invent data while the service is unavailable", () => {
    renderCard({ data: undefined, state: "error" });
    expect(screen.getByTestId("next-result-unavailable").textContent).toContain(
      "не показывает уровень",
    );
    expect(screen.queryByTestId("next-result-missing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("next-result-fallback")).not.toBeInTheDocument();
  });

  it("renders the chosen step object, why reasons, forecast note and deep link", () => {
    const onOpenTarget = vi.fn();
    renderCard({ data: nextStep, state: "success", onOpenTarget });
    expect(screen.getByTestId("next-result-object").textContent).toBe(
      "Объект: Курс · RAG: надёжный поиск по документам",
    );
    const reasons = screen.getByTestId("next-result-reasons");
    expect(reasons.textContent).toContain("Первый недостающий обязательный шаг");
    expect(reasons.textContent).toContain("Срок ещё близок");
    expect(screen.getByTestId("next-result-forecast").textContent).toContain(
      "уровень повышается только после проверки evidence",
    );
    const cta = screen.getByTestId("next-result-target");
    expect(cta.textContent).toContain("Перейти к курсу");
    cta.click();
    expect(onOpenTarget).toHaveBeenCalledWith("course", "rag-mvp");
  });

  it("deep-links the task catalog for a task step", () => {
    const onOpenTarget = vi.fn();
    const step: ScoredStepView = {
      ...stepFixture,
      target_kind: "task",
      target_key: "semantic-search-rd",
      target_title: "Проект Semantic Search",
    };
    renderCard({
      data: { ...nextStep, steps: [step], next_available: step },
      state: "success",
      onOpenTarget,
    });
    expect(screen.getByTestId("next-result-object").textContent).toContain(
      "Задача · Проект Semantic Search",
    );
    screen.getByTestId("next-result-target").click();
    expect(onOpenTarget).toHaveBeenCalledWith("task", "semantic-search-rd");
  });

  it("shows a blocked honest note when only stale steps remain", () => {
    const staleStep: ScoredStepView = {
      ...stepFixture,
      available: false,
      stale_reason: "Проект закрыт и не соответствует актуальной модели",
    };
    renderCard({
      data: { ...nextStep, steps: [staleStep], next_available: null },
      state: "success",
    });
    expect(screen.getByTestId("next-result-blocked").textContent).toContain(
      "Подходящего открытого объекта нет, действие заблокировано",
    );
    expect(screen.getByTestId("next-result-stale").textContent).toContain(
      "Проект закрыт и не соответствует актуальной модели",
    );
    expect(screen.queryByTestId("next-result-target")).not.toBeInTheDocument();
    expect(screen.queryByTestId("next-result-forecast")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть рабочую область" })).toBeInTheDocument();
  });

  it("fetches from the growth API through react-query", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me/growth/next-step") {
        return Promise.resolve(
          new Response(JSON.stringify(nextStep), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PassportNextResultCard
          onOpenWorkspace={() => undefined}
          onOpenTarget={() => undefined}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("next-result-badge").textContent).toBe(
        "базовый → уверенный",
      );
    });
  });
});
