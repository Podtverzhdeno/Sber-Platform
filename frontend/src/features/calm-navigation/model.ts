/** Presentation-only navigation. Backend actor.navigation remains the authority. */
export type CalmRole = "participant" | "customer" | "mentor" | "manager" | "hr" | "operator";

export interface CalmDestination {
  readonly index: number;
  readonly label: string;
  readonly href: string;
}

export interface CalmGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly CalmDestination[];
}

export interface CalmNavigation {
  readonly home: CalmDestination | null;
  readonly groups: readonly CalmGroup[];
}

/** The final group absorbs new server-allowed labels without losing access or adding routes. */
interface GroupDefinition {
  readonly id: string;
  readonly title: string;
  readonly labels: readonly string[];
}

const UTILITY_LABELS = ["Настройки", "AI-Buddy", "AI Buddy", "AI-помощник"] as const;

const GROUPS: Record<CalmRole, readonly GroupDefinition[]> = {
  participant: [
    { id: "learning", title: "Развитие", labels: ["Мой путь", "Моя траектория", "Bootcamp"] },
    { id: "work", title: "Практика", labels: ["Задачи", "Мои проекты"] },
    { id: "results", title: "Результаты", labels: ["Портфолио", "Аналитика", "Достижения", "Рейтинг"] },
    { id: "community", title: "Сообщество", labels: ["События", "Сообщения"] },
    { id: "more", title: "Дополнительно", labels: UTILITY_LABELS },
  ],
  customer: [
    { id: "tasks", title: "Задачи", labels: ["Мои задачи", "Задачи", "Создать задачу", "Заявки", "Приёмка"] },
    { id: "people", title: "Люди", labels: ["Кандидаты", "База участников", "Участники"] },
    { id: "work", title: "Работа", labels: ["Назначения", "Результаты", "Аналитика"] },
    { id: "community", title: "Общение", labels: ["Сообщения"] },
    { id: "more", title: "Дополнительно", labels: UTILITY_LABELS },
  ],
  mentor: [
    { id: "review", title: "Работа", labels: ["Очередь ревью", "Проверка вкладов", "Назначения", "Мои проекты", "Участники", "План недели"] },
    { id: "results", title: "Результаты", labels: ["Аналитика", "Результаты"] },
    { id: "community", title: "Общение", labels: ["Сообщения"] },
    { id: "help", title: "Помощь", labels: ["AI-помощник", "AI-Buddy", "AI Buddy"] },
    { id: "more", title: "Дополнительно", labels: ["Настройки"] },
  ],
  manager: [
    { id: "people", title: "Команда", labels: ["Участники", "Кандидаты", "Команда", "Календарь команды", "База участников"] },
    { id: "work", title: "Работа", labels: ["Инициативы", "Мои задачи", "Задачи"] },
    { id: "results", title: "Результаты", labels: ["Результаты", "Аналитика", "Воронка"] },
    { id: "community", title: "Общение", labels: ["Сообщения"] },
    { id: "more", title: "Дополнительно", labels: UTILITY_LABELS },
  ],
  hr: [
    { id: "people", title: "Поиск", labels: ["Кандидаты", "Участники", "База участников"] },
    { id: "pipeline", title: "Подбор", labels: ["Заявки", "Воронка", "Результаты"] },
    { id: "results", title: "Аналитика", labels: ["Аналитика"] },
    { id: "community", title: "Общение", labels: ["Сообщения"] },
    { id: "more", title: "Дополнительно", labels: UTILITY_LABELS },
  ],
  operator: [
    { id: "queue", title: "Очередь", labels: ["Операционная очередь", "Назначения", "Задачи и проекты"] },
    { id: "checks", title: "Проверка", labels: ["Проверки", "Споры"] },
    { id: "results", title: "Система", labels: ["Результаты", "Аналитика", "Выплаты", "Пользователи", "События и трофеи"] },
    { id: "community", title: "Общение", labels: ["Сообщения"] },
    { id: "more", title: "Дополнительно", labels: UTILITY_LABELS },
  ],
};

/**
 * Grouping is visual only:
 * - original server order indexes are immutable route identities;
 * - unknown but permitted labels remain reachable;
 * - no client-side list can grant a route absent from actor.navigation;
 * - at most five groups plus the optional Home entry.
 */
export function buildCalmNavigation(role: CalmRole, navigation: readonly string[]): CalmNavigation {
  const destinations = navigation.map((label, index): CalmDestination => ({
    index,
    label,
    href: `/workspace/${String(index)}`,
  }));
  const home = destinations.find((item) => item.label === "Главная") ?? null;
  const remaining = destinations.filter((item) => item !== home);
  const claimed = new Set<number>();
  const definitions = GROUPS[role];
  const groups = definitions.map((definition) => {
    const labels = new Set(definition.labels);
    const items = remaining.filter((item) => labels.has(item.label) && !claimed.has(item.index));
    items.forEach((item) => claimed.add(item.index));
    return { id: definition.id, title: definition.title, items };
  });

  const fallback = remaining.filter((item) => !claimed.has(item.index));
  if (fallback.length) {
    const last = groups.at(-1);
    if (last) {
      groups[groups.length - 1] = {
        id: last.id,
        title: "Другие разделы",
        items: [...last.items, ...fallback].sort((a, b) => a.index - b.index),
      };
    }
  }
  return {
    home,
    groups: groups.filter((group) => group.items.length > 0),
  };
}

export function activeCalmGroup(model: CalmNavigation, activeIndex: number): string | null {
  return model.groups.find((group) => group.items.some((item) => item.index === activeIndex))?.id ?? null;
}
