import { describe, expect, it } from "vitest";
import { buildCalmNavigation, type CalmRole } from "./model";

const authorized: Record<CalmRole, string[]> = {
  participant: ["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],
  mentor: ["Главная","Проверка вкладов","Мои проекты","Участники","Сообщения","Аналитика","AI-помощник","План недели"],
  customer: ["Главная","Мои задачи","Кандидаты","Приёмка","Аналитика","Сообщения"],
  manager: ["Главная","Инициативы","Команда","Аналитика","Результаты","Календарь команды","База участников","Настройки"],
  hr: ["Главная","Кандидаты","Воронка","Аналитика","Сообщения"],
  operator: ["Главная","Операционная очередь","Проверки","Задачи и проекты","Выплаты","Споры","Пользователи","События и трофеи","Аналитика"],
};

describe("authorized navigation parity — 49 sections", () => {
  it("keeps all original route indexes, with no missing or duplicated destination", () => {
    let checked = 0;
    for (const [role, labels] of Object.entries(authorized) as [CalmRole,string[]][]) {
      const model = buildCalmNavigation(role, labels);
      const items = [model.home, ...model.groups.flatMap((group) => group.items)].filter((item) => item !== null);
      expect(items.length, role).toBe(labels.length);
      expect(items.map((item) => item.index).sort((a,b) => a-b), role).toEqual(labels.map((_, i) => i));
      for (const item of items) {
        expect(item.href, role + " " + item.label).toBe(`/workspace/${String(item.index)}`);
        expect(item.label, role + " " + String(item.index)).toBe(labels[item.index]);
      }
      expect(model.groups.length + Number(model.home !== null)).toBeLessThanOrEqual(6);
      checked += items.length;
    }
    expect(checked).toBe(49);
  });
  it("separately preserves all nine demo customer destinations, without granting them to live customer", () => {
    const demo = ["Главная","Мои задачи","Создать задачу","Заявки","Аналитика","AI-помощник","База участников","Сообщения","Настройки"];
    expect(buildCalmNavigation("customer",demo).groups.flatMap(x=>x.items).length).toBe(8);
    expect(buildCalmNavigation("customer",authorized.customer).groups.flatMap(x=>x.items).some(x=>x.label==="Создать задачу")).toBe(false);
  });
});
