import { describe, expect, it } from "vitest";

import { AI_ROLE_CATALOG } from "../trajectory-v2/source-reference/source-catalog";
import {
  aiRoleTitle, bootcampRoleKeys, courseRoleTitles, isCourseInAiRole, orderRoleCourses,
  AI_ROLE_COURSE_KEYS,
} from "./trajectory-content";

const demo = Array.from({ length: 12 }, (_, index) => ({
  key: `demo-course-${String(index + 1)}`,
  // Deliberately model outdated cyclic links in the existing seeded database.
  track_keys: [AI_ROLE_CATALOG[index % AI_ROLE_CATALOG.length]?.key ?? "product"],
}));

describe("Bootcamp matches AI trajectory without modifying verified course data", () => {
  it("shows all seven career titles in exactly the trajectory order", () => {
    expect(bootcampRoleKeys(demo)).toEqual(AI_ROLE_CATALOG.map(({ key }) => key));
    expect(bootcampRoleKeys(demo).map(aiRoleTitle)).toEqual([
      "AI Architect",
      "AI Engineer",
      "AI Security Engineer",
      "AI Data Engineer",
      "MLOps Engineer",
      "AI Agent Engineer",
      "AI Product Engineer",
    ]);
  });

  it("preserves each role's course sequence and excludes stale demo links", () => {
    for (const role of AI_ROLE_CATALOG) {
      const matching = orderRoleCourses(
        demo.filter(course => isCourseInAiRole(course, role.key)),
        role.key,
      );
      expect(matching.map(course => course.key)).toEqual(AI_ROLE_COURSE_KEYS[role.key]);
    }
    const firstCourse = demo[0];
    expect(firstCourse).toBeDefined();
    if (!firstCourse) throw new Error("Missing demo course fixture");
    expect(isCourseInAiRole(firstCourse, "product")).toBe(true);
    expect(isCourseInAiRole(firstCourse, "ml")).toBe(false);
  });

  it("shows role names rather than raw slugs on course chips", () => {
    const firstCourse = demo[0];
    if (!firstCourse) throw new Error("Missing demo course fixture");
    const architects = courseRoleTitles(firstCourse);
    expect(architects).toContain("AI Architect");
    expect(architects).toContain("AI Security Engineer");
    expect(architects).not.toContain("product");
  });

  it("keeps non-demo provider course assignments and unknown roles intact", () => {
    const independent = { key: "openspec-sdd", track_keys: ["python", "company-custom"] };
    expect(isCourseInAiRole(independent, "python")).toBe(true);
    expect(isCourseInAiRole(independent, "ml")).toBe(false);
    expect(courseRoleTitles(independent)).toEqual(["AI Security Engineer", "company-custom"]);
    expect(bootcampRoleKeys([independent])).toEqual(["python", "company-custom"]);
  });

  it("does not add missing courses or mutate input/API state", () => {
    const partial = demo.slice(0, 2);
    const original = JSON.stringify(partial);
    const visible = orderRoleCourses(partial.filter(course => isCourseInAiRole(course, "product")), "product");
    expect(visible.map(course => course.key)).toEqual(["demo-course-1", "demo-course-2"]);
    expect(JSON.stringify(partial)).toBe(original);
  });
});
