import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/client";
import { ParticipantRatingV2 } from "./page";

vi.mock("../../api/client", () => ({ apiRequest: vi.fn() }));

const season = { id: "season-1", key: "autumn-2026", title: "Проверенный сезон", status: "open", version: 2, policy_version: 1 };
const published = [
  { place: 1, person_id: null, display_name: "Нельзя раскрывать", score: "100.00", successful_projects: 2, trophies: [], offers: [], anonymized: true },
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
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [];
      if (path.endsWith("/me/rating/standings")) return [];
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
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.endsWith("/me/rating/standings")) return [{
        season_id: season.id, season_key: season.key, season_title: season.title,
        season_status: season.status, season_version: season.version,
        policy_version: season.policy_version, place: 2,
        score: "75.00", successful_projects: 1,
      }];
      if (path.includes("/rating-seasons/season-1/leaderboard")) return published;
      throw new Error("Unexpected request: " + path);
    });
    show();
    const board = await screen.findByRole("region", { name: "Все участники рейтинга" });
    await waitFor(() => { expect(within(board).getAllByRole("article")).toHaveLength(2); });
    expect(within(board).getByText("100")).toBeInTheDocument();
    expect(within(board).getByText("75")).toBeInTheDocument();
    expect(within(board).getByText("Тестовый участник")).toBeInTheDocument();
    expect(within(board).getByText("Участник №1")).toBeInTheDocument();
    expect(within(board).queryByText("Нельзя раскрывать")).not.toBeInTheDocument();
    expect(within(board).getByText(/Имя и профиль скрыты/)).toBeInTheDocument();
    const anonymous = within(board).getAllByRole("button", { name: /Профиль/ })[0];
    expect(anonymous).toBeDisabled();
    const profile = within(board).getAllByRole("button", { name: /Профиль/ })[1];
    expect(profile).toBeEnabled();
    if (!profile) throw new Error("Participant profile button is missing");
    fireEvent.click(profile);
    expect(screen.getByText("Подтверждённая победа")).toBeInTheDocument();
    expect(screen.queryByText("AI Study Assistant")).not.toBeInTheDocument();
    expect(screen.queryByText("5.0")).not.toBeInTheDocument();
  });
  it("renders consented fictional demo names with distinct avatars and live profiles", async () => {
    const demoSeason = { ...season, key: "demo-autumn-2026", title: "Демо-сезон: осень 2026" };
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [demoSeason];
      if (path.endsWith("/me/rating/standings")) return [];
      if (path.includes("/rating-seasons/season-1/leaderboard")) return [
        { place: 1, person_id: "fake-alex", display_name: "Алекс Речной", score: "550.00", successful_projects: 2, trophies: [], offers: [], anonymized: false },
        { place: 2, person_id: "fake-maria", display_name: "Мария Северова", score: "500.00", successful_projects: 1, trophies: [], offers: [], anonymized: false },
      ];
      throw new Error("Unexpected request: " + path);
    });
    show();
    const board = await screen.findByRole("region", { name: "Все участники рейтинга" });
    await waitFor(() => {
      expect(within(board).getAllByRole("article")).toHaveLength(2);
    });
    expect(within(board).getByRole("button", { name: "Алекс Речной" })).toBeEnabled();
    expect(within(board).getByRole("button", { name: "Мария Северова" })).toBeEnabled();
    expect(within(board).getByRole("img", { name: "Алекс Речной" })).toHaveTextContent("АР");
    expect(within(board).getByRole("img", { name: "Мария Северова" })).toHaveTextContent("МС");
    expect(screen.getByText(/Демо-персоны вымышлены/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("button", { name: "Алекс Речной" }));
    expect(await screen.findByRole("heading", { name: /Алекс Речной/ })).toBeInTheDocument();
  });

  it("shows own season result even if public records anonymize the participant", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.endsWith("/me/rating/standings")) return [{
        season_id: season.id, season_key: season.key, season_title: season.title,
        season_status: season.status, season_version: season.version,
        policy_version: season.policy_version, place: 6,
        score: "88.00", successful_projects: 3,
      }];
      if (path.includes("/rating-seasons/season-1/leaderboard")) return [
        { place: 6, person_id: null, display_name: "Участник №6", score: "88.00",
          successful_projects: 3, trophies: [], offers: [], anonymized: true },
      ];
      throw new Error("Unexpected request: " + path);
    });
    show();
    await screen.findByRole("region", { name: "Все участники рейтинга" });
    const benefitsButton = await screen.findByRole("button", { name: /Подробнее о рейтинге и наградах/ });
    fireEvent.click(benefitsButton);
    await waitFor(() => {
      const ownRank = screen.getByText("Ваше место").closest(".ir-my-rank");
      expect(ownRank).toHaveTextContent("6");
      expect(ownRank).toHaveTextContent("88.00 баллов · 3 проектов");
    });
    expect(screen.queryByText("Тестовый участник")).not.toBeInTheDocument();
  });

});
