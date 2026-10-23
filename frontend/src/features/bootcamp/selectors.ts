/**
 * Bootcamp v2 pure selectors (participant-bootcamp-v2 BC2-202).
 *
 * All functions are pure: they only consume the typed course projection list
 * and URL state, never fetch or mutate. Ordering stays faithful to the
 * server-supplied sequence; a selector may only filter, count or flag.
 */
import type { BootcampUrlState } from "./urlState";

/** Course projection consumed by selectors; BC2-104-106 own the server shape. */
export type CatalogCourse = {
  key: string;
  title: string;
  categories: readonly string[];
  /** Course maps to the participant's active trajectory tracks. */
  relevantForUser: boolean;
  /** Enrollment is open per server visibility rules (quota, schedule). */
  available: boolean;
  /** All declared prerequisites are satisfied for the current user. */
  prerequisitesMet: boolean;
  /** Server marked the projection stale (policy or content changed). */
  stale: boolean;
  level: string;
};

export type CategoryChip = { category: string; count: number };

/** Ordered unique category chips with counts derived only from the given list. */
export function selectCategoryChips(courses: readonly CatalogCourse[]): CategoryChip[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    for (const category of course.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

function matchesQuery(course: CatalogCourse, query: string | null): boolean {
  if (query === null) return true;
  const lowered = query.toLowerCase();
  return (
    course.title.toLowerCase().includes(lowered) ||
    course.categories.some((category) => category.toLowerCase().includes(lowered))
  );
}

/** Relevance chip source: explicit relevance = four honest factors, no ranking. */
export function selectRepeatCourses(courses: readonly CatalogCourse[]): CatalogCourse[] {
  return courses.filter(
    (course) =>
      course.relevantForUser && course.available && course.prerequisitesMet && !course.stale,
  );
}

/** Stable-order filter: original projection sequence, no re-sorting. */
export function selectFilteredCourses(
  courses: readonly CatalogCourse[],
  state: BootcampUrlState,
): CatalogCourse[] {
  const explicitRelevance = state.relevance === "user";
  const explicitCategory = state.category !== null && state.category !== "all";
  const repeatKeys = new Set(selectRepeatCourses(courses).map((course) => course.key));
  return courses.filter((course) => {
    if (explicitRelevance && !repeatKeys.has(course.key)) return false;
    if (explicitCategory && !course.categories.includes(state.category ?? "")) return false;
    if (state.track !== "all") {
      if (!course.relevantForUser) return false;
    }
    if (state.level !== null && course.level !== state.level) return false;
    return matchesQuery(course, state.q);
  });
}

/** Shared card/list key contract: distinct course key keeps reconciliation stable. */
export function courseListKey(course: CatalogCourse, index: number): string {
  return `${course.key}_${String(index)}`;
}
