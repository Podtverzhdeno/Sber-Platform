import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PassportNextResultCard,
  NextResultBody,
  type NextStepView,
} from "./next-result";

const nextStep: NextStepView = {
  policy_version: 1,
  steps: [],
  next_available: null,
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
  props: { data: NextStepView | undefined; state: "pending" | "error" | "success" } = {
    data: nextStep,
    state: "success",
  },
) {
  return render(
    <NextResultBody {...props} onOpenWorkspace={() => undefined} />,
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
        <PassportNextResultCard onOpenWorkspace={() => undefined} />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("next-result-badge").textContent).toBe(
        "базовый → уверенный",
      );
    });
  });
});
