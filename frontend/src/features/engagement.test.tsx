import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TopbarEngagementIndicator } from "./engagement";
import { ANIMATION_STORAGE_KEY } from "./engagement-client";

function routeKey(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let key = raw.replace(/^https?:\/\/[^/]*\/api\/v1/, "/api/v1");
  const base = key.split("?")[0];
  key = base ?? key;
  return key;
}

const FREEZE = {
  policy_version: 1,
  granted_total: 3,
  available: 2,
  consumed_total: 1,
};

function installRoutes(map: Record<string, Record<string, unknown>>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    let key = routeKey(input);
    if (key === "/api/v1/me/engagement/freeze/use" && init?.method === "POST") {
      key = "/api/v1/me/engagement/freeze/use:POST";
    }
    const payload = map[key];
    if (!payload) {
      return new Response("missing stub", { status: 404 });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installOverview(overview: Record<string, unknown>): ReturnType<typeof vi.fn> {
  return installRoutes({
    "/api/v1/me/engagement/overview": overview,
    "/api/v1/me/engagement/freeze": FREEZE,
  });
}

function renderIndicator(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TopbarEngagementIndicator />
    </QueryClientProvider>,
  );
}

function openPopover(): void {
  fireEvent.click(screen.getByRole("button", { name: /Учебный стрик:/ }));
}

const OVERVIEW = {
  current_days: 4,
  best_days: 9,
  qualified_dates: ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"],
  reason: "Серия сохранена сегодняшним квалифицируемым действием.",
  today_saved: true,
  grace_available: false,
  frozen_dates: [],
  freeze_state: "idle",
};

describe("TopbarEngagementIndicator", () => {
  beforeEach(() => {
    window.localStorage.clear();
    sessionStorage.setItem("impulse_csrf", "test-csrf");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    sessionStorage.clear();
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
      frozen_dates: [],
      freeze_state: "idle",
    });
    renderIndicator();
    await screen.findByText("0");
    openPopover();
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

  it("shows freeze stock in facts and never labels freeze days as activity", async () => {
    installOverview({
      ...OVERVIEW,
      current_days: 3,
      qualified_dates: ["2026-10-18", "2026-10-19", "2026-10-20"],
      today_saved: false,
      frozen_dates: ["2026-10-21"],
      freeze_state: "frozen",
    });
    renderIndicator();
    await screen.findByText("3");
    openPopover();
    await screen.findByText("2 в запасе · использовано 1");
    await screen.findByText(/заморозка не считается активностью/);
    const tiles = screen.getAllByText("2026-10-21");
    const frozenTile = tiles.find((tile) => tile.closest(".engagement-day--frozen"));
    expect(frozenTile).toBeDefined();
  });

  it("keeps the manual freeze button hidden while the streak is alive", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText("2 в запасе · использовано 1");
    expect(screen.queryByRole("button", { name: /Использовать заморозку/ })).toBeNull();
  });

  it("keeps the freeze use honest when the server reports the bridge is not eligible", async () => {
    let used = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if (key === "/api/v1/me/engagement/freeze/use" && init?.method === "POST") {
        used = true;
        return new Response(
          JSON.stringify({
            ...OVERVIEW,
            current_days: 0,
            today_saved: false,
            reason: "Серия прервана: последний квалифицированный день был раньше вчерашнего.",
            frozen_dates: [],
            freeze_state: "break",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const data =
        key === "/api/v1/me/engagement/overview"
          ? {
              ...OVERVIEW,
              current_days: 0,
              today_saved: false,
              reason: "Серия прервана: последний квалифицированный день был раньше вчерашнего.",
              frozen_dates: [],
              freeze_state: "break",
            }
          : FREEZE;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderIndicator();
    await screen.findByText("0");
    openPopover();
    const button = await screen.findByRole("button", { name: /Использовать заморозку/ });
    fireEvent.click(button);
    await screen.findByText(/серия прервана глубже одного пропущенного дня/);
    expect(screen.queryByText(/заморозка не считается активностью/)).toBeNull();
    expect(used).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/me/engagement/freeze/use",
      expect.objectContaining({
        method: "POST",
        headers: { "X-CSRF-Token": "test-csrf" },
      }),
    );
  });

  it("hides the freeze button when the stock is empty", async () => {
    installRoutes({
      "/api/v1/me/engagement/overview": {
        ...OVERVIEW,
        current_days: 0,
        today_saved: false,
        freeze_state: "out_of_stock",
      },
      "/api/v1/me/engagement/freeze": { ...FREEZE, available: 0 },
    });
    renderIndicator();
    await screen.findByText("0");
    openPopover();
    await screen.findByText("0 в запасе · использовано 1");
    expect(screen.queryByRole("button", { name: /Использовать заморозку/ })).toBeNull();
  });
});
