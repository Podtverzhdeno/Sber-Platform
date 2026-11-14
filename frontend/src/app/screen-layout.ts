import type { CalmRole } from "../features/calm-navigation/model";

export type WorkspaceLayout =
  | "home" | "learning" | "catalog" | "project" | "records"
  | "analytics" | "messages" | "settings" | "review" | "calendar" | "assistant" | "detail";

/** Presentation-only grouping. Never changes URLs, source data or permissions. */
const sections: Record<CalmRole, Readonly<Record<string, WorkspaceLayout>>> = {
  participant: {
    "Главная": "home", "Моя траектория": "learning", "Мой путь": "learning",
    Bootcamp: "learning", "Задачи": "catalog", "Мои проекты": "project",
    "События": "calendar", "Рейтинг": "records", "Портфолио": "records",
    "Достижения": "records", "Аналитика": "analytics", "Сообщения": "messages",
    "AI-Buddy": "assistant", "Настройки": "settings",
  },
  mentor: {
    "Главная": "home", "Проверка вкладов": "review", "Очередь ревью": "review",
    "Мои проекты": "project", "Участники": "records", "Сообщения": "messages",
    "Аналитика": "analytics", "AI-помощник": "assistant", "План недели": "calendar",
  },
  customer: {
    "Главная": "home", "Мои задачи": "catalog", "Создать задачу": "review",
    "Кандидаты": "records", "База участников": "records",
    "Заявки": "review", "Приёмка": "review", "Аналитика": "analytics",
    "Сообщения": "messages", "AI-помощник": "assistant", "Настройки": "settings",
  },
  manager: {
    "Главная": "home", "Инициативы": "project", "Команда": "records",
    "Аналитика": "analytics", "Результаты": "records",
    "Календарь команды": "calendar", "База участников": "records", "Настройки": "settings",
  },
  hr: {
    "Главная": "home", "Кандидаты": "records", "Воронка": "analytics",
    "Аналитика": "analytics", "Сообщения": "messages",
  },
  operator: {
    "Главная": "home", "Операционная очередь": "review",
    "Проверки": "review", "Задачи и проекты": "project",
    "Выплаты": "records", "Споры": "review", "Пользователи": "records",
    "События и трофеи": "records", "Аналитика": "analytics",
  },
};

export function workspaceLayout(role: CalmRole, section: string | null): WorkspaceLayout {
  return section ? (sections[role][section] ?? "detail") : "detail";
}
