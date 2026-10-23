import { describe, expect, it } from "vitest";

import type { CatalogCourse } from "./selectors";
import {
  courseListKey,
  selectCategoryChips,
  selectFilteredCourses,
  selectRepeatCourses,
} from "./selectors";
import { BOOTCAMP_URL_DEFAULTS } from "./urlState";

function course(overrides: Partial<CatalogCourse> & { key: string }): CatalogCourse {
  return {
    title: overrides.key,
    categories: ["analysis"],
    relevantForUser: true,
    available: true,
    prerequisitesMet: true,
    stale: false,
    level: "starter",
    ...overrides,
  };
}

const catalog: CatalogCourse[] = [
  course({ key: "python-base", categories: ["development"], title: "Python Base" }),
  course({ key: "data-viz", categories: ["analysis"], title: "Визуализация данных" }),
  course({
    key: "ml-served",
    categories: ["analysis", "ml"],
    title: "ML в продакшене",
    stale: true,
  }),
  course({
    key: "legacy-tool",
    categories: ["development"],
    title: "Отладка инструментов",
    available: false,
    prerequisitesMet: false,
  }),
  course({ key: "sql-sink", categories: ["analysis"], title: "SQL погружение", level: "advanced" }),
];

describe("bootcamp v2 pure selectors", () => {
  it("builds ordered unique category chips with counts from the snapshot only", () => {
    expect(selectCategoryChips(catalog)).toEqual([
      { category: "development", count: 2 },
      { category: "analysis", count: 3 },
      { category: "ml", count: 1 },
    ]);
  });

  it("repeat chip mixes exactly relevance, availability, prerequisites and freshness", () => {
    expect(selectRepeatCourses(catalog).map((course) => course.key)).toEqual([
      "python-base",
      "data-viz",
      "sql-sink",
    ]);
  });

  it("filters stably by relevance, category, track, level and query without re-sorting", () => {
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, relevance: "user" }).map(
        (course) => course.key,
      ),
    ).toEqual(["python-base", "data-viz", "sql-sink"]);
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, category: "ml" }).map(
        (course) => course.key,
      ),
    ).toEqual(["ml-served"]);
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, level: "advanced" }).map(
        (course) => course.key,
      ),
    ).toEqual(["sql-sink"]);
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, q: "визуализация" }).map(
        (course) => course.key,
      ),
    ).toEqual(["data-viz"]);
    const ordered = selectFilteredCourses(catalog, BOOTCAMP_URL_DEFAULTS);
    expect(ordered).toEqual(catalog);
    expect(ordered.map((course, index) => courseListKey(course, index))).toEqual([
      "python-base_0",
      "data-viz_1",
      "ml-served_2",
      "legacy-tool_3",
      "sql-sink_4",
    ]);
  });

  it("keeps unknown relevance values honest by applying no relevance constraint", () => {
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, relevance: "mystery" }).map(
        (course) => course.key,
      ),
    ).toEqual(["python-base", "data-viz", "ml-served", "legacy-tool", "sql-sink"]);
    expect(
      selectFilteredCourses(catalog, { ...BOOTCAMP_URL_DEFAULTS, track: "specific-track" }).map(
        (course) => course.key,
      ),
    ).toEqual(["python-base", "data-viz", "ml-served", "legacy-tool", "sql-sink"]);
  });
});
