import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { PracticeNavigation } from "./PracticeNavigation";
import { activePracticeSection, practiceDestinations } from "./model";

afterEach(cleanup);

function mount({
  navigation,
  role = "participant",
  activePage = "tasks",
  initialEntry = "/workspace/1",
}: {
  navigation: string[];
  role?: string;
  activePage?: "tasks" | "projects";
  initialEntry?: string;
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["me"], { active_role: role, navigation });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PracticeNavigation activePage={activePage} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("authorized Practice subsection navigation", () => {
  const sections = ["Главная", "Мои проекты", "Портфолио", "Задачи"];

  it("preserves server route indexes and links to the real active filter", () => {
    expect(practiceDestinations(sections)).toEqual([
      { id: "tasks", label: "Задачи", href: "/workspace/3" },
      { id: "active", label: "В работе", href: "/workspace/1?filter=active" },
      { id: "projects", label: "Мои проекты", href: "/workspace/1" },
    ]);
  });

  it("shows all three tabs with accessible current destination", () => {
    mount({ navigation: sections, activePage: "tasks", initialEntry: "/workspace/3" });
    const nav = screen.getByRole("navigation", { name: "Подразделы практики" });
    expect(nav).toBeInTheDocument();
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Задачи" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "В работе" })).toHaveAttribute("href", "/workspace/1?filter=active");
  });

  it("highlights real in-progress projects and defaults to all projects", () => {
    expect(activePracticeSection("projects", "active")).toBe("active");
    expect(activePracticeSection("projects", "review")).toBe("projects");
    mount({ navigation: sections, activePage: "projects", initialEntry: "/workspace/1?filter=active" });
    expect(screen.getByRole("link", { name: "В работе" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Мои проекты" })).not.toHaveAttribute("aria-current");
  });

  it("does not invent a missing project or task permission", () => {
    expect(practiceDestinations(["Главная", "Задачи"])).toEqual([
      { id: "tasks", label: "Задачи", href: "/workspace/1" },
    ]);
    mount({ navigation: ["Главная", "Задачи"] });
    expect(screen.getByRole("link", { name: "Задачи" })).toHaveAttribute("href", "/workspace/1");
    expect(screen.queryByRole("link", { name: "В работе" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Мои проекты" })).toBeNull();
  });

  it("does not expose participant links to other roles", () => {
    mount({ navigation: sections, role: "customer" });
    expect(screen.queryByRole("navigation", { name: "Подразделы практики" })).toBeNull();
  });

  it("does not invent pages for authorized labels unsupported by the current route switch", () => {
    expect(practiceDestinations(["Проекты", "Мои задачи"])).toEqual([]);
  });
});
