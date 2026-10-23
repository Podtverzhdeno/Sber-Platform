import { describe, expect, it } from "vitest";

import { BOOTCAMP_URL_DEFAULTS, parseBootcampUrl } from "./urlState";
import { courseDetailQueryKey, isOverviewKeyStable, overviewRequestUrl } from "./queries";

describe("bootcamp v2 query rules", () => {
  it("keeps the overview key stable across view, filters and course anchor toggles", () => {
    const base: ReturnType<typeof parseBootcampUrl> = { ...BOOTCAMP_URL_DEFAULTS };
    expect(isOverviewKeyStable(base, { ...base, view: "list" })).toBe(true);
    expect(isOverviewKeyStable(base, { ...base, q: "python", category: "ml" })).toBe(true);
    expect(isOverviewKeyStable(base, { ...base, course: "python-base" })).toBe(true);
    expect(isOverviewKeyStable({ ...base, course: "python-base" }, base)).toBe(true);
    expect(isOverviewKeyStable(base, { ...base, track: "frontend-track" })).toBe(false);
    expect(isOverviewKeyStable(base, { ...base, relevance: "user" })).toBe(false);
  });

  it("re-reads course details only when the server revision changes", () => {
    expect(courseDetailQueryKey("python-base", "rev-1")).toBe("course:python-base@rev-1");
    expect(courseDetailQueryKey("python-base", "rev-1")).toBe(
      courseDetailQueryKey("python-base", "rev-1"),
    );
    expect(courseDetailQueryKey("python-base", "rev-2")).not.toBe(
      courseDetailQueryKey("python-base", "rev-1"),
    );
  });

  it("builds the overview request url canonically from url state", () => {
    expect(overviewRequestUrl("/api/v1/bootcamp/catalog", BOOTCAMP_URL_DEFAULTS)).toBe(
      "/api/v1/bootcamp/catalog",
    );
    expect(
      overviewRequestUrl("/api/v1/bootcamp/catalog", {
        ...BOOTCAMP_URL_DEFAULTS,
        view: "list",
        q: "sql",
      }),
    ).toBe("/api/v1/bootcamp/catalog?view=list&q=sql");
    expect(overviewRequestUrl("/api/v1/bootcamp/catalog?", { ...BOOTCAMP_URL_DEFAULTS })).toBe(
      "/api/v1/bootcamp/catalog?",
    );
  });
});
