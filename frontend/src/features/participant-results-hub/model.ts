export const RESULT_SECTIONS = ["Портфолио", "Аналитика", "Достижения", "Рейтинг"] as const;

type ResultsSection = (typeof RESULT_SECTIONS)[number];

export const sectionSummaries: Record<ResultsSection, string> = {
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

