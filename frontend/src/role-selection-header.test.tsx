import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { resetAppQueryCacheForTests } from "./app/query";

beforeEach(() => {
  resetAppQueryCacheForTests();
  window.history.replaceState({}, "", "/choose-role");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Role selection header", () => {
  it("does not render the Impulse branding or an empty topbar on the persona chooser", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/auth/personas")) {
        return Promise.resolve(new Response(JSON.stringify([
          { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
        ]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ code: "AUTH_REQUIRED" }), { status: 401 }));
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: /Алекс Речной/ })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Выберите роль, чтобы присоединиться" })).toBeInTheDocument();
    expect(document.querySelector(".page-shell > .topbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Impulse — на главную/ })).not.toBeInTheDocument();
  });
});
