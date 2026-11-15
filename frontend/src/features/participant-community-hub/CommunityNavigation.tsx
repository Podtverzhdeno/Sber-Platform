import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { apiRequest } from "../../api/client";
import { communityDestinations, type CommunitySection } from "./model";
import "./community-navigation.scss";

type AuthorizedNavigation = { navigation: string[]; active_role: string };

const descriptions: Record<CommunitySection, string> = {
  "События": "Мероприятия, хакатоны и возможности по вашему направлению.",
  "Сообщения": "Ваши диалоги и рабочие группы — без потери контекста.",
};

/** Navigation is strictly filtered by /me, not by a hard-coded route index. */
export function CommunityNavigation({ activeSection, compact = false }: { activeSection: CommunitySection; compact?: boolean }) {
  const actor = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<AuthorizedNavigation>("/api/v1/me"),
    retry: false,
  });
  const destinations = actor.data?.active_role === "participant"
    ? communityDestinations(actor.data.navigation)
    : [];

  return (
    <section className={`community-navigation${compact ? " community-navigation--compact" : ""}`} data-testid="community-navigation" aria-label="Сообщество">
      {!compact && <div className="community-navigation__title">
        <span>Люди и возможности</span>
        <h2>Сообщество</h2>
        <p>{descriptions[activeSection]}</p>
      </div>}
      {destinations.length > 0 && (
        <nav aria-label="Подразделы сообщества" className="community-navigation__links">
          {destinations.map((destination) => (
            <Link
              key={destination.label}
              to={destination.href}
              className={destination.label === activeSection ? "is-selected" : ""}
              aria-current={destination.label === activeSection ? "page" : undefined}
            >
              {destination.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
