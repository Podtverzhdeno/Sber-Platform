import { useQuery } from "@tanstack/react-query";
import { Award, BriefcaseBusiness, ChartNoAxesCombined, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { apiRequest } from "../../api/client";
import { RESULT_SECTIONS, resultDestinations } from "./model";
import "./results-navigation.scss";
import "./results-page-surfaces.scss";

type ResultsSection = (typeof RESULT_SECTIONS)[number];
type ViewerNavigation = { active_role: string; navigation: string[] };

const icons = {
  "Портфолио": BriefcaseBusiness,
  "Аналитика": ChartNoAxesCombined,
  "Достижения": Award,
  "Рейтинг": Trophy,
} as const;

/**
 * One native-feeling, content-first destination switcher across all four real
 * Results pages. This is route navigation, NOT a tab-panel widget:
 * links preserve the exact server-authorized /workspace/:index and history.
 *
 * Compact layouts always expose every authorized destination without
 * horizontal scrolling (2 × 2 on phones, 4 across on tablets).
 */
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
    <div className="results-navigation" data-testid="results-navigation" data-active-section={activeSection}>
      <div className="results-navigation__heading">
        <span className="results-navigation__label">Результаты</span>
        <span className="results-navigation__description">Подтверждённый опыт и прогресс</span>
      </div>
      {destinations.length > 0 && (
        <nav className="results-navigation__tabs" aria-label="Подразделы результатов">
          {destinations.map(({ label, href }) => {
            const Icon = icons[label];
            return (
              <Link
                key={label}
                to={href}
                aria-current={label === activeSection ? "page" : undefined}
                className={label === activeSection ? "is-active" : undefined}
              >
                <Icon size={17} strokeWidth={1.85} aria-hidden="true" focusable="false" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
