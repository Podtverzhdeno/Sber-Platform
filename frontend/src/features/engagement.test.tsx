import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TopbarEngagementIndicator } from "./engagement";
import { ANIMATION_STORAGE_KEY } from "./engagement-client";

function installOverview(overview: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      new Response(JSON.stringify(overview), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function renderIndicator(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TopbarEngagementIndicator />
    </QueryClientProvider>,
  );
}

const OVERVIEW = {
  current_days: 4,
  best_days: 9,
  qualified_dates: ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"],
  reason: "Серия сохранена сегодняшним квалифицируемым действием.",
  today_saved: true,
  grace_available: false,
};

describe("TopbarEngagementIndicator", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("shows the server-qualified streak with the non-zero explanation and calendar facts", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    fireEvent.click(screen.getByRole("button", { name: /Учебный стрик: 4 дней/ }));
    await screen.findByText("Квалифицированная серия");
    expect(screen.getByText("9 дней")).toBeTruthy();
    expect(screen.getByText(/Вход, клики и сообщения/)).toBeTruthy();
  });

  it("animates old→new only when stored value is lower, not on first paint", async () => {
    window.localStorage.setItem(ANIMATION_STORAGE_KEY, "3");
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByRole("status");
    expect(screen.getByRole("status").textContent).toContain("3 → 4");
  });

  it("does not repeat the animation after reload with equal stored data", async () => {
    window.localStorage.setItem(ANIMATION_STORAGE_KEY, "4");
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the neutral explanation instead of a zero streak lie", async () => {
    installOverview({
      current_days: 0,
      best_days: 0,
      qualified_dates: [],
      reason: "Выполните первое квалифицируемое действие, чтобы начать серию.",
      today_saved: false,
      grace_available: false,
    });
    renderIndicator();
    await screen.findByText("0");
    fireEvent.click(screen.getByRole("button", { name: /Учебный стрик: 0 дней/ }));
    await screen.findByText("Пока нет квалифицируемых действий");
    expect(screen.getAllByText(/Пока ноль/).length).toBeGreaterThan(0);
  });

  it("keeps a stale fetch failing quietly without false zero badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Response("server down", { status: 500 })),
    );
    renderIndicator();
    await waitFor(() => {
      expect(screen.getByText("…")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /стрик: 0/ })).toBeNull();
  });
});
