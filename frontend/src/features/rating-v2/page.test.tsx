import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/client";
import { ParticipantRatingV2 } from "./page";

vi.mock("../../api/client", () => ({ apiRequest: vi.fn() }));

const season = { id: "season-1", key: "autumn-2026", title: "Проверенный сезон", status: "open", version: 2, policy_version: 1 };
const published = [
  { place: 1, person_id: null, display_name: "Участник №1", score: "100.00", successful_projects: 2, trophies: [], offers: [], anonymized: true },
  { place: 2, person_id: "actor-id", display_name: "Тестовый участник", score: "75.00", successful_projects: 1, trophies: [{ title: "Подтверждённая победа", trophy_type: "winner", source_url: "https://example.test/proof" }], offers: [], anonymized: false },
];
function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/workspace/4"]}><ParticipantRatingV2 currentPersonId="actor-id" /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { vi.resetAllMocks(); });

describe("published rating integration", () => {
  it("renders a transparent no-season state without fake users, ranks or scores", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      if (path === "/api/v1/rating-seasons") return [];
      throw new Error("Unexpected request: " + path);
    });
    show();
    await screen.findByText(/Опубликованных сезонов рейтинга пока нет/);
    expect(screen.queryByText("Алекс Речной")).not.toBeInTheDocument();
    expect(screen.queryByText("450")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Все участники рейтинга" })).toBeInTheDocument();
    expect(screen.getByText(/Подтверждённых записей пока нет/)).toBeInTheDocument();
  });

  it("uses only server standings, keeps anonymous people private, and preserves real sorting", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.includes("/rating-seasons/season-1/leaderboard")) return published;
      throw new Error("Unexpected request: " + path);
    });
    show();
    const board = await screen.findByRole("region", { name: "Все участники рейтинга" });
    await waitFor(() => expect(within(board).getAllByRole("article")).toHaveLength(2));
    expect(within(board).getByText("100")).toBeInTheDocument();
    expect(within(board).getByText("75")).toBeInTheDocument();
    expect(within(board).getByText("Тестовый участник")).toBeInTheDocument();
    const anonymous = within(board).getAllByRole("button", { name: /Профиль/ })[0];
    expect(anonymous).toBeDisabled();
    const profile = within(board).getAllByRole("button", { name: /Профиль/ })[1];
    expect(profile).toBeEnabled();
    fireEvent.click(profile!);
    expect(screen.getByText("Подтверждённая победа")).toBeInTheDocument();
    expect(screen.queryByText("AI Study Assistant")).not.toBeInTheDocument();
    expect(screen.queryByText("5.0")).not.toBeInTheDocument();
  });
});
