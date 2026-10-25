import { AI_ROLE_CATALOG } from "../trajectory-v2/source-reference/source-catalog";

/**
 * Demo learning path associations copied from AI_ROLE_PROFILES stages where
 * target_kind === "course" (src/impulse/bootstrap/ai_role_catalog.py).
 * No courses or completion state are fabricated: each key must exist in
 * the API catalog before its card can be displayed.
 */
export const AI_ROLE_COURSE_KEYS: Readonly<Record<string, readonly string[]>> = {
  product: ["demo-course-1", "demo-course-6", "demo-course-2", "demo-course-10"],
  ml: ["demo-course-3", "demo-course-2"],
  python: ["demo-course-10", "demo-course-1", "demo-course-5", "demo-course-9"],
  data: ["demo-course-3", "demo-course-5", "demo-course-9", "demo-course-10"],
  backend: ["demo-course-1", "demo-course-4", "demo-course-8", "demo-course-10"],
  design: ["demo-course-2", "demo-course-4", "demo-course-5"],
  manager: ["demo-course-6", "demo-course-7", "demo-course-1", "demo-course-9"],
};

const titleByKey: ReadonlyMap<string, string> = new Map(
  AI_ROLE_CATALOG.map(({ key, title }) => [key, title]),
);

export type CatalogCourseLink = { key: string; track_keys: readonly string[] };

/** Display names only. Stable track keys in URLs/API are deliberately untouched. */
export function aiRoleTitle(key: string): string {
  return titleByKey.get(key) ?? key;
}

/** Always show the seven canonical role options when the API includes demo tracks. */
export function bootcampRoleKeys(courses: readonly CatalogCourseLink[]): string[] {
  const source = new Set(courses.flatMap(course => course.track_keys));
  const ordered = AI_ROLE_CATALOG.map(role => role.key).filter(key => source.has(key));
  return [...ordered, ...[...source].filter(key => !titleByKey.has(key)).sort()];
}

/** Correct only the synthetic course-to-role projection. For provider content,
 * use its real course-track links rather than inventing new relationships. */
export function isCourseInAiRole(course: CatalogCourseLink, trackKey: string): boolean {
  if (trackKey === "all") return true;
  const planned = AI_ROLE_COURSE_KEYS[trackKey];
  if (planned && /^demo-course-\d+$/.test(course.key)) return planned.includes(course.key);
  return course.track_keys.includes(trackKey);
}

export function courseRoleTitles(course: CatalogCourseLink): string[] {
  if (/^demo-course-\d+$/.test(course.key)) {
    const canonical = AI_ROLE_CATALOG.filter(role =>
      AI_ROLE_COURSE_KEYS[role.key]?.includes(course.key),
    ).map(role => role.title);
    if (canonical.length > 0) return canonical;
  }
  return course.track_keys.map(aiRoleTitle);
}

/** Return catalogue in the same learning order as the role's trajectory. */
export function orderRoleCourses<T extends CatalogCourseLink>(
  courses: readonly T[],
  trackKey: string,
): T[] {
  const sequence = AI_ROLE_COURSE_KEYS[trackKey];
  if (!sequence) return [...courses];
  return [...courses].sort((a, b) => {
    const left = sequence.indexOf(a.key);
    const right = sequence.indexOf(b.key);
    return (left < 0 ? Number.MAX_SAFE_INTEGER : left)
      - (right < 0 ? Number.MAX_SAFE_INTEGER : right);
  });
}
