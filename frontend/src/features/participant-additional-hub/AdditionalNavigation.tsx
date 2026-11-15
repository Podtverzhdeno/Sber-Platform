import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { additionalDestinations, type AdditionalSection } from "./model";
import "./additional-navigation.scss";

type ViewerNavigation = { navigation: string[]; active_role: string };

const descriptions: Record<AdditionalSection, string> = {
  "AI-Buddy": "Персональный помощник для обучения и рабочих вопросов.",
  "Настройки": "Профиль, уведомления, согласия и доступ к вашим данным.",
};

/** A small, non-decorative local switcher for the two authorized participant tools. */
export function AdditionalNavigation({ activeSection }: { activeSection: AdditionalSection }) {
  const actorQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<ViewerNavigation>("/api/v1/me"),
    retry: false,
  });
  const destinations = actorQuery.data?.active_role === "participant"
    ? additionalDestinations(actorQuery.data.navigation)
    : [];

  return (
    <section className="additional-navigation" aria-label="Дополнительно" data-testid="additional-navigation">
      <div className="additional-navigation__intro">
        <span>Личное пространство</span>
        <h2>Дополнительно</h2>
        <p>{descriptions[activeSection]}</p>
      </div>
      {destinations.length > 0 && (
        <nav className="additional-navigation__tabs" aria-label="Подразделы дополнительного">
          {destinations.map(({ label, href }) => (
            <Link
              key={label}
              to={href}
              aria-current={label === activeSection ? "page" : undefined}
              className={label === activeSection ? "is-current" : ""}
            >
              {label === "AI-Buddy" ? "AI Buddy" : label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
