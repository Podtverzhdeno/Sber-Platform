import { describe, expect, it } from "vitest";
import { workspaceLayout } from "./screen-layout";
import type { CalmRole } from "../features/calm-navigation/model";

const menus: Record<CalmRole, readonly string[]> = {
  participant: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"],
  mentor: ["Главная", "Проверка вкладов", "Мои проекты", "Участники", "Сообщения", "Аналитика", "AI-помощник", "План недели"],
  customer: ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика", "Сообщения"],
  manager: ["Главная", "Инициативы", "Команда", "Аналитика", "Результаты", "Календарь команды", "База участников", "Настройки"],
  hr: ["Главная", "Кандидаты", "Воронка", "Аналитика", "Сообщения"],
  operator: ["Главная", "Операционная очередь", "Проверки", "Задачи и проекты", "Выплаты", "Споры", "Пользователи", "События и трофеи", "Аналитика"],
};

describe("all role screen layouts", () => {
  it("classifies exactly the 49 real authorized sections without an unknown fallback", () => {
    let count = 0;
    for (const [role, labels] of Object.entries(menus) as [CalmRole, readonly string[]][]) {
      for (const label of labels) {
        expect(workspaceLayout(role, label), role + ": " + label).not.toBe("detail");
        count += 1;
      }
    }
    expect(count).toBe(49);
  });
  it("preserves conditional demo customer route templates but invents no route", () => {
    for (const label of ["Создать задачу", "Заявки", "AI-помощник", "База участников", "Настройки"]) {
      expect(workspaceLayout("customer", label)).not.toBe("detail");
    }
    expect(workspaceLayout("hr", "Выплаты")).toBe("detail");
  });
  it("does not interpret unknown labels or malformed input as permission", () => {
    expect(workspaceLayout("participant", null)).toBe("detail");
    expect(workspaceLayout("operator", "Администратор")).toBe("detail");
  });
});
