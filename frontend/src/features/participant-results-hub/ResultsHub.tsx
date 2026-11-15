import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./results-hub.scss";

/**
 * Content-first, permission-safe presentation for existing participant results.
 * Does not invent achievement counters or alter portfolio, analytics, trophy or
 * rating data; the routed screen remains the source of truth for every action.
 */
export const RESULT_SECTIONS = ["Портфолио", "Аналитика", "Достижения", "Рейтинг"] as const;

type ResultsSection = (typeof RESULT_SECTIONS)[number];

const sectionSummaries: Record<ResultsSection, string> = {
  "Портфолио": "Ваши проекты, личный вклад, навыки и документы с подтверждением.",
  "Аналитика": "Измеримый прогресс, динамика и источники результатов.",
  "Достижения": "Награды, сертификаты и проверяемая история участия.",
  "Рейтинг": "Опубликованный рейтинг с понятными правилами и периодами.",
};

export function resultDestinations(navigation: readonly string[]) {
  return RESULT_SECTIONS.flatMap((label) => {
    const index = navigation.indexOf(label);
    return index < 0 ? [] : [{ label, href: "/workspace/" + String(index) }];
  });
}

export function ResultsHub({
  navigation,
  activeSection,
  children,
}: {
  navigation: readonly string[];
  activeSection: string;
  children: ReactNode;
}) {
  const destinations = resultDestinations(navigation);
  const current = RESULT_SECTIONS.find((section) => section === activeSection);
  const section = current ?? destinations[0]?.label ?? null;

  return (
    <div className="results-hub" data-testid="participant-results-hub" data-active-section={activeSection}>
      <header className="results-hub__masthead">
        <div>
          <span className="results-hub__eyebrow">Мой подтверждённый опыт</span>
          <h2>Результаты</h2>
          <p>{section !== null ? sectionSummaries[section] : "Доступные результаты вашего развития."}</p>
        </div>
      </header>

      {destinations.length > 0 && (
        <nav className="results-hub__navigation" aria-label="Подразделы результатов">
          {destinations.map(({ label, href }) => (
            <Link
              to={href}
              key={label}
              className={"results-hub__tab" + (label === activeSection ? " is-selected" : "")}
              aria-current={label === activeSection ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      <section className="results-hub__content" aria-label={activeSection}>
        {children}
      </section>
    </div>
  );
}
