import { describe, expect, it } from "vitest";

import type { RoleCardView } from "../client";
import { sourceCatalogueRoles } from "./source-catalog";

const python: RoleCardView = {
  track_key: "python", title: "Python-разработчик",
  state: "active", attempt_number: 2, completed_milestones: 1, total_milestones: 3,
};
const product: RoleCardView = {
  track_key: "product", title: "Продуктовый аналитик",
  state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7,
};

describe("reference role catalogue", () => {
  it("preserves server-owned progress and arranges all seven approved directions", () => {
    const result = sourceCatalogueRoles([python, product]);
    expect(result).toHaveLength(7);
    expect(result.map(role => role.title)).toEqual([
      "Продуктовый аналитик", "ML-инженер", "Python-разработчик",
      "Аналитик данных", "Backend-разработчик", "UX/UI-дизайнер", "Менеджер проекта",
    ]);
    expect(result.find(role => role.track_key === "python")).toEqual(python);
    expect(result.find(role => role.track_key === "product")).toEqual(product);
    for (const role of result.filter(item => item.track_key.startsWith("catalog-"))) {
      expect(role.state).toBe("unselected");
      expect(role.attempt_number).toBeNull();
      expect(role.completed_milestones).toBe(0);
      expect(role.total_milestones).toBe(0);
    }
  });

  it("does not duplicate published catalog roles or erase extra server directions", () => {
    const backend: RoleCardView = { ...python, track_key: "backend-real", title: "Backend-разработчик", state: "paused" };
    const extra: RoleCardView = { ...python, track_key: "devops", title: "DevOps-инженер" };
    const result = sourceCatalogueRoles([backend, extra, python, product]);
    expect(result).toHaveLength(8);
    expect(result.filter(role => role.title === "Backend-разработчик")).toHaveLength(1);
    expect(result.find(role => role.track_key === "backend-real")).toEqual(backend);
    expect(result.find(role => role.track_key === "devops")).toEqual(extra);
  });
});
