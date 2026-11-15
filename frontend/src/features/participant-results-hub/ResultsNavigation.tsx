import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { RESULT_SECTIONS, resultDestinations } from "./model";
import "./results-navigation.scss";

type ResultsSection = (typeof RESULT_SECTIONS)[number];
type ViewerNavigation = { active_role: string; navigation: string[] };

/** One small, server-permission-aware rail for the four existing result pages. */
export function ResultsNavigation({ activeSection }: { activeSection: ResultsSection }) {
  const actor = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<ViewerNavigation>("/api/v1/me"),
    retry: false,
  });
  const destinations = actor.data?.active_role === "participant"
    ? resultDestinations(actor.data.navigation)
    : [];

  return (
    <div className="results-navigation" data-testid="results-navigation">
      <span className="results-navigation__label">Результаты</span>
      {destinations.length > 0 && (
        <nav className="results-navigation__tabs" aria-label="Подразделы результатов">
          {destinations.map(({ label, href }) => (
            <Link
              key={label}
              to={href}
              aria-current={label === activeSection ? "page" : undefined}
              className={label === activeSection ? "is-active" : ""}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
