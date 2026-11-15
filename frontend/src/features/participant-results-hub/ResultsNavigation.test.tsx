import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ResultsNavigation } from "./ResultsNavigation";
import { resultDestinations } from "./model";

function mount(navigation: string[], activeSection: "Портфолио" | "Аналитика" | "Достижения" | "Рейтинг", role = "participant") {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["me"], { active_role: role, navigation });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ResultsNavigation activeSection={activeSection} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Results local navigation", () => {
  const routes = ["Главная", "Задачи", "Рейтинг", "Достижения", "Аналитика", "Портфолио"];
  it("uses source route indices, independent of display order", () => {
    expect(resultDestinations(routes)).toEqual([
      { label: "Портфолио", href: "/workspace/5" },
      { label: "Аналитика", href: "/workspace/4" },
      { label: "Достижения", href: "/workspace/3" },
      { label: "Рейтинг", href: "/workspace/2" },
    ]);
  });
  it("marks active section and preserves all four links", () => {
    mount(routes, "Аналитика");
    const nav = screen.getByRole("navigation", { name: "Подразделы результатов" });
    expect(nav).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Аналитика" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Рейтинг" })).toHaveAttribute("href", "/workspace/2");
  });
  it("does not invent unauthorized destinations", () => {
    mount(["Главная", "Аналитика"], "Аналитика");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Портфолио" })).toBeNull();
  });
  it("never exposes participant destinations for another role", () => {
    mount(routes, "Рейтинг", "customer");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
