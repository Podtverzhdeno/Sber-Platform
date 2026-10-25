import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/client";
import { TopbarRank } from "./topbar-rank";

vi.mock("../../api/client", () => ({ apiRequest: vi.fn() }));

const season = { id: "autumn", status: "open", version: 3, policy_version: 2 };
const owned = (place: number | null, owner = "me") => ({
  owner,
  season_id: "autumn",
  season_key: "autumn-2026",
  season_title: "Осень",
  season_status: "open",
  season_version: 3,
  policy_version: 2,
  place,
  score: place === null ? null : "75.50",
  successful_projects: place === null ? null : 1,
});

function show(personId = "me") {
  const onOpen = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TopbarRank personId={personId} onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { ...view, onOpen, queryClient };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); });

describe("topbar own published ranking", () => {
  it("shows the owner's private place even when publicly anonymous", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.endsWith("/me/rating/standings")) return [owned(7)];
      throw new Error("Topbar must never fetch or reidentify a public leaderboard: " + path);
    });
    const { onOpen } = show();
    const button = await screen.findByRole("button", { name: "Открыть рейтинг участников. Ваше место: 7" });
    expect(button).toHaveTextContent("Место 7");
    button.click();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(vi.mocked(apiRequest).mock.calls.map(call => call[0])).not.toContain(
      "/api/v1/rating-seasons/autumn/leaderboard",
    );
  });

  it("does not guess a place when it is not published, or the version is stale", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.endsWith("/me/rating/standings")) return [{ ...owned(2), season_version: 2 }];
      throw new Error("Unexpected request");
    });
    show();
    const button = await screen.findByRole("button", { name: /Ваше место: —/ });
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(2));
    expect(button).toHaveTextContent("Место —");
  });

  it("does not request a leaderboard or invent a position without a published season", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [];
      if (path.endsWith("/me/rating/standings")) return [];
      throw new Error("Unexpected request");
    });
    show();
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: /Ваше место: —/ })).toHaveTextContent("Место —");
  });

  it("isolates a participant switch through an actor-scoped query key", async () => {
    let requests = 0;
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      if (path.endsWith("/me/rating/standings")) {
        requests += 1;
        return [owned(requests === 1 ? 2 : 11)];
      }
      throw new Error("Unexpected request");
    });
    const view = show("owner-one");
    expect(await screen.findByRole("button", { name: /Ваше место: 2/ })).toBeInTheDocument();
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <TopbarRank personId="owner-two" onOpen={view.onOpen} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: /Ваше место: 11/ })).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it("does not substitute leaderboard place when the private endpoint fails", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/rating-seasons") return [season];
      throw new Error("Private standing unavailable");
    });
    show();
    const button = await screen.findByRole("button", { name: /Ваше место: —/ });
    await waitFor(() => expect(button).toHaveAttribute("title", "Не удалось обновить личное место"));
    expect(button).toHaveTextContent("Место —");
  });
});
