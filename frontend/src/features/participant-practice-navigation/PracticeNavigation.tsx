import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { apiRequest } from "../../api/client";
import { activePracticeSection, practiceDestinations } from "./model";
import "./practice-navigation.scss";

interface AuthorizedActor {
  readonly active_role: string;
  readonly navigation: string[];
}

/** Compact, permission-aware subsection navigation for the two existing Practice routes. */
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
    <div className="practice-navigation" data-testid="practice-navigation">
      <span className="practice-navigation__label">Практика</span>
      {destinations.length > 0 && (
        <nav className="practice-navigation__tabs" aria-label="Подразделы практики">
          {destinations.map((destination) => (
            <Link
              key={destination.id}
              to={destination.href}
              aria-current={destination.id === active ? "page" : undefined}
              className={destination.id === active ? "is-active" : undefined}
            >
              {destination.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
