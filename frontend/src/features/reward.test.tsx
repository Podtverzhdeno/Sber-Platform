import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParticipantRewardEvidence } from "./reward";

afterEach(() => vi.restoreAllMocks());

describe("ParticipantRewardEvidence", () => {
  it("separates AI draft, human decision and payout status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      review: { id: "r1", contribution_id: "c1", contribution_version: 2, version: 4, grade: "B", assessments: [{ criterion_key: "result", finding: "MVP принят.", evidence_refs: ["artifact:mvp"] }], explanation: "Решение подписано ментором.", status: "published", draft_origin: "ai_suggestion", confirmed_by: "mentor", published_by: "mentor" },
      payout: { id: "p1", review_version: 4, amount: "15000.00", currency: "RUB", status: "calculated", version: 1 },
    }]), { status: 200 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ParticipantRewardEvidence /></QueryClientProvider>);

    expect(await screen.findByLabelText("Черновик AI")).toHaveTextContent("не выставляет финальную оценку");
    expect(screen.getByLabelText("Финальное решение человека")).toHaveTextContent("Решение подписано ментором");
    expect(screen.getByText("15 000,00 ₽")).toBeVisible();
    expect(screen.getAllByText("Начисление рассчитано")).toHaveLength(2);
  });
});
