import { describe, expect, it } from "vitest";

import { activeCalmGroup, buildCalmNavigation, type CalmRole } from "./model";

describe("buildCalmNavigation", () => {
  it("preserves original route indexes after grouping rather than renumbering links", () => {
    const model = buildCalmNavigation("participant", [
      "Главная", "Сообщения", "Задачи", "Моя траектория", "Рейтинг", "Настройки",
    ]);
    expect(model.home?.href).toBe("/workspace/0");
    expect(model.groups.find((group) => group.id === "learning")?.items).toEqual([
      { index: 3, label: "Моя траектория", href: "/workspace/3" },
    ]);
    expect(model.groups.find((group) => group.id === "work")?.items[0]?.href).toBe("/workspace/2");
    expect(activeCalmGroup(model, 4)).toBe("results");
  });

  it("never introduces hidden unauthorized destinations", () => {
    const model = buildCalmNavigation("participant", ["Главная", "Bootcamp"]);
    const all = [model.home, ...model.groups.flatMap((group) => group.items)].filter(Boolean);
    expect(all.map((item) => item?.label)).toEqual(["Главная", "Bootcamp"]);
    expect(JSON.stringify(all)).not.toContain("Создать задачу");
  });

  it("keeps unforeseen server-authorized destinations reachable as fallback", () => {
    const model = buildCalmNavigation("participant", ["Главная", "Новый разрешённый раздел", "Bootcamp"]);
    expect(model.groups.find((group) => group.title === "Другие разделы")?.items).toContainEqual({
      index: 1,
      label: "Новый разрешённый раздел",
      href: "/workspace/1",
    });
  });

  it("supports all six roles and never exceeds six top-level entries", () => {
    const roles: CalmRole[] = ["participant", "customer", "mentor", "manager", "hr", "operator"];
    for (const role of roles) {
      const model = buildCalmNavigation(role, [
        "Главная", "Сообщения", "Аналитика", "Настройки", "Очередь ревью", "Споры", "Воронка",
      ]);
      expect(model.groups.length + Number(model.home !== null)).toBeLessThanOrEqual(6);
      const indexes = [model.home, ...model.groups.flatMap((group) => group.items)]
        .filter((item) => item !== null).map((item) => item.index).sort((a, b) => a - b);
      expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it("does not invent Home when not allowed", () => {
    const model = buildCalmNavigation("hr", ["Кандидаты", "Воронка"]);
    expect(model.home).toBeNull();
    expect(model.groups.flatMap((group) => group.items).map((item) => item.href))
      .toEqual(["/workspace/0", "/workspace/1"]);
  });

  it("keeps repeated authorized labels as separate indexed destinations", () => {
    const model = buildCalmNavigation("participant", ["Главная", "События", "События"]);
    const events = model.groups.flatMap((group) => group.items).filter((item) => item.label === "События");
    expect(events.map((item) => item.index)).toEqual([1, 2]);
  });
});
