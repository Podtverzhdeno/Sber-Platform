import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { overviewFixture } from "./features/participant-home-v2/fixture";

const personas = [
  { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
];

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
    expect(screen.getByRole("link", { name: "Мой путь" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Очередь ревью" })).not.toBeInTheDocument();
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
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(<App />);
    expect(await screen.findByRole("button", { name: "Выйти" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));

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
      if (init?.method !== "GET") {
        return Promise.resolve(new Response(JSON.stringify({ code: "INTERNAL" }), { status: 500 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    window.history.pushState({}, "", "/workspace/0");
    render(<App />);
    expect(await screen.findByTestId("grade-summary")).toBeInTheDocument();
    expect(screen.getByTestId("grade-summary").dataset.gradeState).toBe("not_evaluable");
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", { name: "Боковая панель" });
    expect(sidebar.querySelector(".sidebar-nudge")).not.toBeInTheDocument();
    expect(sidebar.querySelector(".sidebar-art")).toBeInTheDocument();
    expect(sidebar.querySelector(".nav-icon")?.textContent).toBe("⌂");
    const homeSidebarMarkup = sidebar.innerHTML;

    window.history.pushState({}, "", "/workspace/0?v2=0");
    fireEvent.popState(window);
    await waitFor(() => {
      expect(screen.queryByTestId("grade-summary")).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Ключевые показатели" })).toBeInTheDocument();
    });
    expect(sidebar.innerHTML).toBe(homeSidebarMarkup);

    fireEvent.click(screen.getByRole("link", { name: "Мой путь" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Мой путь" })).toHaveAttribute("aria-current", "page");
    });
    expect(sidebar.querySelector(".sidebar-brand")?.innerHTML).toContain("Impulse");
    expect(sidebar.querySelector(".nav-icon")?.textContent).toBe("⌂");
    expect(sidebar.querySelector(".sidebar-art")).toBeInTheDocument();
  });
});
