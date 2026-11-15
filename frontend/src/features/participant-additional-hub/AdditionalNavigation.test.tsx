import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdditionalNavigation } from "./AdditionalNavigation";
import { ADDITIONAL_SECTIONS, additionalDestinations } from "./model";

function mount(navigation: string[], activeSection: "AI-Buddy" | "Настройки", active_role = "participant") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["me"], { active_role, navigation });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdditionalNavigation activeSection={activeSection} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Additional participant information architecture", () => {
  it("keeps original server section indices", () => {
    const navigation = ["Главная", "Настройки", "Задачи", "AI-Buddy"];
    expect(additionalDestinations(navigation)).toEqual([
      { label: "AI-Buddy", href: "/workspace/3" },
      { label: "Настройки", href: "/workspace/1" },
    ]);
    expect(ADDITIONAL_SECTIONS).toHaveLength(2);
  });

  it("shows useful two-tab navigation with selected state", () => {
    mount(["Главная", "AI-Buddy", "Настройки"], "Настройки");
    const nav = screen.getByRole("navigation", { name: "Подразделы дополнительного" });
    expect(nav).toBeTruthy();
    const buddy = screen.getByRole("link", { name: "AI Buddy" });
    const settings = screen.getByRole("link", { name: "Настройки" });
    expect(buddy).toHaveAttribute("href", "/workspace/1");
    expect(settings).toHaveAttribute("href", "/workspace/2");
    expect(settings).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Дополнительно" })).toBeTruthy();
  });

  it("does not invent an unauthorized AI Buddy link", () => {
    mount(["Главная", "Настройки"], "Настройки");
    expect(screen.queryByRole("link", { name: "AI Buddy" })).toBeNull();
    expect(screen.getByRole("link", { name: "Настройки" })).toHaveAttribute("href", "/workspace/1");
  });

  it("does not expose participant navigation to a customer role", () => {
    mount(["Главная", "AI-Buddy", "Настройки"], "AI-Buddy", "customer");
    expect(screen.queryByRole("navigation", { name: "Подразделы дополнительного" })).toBeNull();
  });

  it("keeps a meaningful title even when server has no authorized shortcuts", () => {
    mount(["Главная"], "AI-Buddy");
    expect(screen.getByText("Персональный помощник для обучения и рабочих вопросов.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
