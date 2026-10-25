import { primaryManualsPartOne } from "./manuals-part-one";
import { primaryManualsPartTwo } from "./manuals-part-two";
import type { ManualLesson, ManualReference } from "./manuals-part-one";

const manuals: Readonly<Record<string, ManualReference>> = {
  ...primaryManualsPartOne,
  ...primaryManualsPartTwo,
};

const extended: Readonly<Record<string, { label: string; url: string }>> = {
  "demo-course-2": { label: "Langfuse — Tracing and Evaluation", url: "https://python.reference.langfuse.com/langfuse" },
  "demo-course-8": { label: "Pro Git — complete book", url: "https://git-scm.com/book/en/v2" },
  "demo-course-9": { label: "Playwright — Testing in the Browser", url: "https://playwright.dev/docs/intro" },
  "demo-course-10": { label: "OWASP — Prompt Injection", url: "https://genai.owasp.org/glossary/prompt-injection/" },
  "demo-course-12": { label: "NIST — AI Risk Management Playbook", url: "https://airc.nist.gov/airmf-resources/playbook/" },
};

export type ManualCompanion = ManualLesson & {
  additional?: { label: string; url: string };
};

/** Select by exact catalog ID and numeric lesson position — never guess by title. */
export function manualFor(courseKey: string, index: number): ManualCompanion | null {
  const manual = manuals[courseKey];
  if (!manual || !Number.isInteger(index) || index < 0) return null;
  const entry = manual.lessons[index];
  if (!entry) return null;
  return { ...entry, source: manual.source, url: manual.url, additional: extended[courseKey] };
}

export function allManualChapters(): ManualCompanion[] {
  return Object.entries(manuals).flatMap(([courseKey, m]) =>
    m.lessons.map((_, index) => manualFor(courseKey, index)).filter((lesson): lesson is ManualCompanion => lesson !== null)
  );
}
