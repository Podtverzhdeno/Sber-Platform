/** Independent, server-owned career grade. Never infer it from Impulse L0–L3. */
export type CareerGradeView = {
  state: string;
  current_grade: string | null;
  hint?: string | null;
};

export type DevelopmentGradeOverview = {
  concepts?: { career_grade?: CareerGradeView };
};

export function careerGradeLabel(
  grade: CareerGradeView | undefined,
  query: { pending: boolean; error: boolean },
): string {
  if (query.error) return "Карьерный грейд: данные недоступны";
  if (query.pending) return "Карьерный грейд: загружается";
  if (!grade) return "Карьерный грейд: данные недоступны";
  if (grade.state === "not_evaluable") return "Карьерный грейд: правила не опубликованы";
  const issued = grade.current_grade?.trim();
  return issued ? "Карьерный грейд: " + issued : "Карьерный грейд: не определён";
}
