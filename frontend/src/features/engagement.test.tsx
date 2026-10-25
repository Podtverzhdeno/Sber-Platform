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
    expect(screen.getAllByText(/Пока ноль/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Открыть полный календарь серии" }));
    await screen.findByText("Пока нет квалифицируемых действий");
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
    await screen.findByText("2 в запасе");
    await screen.findByText(/заморозка не считается активностью/);
    fireEvent.click(screen.getByRole("button", { name: "Открыть полный календарь серии" }));
    const tiles = screen.getAllByText("2026-10-21");
    const frozenTile = tiles.find((tile) => tile.closest(".engagement-day--frozen"));
    expect(frozenTile).toBeDefined();
  });

  it("keeps the manual freeze button hidden while the streak is alive", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText("2 в запасе");
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
    await screen.findByText("0 в запасе");
    expect(screen.queryByRole("button", { name: /Использовать заморозку/ })).toBeNull();
  });

  const RHYTHM = {
    versioned: true,
    history_count: 1,
    version: 1,
    preset: "workdays",
    active_days: [1, 2, 3, 4, 5],
    reminder_hour: 18,
    reminder_window_hours: 3,
    effective_from: "2026-10-19",
    week_start: "2026-10-19",
    week_end: "2026-10-25",
    target_days: 5,
    done_days: 2,
    hint: "Недельный ритм — согласованное расписание; он не тождественен серии и не закрывает пропуски.",
  };

  it("renders rhythm progress and keeps it visually distinct from the streak", async () => {
    const fetchMock = installOverview(OVERVIEW);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if ((init?.method ?? "GET") === "POST") {
        throw new Error("rhythm summary route is GET-only in this test");
      }
      const payload = key === "/api/v1/me/engagement/rhythm" ? RHYTHM : OVERVIEW;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText("2 из 5 за неделю");
    expect(screen.queryByText(/Запланировано новое соглашение/)).toBeNull();
    expect(screen.getByText(/не тождественен серии/)).toBeTruthy();
    expect(screen.getByText(/Соглашение v1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Сохранить ритм" })).toBeTruthy();
    expect(document.querySelector(".streak-headline")?.textContent).toContain("4 дней подряд");
  });

  it("keeps the active contract visible when a future version is scheduled", async () => {
    const fetchMock = installOverview(OVERVIEW);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if ((init?.method ?? "GET") === "POST") {
        throw new Error("rhythm summary route is GET-only in this test");
      }
      const payload =
        key === "/api/v1/me/engagement/rhythm"
          ? { ...RHYTHM, scheduled_from: "2026-10-25", scheduled_preset: "weekends" }
          : OVERVIEW;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText("2 из 5 за неделю");
    await screen.findByText(/Новое расписание: Выходные, с 2026-10-25/);
    expect(screen.getByText(/Соглашение v1/)).toBeTruthy();
  });

  it("saves a custom rhythm with the csrf token and ISO weekdays", async () => {
    const fetchMock = installOverview(OVERVIEW);
    let savedBody: Record<string, unknown> | null = null;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if (key === "/api/v1/me/engagement/rhythm" && init?.method === "POST") {
        if (typeof init.body !== "string") {
          throw new Error("rhythm save must post a json string body");
        }
        savedBody = JSON.parse(init.body) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...RHYTHM,
            preset: "custom",
            active_days: [3, 5],
            version: 2,
            history_count: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const payload = key === "/api/v1/me/engagement/rhythm" ? RHYTHM : OVERVIEW;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Свой список" }));
    fireEvent.click(screen.getByRole("button", { name: "Ср" }));
    fireEvent.click(screen.getByRole("button", { name: "Пт" }));
    const dateInput = document.querySelector<HTMLInputElement>(
      ".engagement-rhythm-schedule input[type=date]",
    );
    if (!dateInput) {
      throw new Error("date input missing");
    }
    fireEvent.change(dateInput, { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить ритм" }));
    await screen.findByText(/Соглашение v2 сохранено/);
    expect(savedBody).toEqual(
      expect.objectContaining({
        preset: "custom",
        custom_days: [3, 5],
        reminder_hour: 18,
        reminder_window_hours: 3,
        effective_from: "2026-10-22",
      }),
    );
    const saveCall = fetchMock.mock.calls.find((call) => {
      const [calledInput, calledInit] = call as [RequestInfo | URL, RequestInit | undefined];
      return routeKey(calledInput) === "/api/v1/me/engagement/rhythm" && calledInit?.method === "POST";
    });
    if (!saveCall) {
      throw new Error("rhythm save POST was not issued");
    }
    const [, calledInit] = saveCall as [RequestInfo | URL, RequestInit | undefined];
    const headers = calledInit?.headers;
    if (!headers || typeof headers !== "object" || !("X-CSRF-Token" in headers)) {
      throw new Error("rhythm save POST must carry the csrf header");
    }
    expect((headers as Record<string, unknown>)["X-CSRF-Token"]).toBe("test-csrf");
  });

  it("surfaces the server contract message when the save is rejected", async () => {
    const fetchMock = installOverview(OVERVIEW);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if (key === "/api/v1/me/engagement/rhythm" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            code: "RETROACTIVE_CONTRACT",
            message:
              "Дата вступления силы не может быть в прошлом: ритм не задним числом закрывает пропуски.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (key === "/api/v1/me/engagement/rhythm") {
        return new Response(
          JSON.stringify({
            versioned: false,
            history_count: 0,
            version: null,
            preset: null,
            active_days: [],
            reminder_hour: null,
            reminder_window_hours: null,
            effective_from: null,
            week_start: "2026-10-19",
            week_end: "2026-10-25",
            target_days: null,
            done_days: null,
            hint: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(OVERVIEW), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить ритм" }));
    await screen.findByText(/не задним числом закрывает пропуски/, { exact: false });
    expect(screen.getByRole("alert").textContent).toContain("не может быть в прошлом");
  });

  it("keeps the popover intact when the rhythm service is unavailable", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText("Квалифицированная серия");
    expect(screen.queryByText("Недельный ритм")).toBeNull();
    expect(screen.queryByText("Сохранить ритм")).toBeNull();
  });

  it("never claims an active rhythm while the only contract is future-dated", async () => {
    const fetchMock = installOverview(OVERVIEW);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const key = routeKey(input);
      if ((init?.method ?? "GET") === "POST") {
        throw new Error("rhythm summary route is GET-only in this test");
      }
      const payload =
        key === "/api/v1/me/engagement/rhythm"
          ? {
              versioned: false,
              history_count: 1,
              version: null,
              preset: null,
              active_days: [],
              reminder_hour: null,
              reminder_window_hours: null,
              effective_from: null,
              week_start: "2026-10-19",
              week_end: "2026-10-25",
              target_days: null,
              done_days: null,
              hint: null,
              scheduled_from: "2026-10-25",
              scheduled_preset: "weekends",
            }
          : OVERVIEW;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    await screen.findByText(/Будущее расписание: Выходные, с 2026-10-25/);
    expect(screen.queryByText("из 0 в этой неделе")).toBeNull();
    expect(screen.getByRole("button", { name: "Сохранить ритм" })).toBeTruthy();
  });

  it("shows only the compact week until full history is explicitly opened", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    expect(screen.getByRole("dialog", { name: "Учебный стрик" })).toBeInTheDocument();
    expect(screen.queryByText("2026-10-17")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Открыть полный календарь серии" }));
    expect(screen.getByText("2026-10-17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Вернуться к серии/ }));
    expect(screen.queryByText("2026-10-17")).toBeNull();
  });

  it("closes with Escape and restores focus on the streak trigger", async () => {
    installOverview(OVERVIEW);
    renderIndicator();
    await screen.findByText("4");
    const trigger = screen.getByRole("button", { name: /Учебный стрик:/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Учебный стрик" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => { expect(screen.queryByRole("dialog", { name: "Учебный стрик" })).toBeNull(); });
    expect(trigger).toHaveFocus();
  });

  it("explains weekly rhythm from the question-mark control", async () => {
    const fetchMock = installOverview(OVERVIEW);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const key = routeKey(input);
      return new Response(JSON.stringify(key === "/api/v1/me/engagement/rhythm" ? {
        versioned: true, history_count: 1, version: 1, preset: "workdays",
        active_days: [1,2,3,4,5], reminder_hour: 18, reminder_window_hours: 3,
        effective_from: "2026-10-19", week_start: "2026-10-19",
        week_end: "2026-10-25", target_days: 5, done_days: 2,
        hint: null, scheduled_from: null, scheduled_preset: null,
      } : OVERVIEW), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    renderIndicator();
    await screen.findByText("4");
    openPopover();
    const help = await screen.findByRole("button", { name: "Что такое недельный ритм?" });
    fireEvent.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Сам по себе ритм не засчитывает дни");
  });

});
