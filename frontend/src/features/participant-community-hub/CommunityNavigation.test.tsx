import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CommunityNavigation } from "./CommunityNavigation";
import { communityDestinations } from "./model";

function renderNav(navigation: string[], activeSection: "События" | "Сообщения", role = "participant") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], { navigation, active_role: role });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommunityNavigation activeSection={activeSection} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Community group minimal navigation", () => {
  const authorized = ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Сообщения", "Мои проекты", "События"];

  it("keeps original server route indices even when visual order is different", () => {
    expect(communityDestinations(authorized)).toEqual([
      { label: "События", href: "/workspace/6" },
      { label: "Сообщения", href: "/workspace/4" },
    ]);
  });

  it("shows both permitted subsections and current state", () => {
    renderNav(authorized, "События");
    const nav = screen.getByRole("navigation", { name: "Подразделы сообщества" });
    const events = screen.getByRole("link", { name: "События" });
    const messages = screen.getByRole("link", { name: "Сообщения" });
    expect(nav).toBeTruthy();
    expect(events).toHaveAttribute("href", "/workspace/6");
    expect(events).toHaveAttribute("aria-current", "page");
    expect(messages).toHaveAttribute("href", "/workspace/4");
    expect(messages).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "Сообщество" })).toBeTruthy();
  });

  it("never invents a destination that is not authorized", () => {
    renderNav(["Главная", "События"], "События");
    expect(screen.getByRole("link", { name: "События" })).toHaveAttribute("href", "/workspace/1");
    expect(screen.queryByRole("link", { name: "Сообщения" })).toBeNull();
  });

  it("uses compact tabs inside Messenger without repeating a page hero", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], { navigation: authorized, active_role: "participant" });
    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CommunityNavigation activeSection="Сообщения" compact />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(view.container.querySelector(".community-navigation--compact")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Сообщество" })).toBeNull();
    expect(screen.getByRole("link", { name: "События" })).toHaveAttribute("href", "/workspace/6");
    expect(screen.getByRole("link", { name: "Сообщения" })).toHaveAttribute("aria-current", "page");
  });

  it("does not show participant links to another role", () => {
    renderNav(authorized, "Сообщения", "customer");
    expect(screen.queryByRole("navigation", { name: "Подразделы сообщества" })).toBeNull();
  });

  it("does not render a link when no destinations are authorized", () => {
    renderNav(["Главная"], "Сообщения");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
