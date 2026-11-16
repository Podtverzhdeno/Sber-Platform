/** Presentation-only links; server actor.navigation determines route indexes. */
export type PracticeSection = "tasks" | "active" | "projects";

export interface PracticeDestination {
  readonly id: PracticeSection;
  readonly label: string;
  readonly href: string;
}

function authorizedIndex(navigation: readonly string[], names: readonly string[]): number {
  return navigation.findIndex((label) => names.includes(label));
}

/**
 * 'В работе' uses the existing projects filter and is not a new route.
 * No user-specific counts or progression state is computed on the client.
 */
export function practiceDestinations(navigation: readonly string[]): readonly PracticeDestination[] {
  const tasks = authorizedIndex(navigation, ["Задачи", "Мои задачи"]);
  const projects = authorizedIndex(navigation, ["Мои проекты", "Проекты"]);
  const destinations: PracticeDestination[] = [];
  if (tasks >= 0) {
    destinations.push({ id: "tasks", label: "Задачи", href: `/workspace/${String(tasks)}` });
  }
  if (projects >= 0) {
    destinations.push(
      { id: "active", label: "В работе", href: `/workspace/${String(projects)}?filter=active` },
      { id: "projects", label: "Мои проекты", href: `/workspace/${String(projects)}` },
    );
  }
  return destinations;
}

export function activePracticeSection(
  activePage: "tasks" | "projects",
  projectFilter: string | null,
): PracticeSection {
  return activePage === "tasks" ? "tasks" : projectFilter === "active" ? "active" : "projects";
}
