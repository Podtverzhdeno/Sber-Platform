import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MentorReviewWorkspace, ParticipantRewardEvidence } from "./reward";
import type { MentorQueueItem } from "./reward";

afterEach(() => vi.restoreAllMocks());

const queueItem: MentorQueueItem = {
  review: {
    id: "r1",
    contribution_id: "c1",
    contribution_version: 2,
    rubric_id: "rub1",
    rubric_version: 3,
    version: 1,
    grade: "A",
    assessments: [{ criterion_key: "result", finding: "Принято.", evidence_refs: ["artifact:mvp"] }],
    explanation: "Решение подписано ментором.",
    status: "human_confirmed",
    draft_origin: "ai_suggestion",
    confirmed_by: "mentor-id-0001",
    published_by: null,
  },
  payout: null,
  task_title: "MVP для mentor queue",
  deadline_at: new Date(Date.now() - 60_000).toISOString(),
  personal_summary: "Собрал пайплайн и benchmark.",
  artifact_keys: ["artifact:mvp"],
  contribution_accepted: true,
  authorship_conflict_open: false,
  participant_name: "Алекс Речной",
  project_key: "impulse-demo",
  task_kind: "task",
  rubric_key: "impulse-5plus-demo",
  rubric_version: 3,
  rubric_criteria: [
    { key: "result", title: "Качество и полнота результата" },
    { key: "ownership", title: "Самостоятельность и ответственность" },
  ],
};

describe("ParticipantRewardEvidence", () => {
  it("separates AI draft and human decision", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      review: { id: "r1", contribution_id: "c1", contribution_version: 2, version: 4, grade: "B", assessments: [{ criterion_key: "result", finding: "MVP принят.", evidence_refs: ["artifact:mvp"] }], explanation: "Решение подписано ментором.", status: "published", draft_origin: "ai_suggestion", confirmed_by: "mentor", published_by: "mentor" },
      payout: { id: "p1", review_version: 4, amount: "15000.00", currency: "RUB", status: "calculated", version: 1 },
    }]), { status: 200 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ParticipantRewardEvidence /></QueryClientProvider>);

    expect(await screen.findByLabelText("Черновик AI")).toHaveTextContent("не выставляет финальную оценку");
    expect(screen.getByLabelText("Финальное решение человека")).toHaveTextContent("Решение подписано ментором");
    expect(screen.getByText("Оценка опубликована")).toBeVisible();
  });
});

describe("MentorReviewWorkspace", () => {
  it("renders filters, selection, rubric versions and missing-evidence checklist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([queueItem]), { status: 200 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MentorReviewWorkspace /></QueryClientProvider>);

    expect(await screen.findByRole("heading", { name: "Алекс Речной" })).toBeVisible();
    expect(screen.getByText("Просроченные")).toBeVisible();
    expect(screen.getByText("Личный вклад · версия 2")).toBeVisible();
    expect(screen.getByText(/проект impulse-demo/)).toBeVisible();

    const checklist = screen.getByLabelText("Чеклист недостающих данных");
    expect(within(checklist).getByText("Обязательное доказательство отсутствует")).toBeVisible();
    expect(within(checklist).getByText(/Доказательства: artifact:mvp/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Критерии" }));
    expect(screen.getByText(/Рубрика «impulse-5plus-demo» · версия\s*3/)).toBeVisible();
    expect(screen.getByText("Качество и полнота результата")).toBeVisible();
    expect(screen.getByText("Оценки нет")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "История" }));
    expect(screen.getByText(/Решение · версия 1/)).toBeVisible();
    expect(screen.getByText(/Подтверждено · mentor-/)).toBeVisible();
  });

  it("escalates and requests revision without touching review status", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([queueItem]), { status: 200 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MentorReviewWorkspace /></QueryClientProvider>);

    await screen.findByRole("heading", { name: "Алекс Речной" });
    fireEvent.click(screen.getByRole("button", { name: "Запросить доработку/уточнение" }));
    expect(screen.getByText(/Демо-режим: запрос доработки отправлен участнику/)).toBeVisible();
    const reviewCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/v1/mentor/reviews/"),
    );
    expect(reviewCalls.length).toBe(0);
  });
});
