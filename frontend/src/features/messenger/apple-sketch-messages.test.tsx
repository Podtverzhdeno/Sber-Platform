import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessagingWorkspace } from "../collaboration";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

function renderRole(role: "participant" | "mentor" | "customer") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MessagingWorkspace role={role} personId="person-visible" />
    </QueryClientProvider>,
  );
}

function referenceRoot() {
  return document.querySelector(".messenger-page.apple-messages-2026");
}

describe("Apple Sketch styling on the live messenger", () => {
  it.each(["participant", "mentor", "customer"] as const)(
    "preserves the source-styled accessible messenger in %s workspace",
    async (role) => {
      vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
        const url = input instanceof Request ? new URL(input.url).pathname : String(input);
        if (url === "/api/v1/me/messaging/channels") {
          return Promise.resolve(new Response("[]", { status: 200 }));
        }
        return Promise.resolve(new Response("[]", { status: 200 }));
      });
      renderRole(role);
      await screen.findByRole("heading", { name: "Выберите диалог или сообщество" });
      expect(referenceRoot()).toHaveAttribute("data-visual-reference", "R-MSG-01");
      expect(referenceRoot()).toHaveClass("sberchat-shell", "sberchat-reference", "apple-messages-2026");
      expect(screen.getByRole("complementary", { name: "Список диалогов" })).toBeInTheDocument();
    },
  );

  it("keeps Apple styling when channels fail, while displaying an actionable error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ code: "NETWORK_ERROR", message: "Не удалось загрузить" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    ));
    renderRole("participant");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Не удалось загрузить" })).toBeInTheDocument();
    });
    expect(referenceRoot()).toHaveClass("apple-messages-2026");
    expect(screen.getByRole("button", { name: "Обновить" })).toBeEnabled();
  });

  it("keeps Apple styling on pending channel requests without inventing messages", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => {}));
    renderRole("mentor");
    expect(referenceRoot()).toHaveClass("apple-messages-2026");
    expect(screen.getByRole("heading", { name: "Загружаем данные" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Текст сообщения" })).not.toBeInTheDocument();
  });
});
