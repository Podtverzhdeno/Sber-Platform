import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

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

    expect(screen.getByText("Демо-режим · синтетические данные")).toBeInTheDocument();
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
            navigation: ["Мой путь", "Bootcamp", "Задачи", "Портфолио"],
            csrf_token: "csrf",
          }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 401 }));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Алекс Речной/ }));

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Мой путь" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Очередь ревью" })).not.toBeInTheDocument();
  });
});
