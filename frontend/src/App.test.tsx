import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { resetAppQueryCacheForTests } from "./app/query";
import { overviewFixture } from "./features/participant-home-v2/fixture";

const personas = [
  { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
];

beforeEach(() => { resetAppQueryCacheForTests(); });
afterEach(() => vi.restoreAllMocks());

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("App", () => {
  it("shows the explicit demo boundary and available personas", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/personas")) {
        return Promise.resolve(new Response(JSON.stringify(personas), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ code: "AUTH_REQUIRED" }), { status: 401 }),
      );
    });
    render(<App />);

    expect(screen.queryByText("Демо-режим · синтетические данные")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Алекс Речной/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Тема: .*Переключить/ })).toBeInTheDocument();
  });

  it("logs in and renders only navigation returned for the role", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith("/personas")) {
        return Promise.resolve(new Response(JSON.stringify(personas), { status: 200 }));
      }
      if (init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({
            person_id: "00000000-0000-0000-0000-000000000001",
            display_name: "Алекс Речной",
            active_role: "participant",
            assigned_roles: ["participant"],
            scopes: [],
            consent_scopes: [],
            navigation: ["Главная", "Мой путь", "Bootcamp", "Задачи", "Портфолио"],
            csrf_token: "csrf",
          }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 401 }));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Алекс Речной/ }));

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Главная" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Развитие/ })).toHaveAttribute("aria-expanded", "false");
    const sidebar = screen.getByRole("complementary", { name: "Боковая панель" });
    const developmentGroup = within(sidebar).getByRole("button", { name: /Развитие/ });
    fireEvent.click(developmentGroup);
    await waitFor(() => expect(developmentGroup).toHaveAttribute("aria-expanded", "true"));
    expect(within(sidebar).getByRole("link", { name: "Мой путь" })).toHaveAttribute("href", "/workspace/1");
    expect(screen.queryByRole("link", { name: "Очередь ревью" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Тема: .*Сменить тему/ })).toBeInTheDocument();
  });

  it("returns to persona selection even when server logout fails", async () => {
    const actor = {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Алекс Речной",
      active_role: "participant",
      assigned_roles: ["participant"],
      scopes: [],
      consent_scopes: [],
      navigation: ["Главная"],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/personas")) {
        return Promise.resolve(new Response(JSON.stringify(personas), { status: 200 }));
      }
      if (url.endsWith("/auth/logout")) {
        return Promise.resolve(new Response(JSON.stringify({ code: "INTERNAL_ERROR", message: "Ошибка" }), { status: 500 }));
      }
      if (url.endsWith("/me")) {
        return Promise.resolve(new Response(JSON.stringify(actor), { status: 200 }));
      }
      if (url.endsWith("/development-overview")) {
        return Promise.resolve(new Response(JSON.stringify(overviewFixture), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Меню профиля" }));
    const signOut = screen.getByRole("menuitem", { name: "Выйти" });
    expect(signOut).toBeEnabled();
    fireEvent.click(signOut);

    expect(await screen.findByRole("button", { name: /Алекс Речной/ })).toBeEnabled();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders the approved home by default and preserves explicit legacy rollback", async () => {
    const actor = {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Алекс Речной",
      active_role: "participant",
      assigned_roles: ["participant"],
      scopes: [],
      consent_scopes: [],
      navigation: ["Главная", "Мой путь", "Bootcamp", "Задачи", "Портфолио"],
      csrf_token: "csrf",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith("/personas")) {
        return Promise.resolve(new Response(JSON.stringify(personas), { status: 200 }));
      }
      if (url.endsWith("/me")) {
        return Promise.resolve(new Response(JSON.stringify(actor), { status: 200 }));
      }
      if (url.endsWith("/development-overview")) {
        return Promise.resolve(new Response(JSON.stringify(overviewFixture), { status: 200 }));
      }
      // A missing role-level projection is an explicit API error, not malformed successful data.
      if (url.includes("/bootcamp/impulse-level")) {
        return Promise.resolve(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }));
      }
      if (init?.method !== "GET") {
        return Promise.resolve(new Response(JSON.stringify({ code: "INTERNAL" }), { status: 500 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    window.history.pushState({}, "", "/workspace/0");
    render(<App />);
    // The actual default home is now the approved pixel dashboard, with real API data.
    expect(await screen.findByTestId("pixel-live-shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Impulse — открыть разделы" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Прогресс обязательных курсов" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", { name: "Боковая панель" });
    expect(sidebar.querySelector(".calm-sidebar__brand")?.textContent).toContain("Impulse");
    expect(sidebar.querySelector(".sidebar-art")).toBeNull();
    const homeHref = sidebar.querySelector(".calm-sidebar__home")?.getAttribute("href");
    expect(homeHref).toBe("/workspace/0");

    // Explicit rollback keeps the previous detailed home intact without changing navigation.
    window.history.pushState({}, "", "/workspace/0?home=legacy");
    fireEvent.popState(window);
    expect(await screen.findByTestId("grade-summary")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("grade-summary").dataset.gradeState).toBe("unavailable");
    });
    expect(screen.queryByTestId("pixel-live-shell")).not.toBeInTheDocument();
    expect(sidebar.querySelector(".calm-sidebar__home")?.getAttribute("href")).toBe(homeHref);

    // The pre-existing v2=0 fallback still works.
    window.history.pushState({}, "", "/workspace/0?v2=0");
    fireEvent.popState(window);
    await waitFor(() => {
      expect(screen.queryByTestId("grade-summary")).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Ключевые показатели" })).toBeInTheDocument();
    });
    expect(sidebar.querySelector(".calm-sidebar__home")?.getAttribute("href")).toBe(homeHref);

    const group = within(sidebar).getByRole("button", { name: /Развитие/ });
    fireEvent.click(group);
    await waitFor(() => expect(group).toHaveAttribute("aria-expanded", "true"));
    fireEvent.click(within(sidebar).getByRole("link", { name: "Мой путь" }));
    await waitFor(() => {
      expect(within(sidebar).getByRole("link", { name: "Мой путь" })).toHaveAttribute("aria-current", "page");
    });
    expect(sidebar.querySelector(".calm-sidebar__brand")?.textContent).toContain("Impulse");
    expect(sidebar.querySelector(".sidebar-message")).toBeNull();
  });
  it("reuses one sidebar for home, analytics and messages", async () => {
    const actor = {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Алекс Речной",
      active_role: "participant",
      assigned_roles: ["participant"],
      scopes: [],
      consent_scopes: [],
      navigation: ["Главная", "Аналитика", "Сообщения"],
      csrf_token: "csrf",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/personas")) {
        return Promise.resolve(new Response(JSON.stringify(personas), { status: 200 }));
      }
      if (url.endsWith("/me")) {
        return Promise.resolve(new Response(JSON.stringify(actor), { status: 200 }));
      }
      if (url.endsWith("/development-overview")) {
        return Promise.resolve(new Response(JSON.stringify(overviewFixture), { status: 200 }));
      }
      // An unimplemented endpoint is an HTTP error, not a successful `{}` schema violation.
      return Promise.resolve(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }));
    });
    window.history.pushState({}, "", "/workspace/0");
    render(<App />);

    const sidebar = await screen.findByRole("complementary", { name: "Боковая панель" });
    const signature = () => ({
      brand: sidebar.querySelector(".calm-sidebar__brand")?.textContent,
      groups: Array.from(sidebar.querySelectorAll(".calm-sidebar__group"), (item) => item.textContent),
      promo: sidebar.querySelector(".sidebar-message")?.innerHTML,
    });
    const initial = signature();
    expect(initial.promo).toBeUndefined();

    for (const section of ["Аналитика", "Сообщения", "Главная"]) {
      // The active section may have already expanded its group. Clicking it
      // unconditionally would instead collapse the already-visible link.
      const groupName = section === "Аналитика" ? /Результаты/ :
        section === "Сообщения" ? /Сообщество/ : null;
      if (groupName) {
        const group = screen.getByRole("button", { name: groupName });
        if (group.getAttribute("aria-expanded") !== "true") {
          fireEvent.click(group);
        }
        await waitFor(() => {
          expect(group).toHaveAttribute("aria-expanded", "true");
        });
      }
      // Each results/community page also has its own in-page tab with the
      // same accessible name. Verify the shared sidebar, not a global first match.
      const routeLink = await within(sidebar).findByRole("link", { name: section });
      fireEvent.click(routeLink);
      await waitFor(() => {
        expect(within(sidebar).getByRole("link", { name: section })).toHaveAttribute("aria-current", "page");
      });
      expect(signature()).toEqual(initial);
      expect(sidebar.querySelector(".calm-sidebar__brand")?.textContent).toContain("Impulse");
    }
  });

  it("switches among three themes without changing role or route", async () => {
    window.localStorage.clear();
    window.localStorage.setItem("impulse-visual-mode", "blue");
    const actor = {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Алекс Речной",
      active_role: "participant",
      assigned_roles: ["participant"],
      scopes: [], consent_scopes: [],
      navigation: ["Главная", "Bootcamp", "Сообщения"], csrf_token: "csrf",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/me")) return Promise.resolve(new Response(JSON.stringify(actor), { status: 200 }));
      if (url.endsWith("/development-overview")) return Promise.resolve(new Response(JSON.stringify(overviewFixture), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }));
    });
    window.history.pushState({}, "", "/workspace/0");
    render(<App />);
    const theme = await screen.findByRole("button", { name: /Тема: .*Сменить тему/ });
    // User-controlled 3-state compact icon, no obsolete fourth "system" option.
    fireEvent.click(theme);
    await waitFor(() => { expect(document.documentElement.dataset.impulseVisualMode).toBe("midnight"); });
    expect(window.localStorage.getItem("impulse-theme")).toBe("dark");
    fireEvent.click(theme);
    await waitFor(() => { expect(document.documentElement.dataset.impulseVisualMode).toBe("light"); });
    expect(window.localStorage.getItem("impulse-theme")).toBe("light");
    fireEvent.click(theme);
    await waitFor(() => { expect(document.documentElement.dataset.impulseVisualMode).toBe("blue"); });
    expect(window.localStorage.getItem("impulse-theme")).toBe("dark");
    expect(window.location.pathname).toBe("/workspace/0");
    expect(screen.getByRole("link", { name: "Главная" })).toBeInTheDocument();
  });

  it("uses truthful customer/HR fallback content instead of synthetic performance metrics", async () => {
    const actor = {
      person_id: "00000000-0000-0000-0000-000000000003",
      display_name: "Вера Лебедева",
      active_role: "hr",
      assigned_roles: ["hr"],
      scopes: [], consent_scopes: [],
      navigation: ["Главная", "Кандидаты", "Воронка", "Аналитика", "Сообщения"],
      csrf_token: "csrf",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/me")) return Promise.resolve(new Response(JSON.stringify(actor), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }));
    });
    window.history.pushState({}, "", "/workspace/0");
    render(<App />);
    expect(await screen.findByTestId("apple-role-home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Главная", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("346")).not.toBeInTheDocument();
    expect(screen.queryByText("39% приглашений")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Открыть кандидаты/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Открыть кандидаты/ }));
    await waitFor(() => { expect(window.location.pathname).toBe("/workspace/1"); });
    expect(screen.getByRole("navigation", { name: "Навигация роли" })).toBeInTheDocument();
  });

});
