import { useQuery } from "@tanstack/react-query";
import { Clock3, FolderKanban, ListTodo } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { apiRequest } from "../../api/client";
import { activePracticeSection, practiceDestinations } from "./model";
import "./practice-navigation.scss";
import "./practice-calm-surfaces.scss";

interface AuthorizedActor {
  readonly active_role: string;
  readonly navigation: string[];
}

const sectionIcons = {
  tasks: ListTodo,
  active: Clock3,
  projects: FolderKanban,
} as const;

/**
 * Real destination links, not a panel-only tab widget.
 *
 * The second item is the existing projects active-filter route. Every href
 * still comes from the server's authorized navigation ordering.
 * The control is hidden for roles without participant destinations.
 */
export function PracticeNavigation({ activePage }: { activePage: "tasks" | "projects" }) {
  const [params] = useSearchParams();
  const actor = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<AuthorizedActor>("/api/v1/me"),
    retry: false,
  });
  const destinations = actor.data?.active_role === "participant"
    ? practiceDestinations(actor.data.navigation)
    : [];
  const active = activePracticeSection(activePage, params.get("filter"));

  return (
    <div className="practice-navigation" data-testid="practice-navigation" data-active-section={active}>
      <div className="practice-navigation__heading">
        <span className="practice-navigation__label">Практика</span>
        <span className="practice-navigation__description">Задачи, работа и проекты</span>
      </div>
      {destinations.length > 0 && (
        <nav className="practice-navigation__tabs" aria-label="Подразделы практики">
          {destinations.map((destination) => {
            const Icon = sectionIcons[destination.id];
            return (
              <Link
                key={destination.id}
                to={destination.href}
                aria-current={destination.id === active ? "page" : undefined}
                className={destination.id === active ? "is-active" : undefined}
              >
                <Icon size={17} strokeWidth={1.85} aria-hidden="true" focusable="false" />
                <span>{destination.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
