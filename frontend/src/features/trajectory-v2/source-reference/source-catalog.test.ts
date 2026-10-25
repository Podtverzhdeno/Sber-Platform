import { describe, expect, it } from "vitest";

import type { RoleCardView } from "../client";
import { AI_ROLE_CATALOG, canonicalAiRoles, sourceCatalogueRoles } from "./source-catalog";

const python: RoleCardView = {
  track_key: "python", title: "Python-разработчик",
  state: "active", attempt_number: 2, completed_milestones: 1, total_milestones: 3,
};
const product: RoleCardView = {
  track_key: "product", title: "Продуктовый аналитик",
  state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7,
};

describe("canonical AI role catalogue", () => {
  it("renders seven real AI careers and never invents server progress", () => {
    const result = sourceCatalogueRoles([python, product]);
    expect(result).toHaveLength(7);
    expect(result.map(role => role.title)).toEqual(AI_ROLE_CATALOG.map(item => item.title));
    expect(result.find(role => role.track_key === "python")).toEqual({
      ...python, title: "AI Security Engineer",
    });
    expect(result.find(role => role.track_key === "product")).toEqual({
      ...product, title: "AI Architect",
    });
    for (const role of result.filter(item => item.track_key.startsWith("catalog-"))) {
      expect(role.state).toBe("unselected");
      expect(role.attempt_number).toBeNull();
      expect(role.completed_milestones).toBe(0);
      expect(role.total_milestones).toBe(0);
    }
  });

  it("normalizes stale database titles by stable slug and keeps all server fields", () => {
    const result = canonicalAiRoles([python, product]);
    expect(result).toHaveLength(2);
    expect(result.map(role => role.title)).toEqual(["AI Architect", "AI Security Engineer"]);
    expect(result[1]?.attempt_number).toBe(2);
    expect(result[1]?.completed_milestones).toBe(1);
    expect(result[1]?.total_milestones).toBe(3);
    expect(result[1]?.track_key).toBe("python");
  });

  it("does not duplicate published AI roles or hide unknown external directions", () => {
    const ml: RoleCardView = { ...python, track_key: "ml", title: "AI Engineer", state: "paused" };
    const unknown: RoleCardView = { ...python, track_key: "devops", title: "DevOps-инженер" };
    const result = sourceCatalogueRoles([ml, unknown, python, product]);
    expect(result).toHaveLength(8);
    expect(result.filter(role => role.title === "AI Engineer")).toHaveLength(1);
    expect(result.find(role => role.track_key === "ml")).toEqual(ml);
    expect(result.find(role => role.track_key === "devops")).toEqual(unknown);
  });

  it("never replaces unknown track titles even if they resemble legacy catalog entries", () => {
    const external: RoleCardView = { ...python, track_key: "third-party-role", title: "Python-разработчик" };
    expect(canonicalAiRoles([external])[0]).toEqual(external);
  });
});
