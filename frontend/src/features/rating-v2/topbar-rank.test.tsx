import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/client";
import { TopbarRank } from "./topbar-rank";

vi.mock("../../api/client", () => ({ apiRequest: vi.fn() }));

const season = { id: "s1", status: "published" };

function show(personId = "me") {
  const onOpen = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TopbarRank personId={personId} onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return onOpen;
}

beforeEach(() => { vi.resetAllMocks(); });

describe("topbar personal published rating", () => {
  it("shows the actual published place for this person, not someone else's", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.includes("/rating-seasons/s1/leaderboard")) return [
        { place: 1, person_id: "other", anonymized: false },
        { place: 7, person_id: "me", anonymized: false },
      ];
      throw new Error("Unexpected API route");
    });
    const onOpen = show();
    const button = await screen.findByRole("button", { name: "Открыть рейтинг участников. Ваше место: 7" });
    expect(button).toHaveTextContent("Рейтинг");
    expect(button).toHaveTextContent("Место 7");
    button.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows a dash when the participant is not in published standings", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.includes("/rating-seasons/s1/leaderboard")) return [
        { place: 2, person_id: "another", anonymized: false },
      ];
      throw new Error("Unexpected API route");
    });
    show();
    expect(await screen.findByRole("button", { name: "Открыть рейтинг участников. Ваше место: —" })).toHaveTextContent("Место —");
  });

  it("does not expose an anonymized record as the user's position", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.includes("/rating-seasons/s1/leaderboard")) return [
        { place: 3, person_id: "me", anonymized: true },
      ];
      throw new Error("Unexpected API route");
    });
    show();
    const button = await screen.findByRole("button", { name: /Ваше место: —/ });
    await waitFor(() => { expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(2); });
    expect(button).toHaveTextContent("Место —");
  });

  it("does not fabricate a position or request a leaderboard without a published season", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [];
      throw new Error("A leaderboard must not be requested without a season");
    });
    show();
    await waitFor(() => { expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(1); });
    expect(screen.getByRole("button", { name: /Ваше место: —/ })).toHaveTextContent("Место —");
  });
});
