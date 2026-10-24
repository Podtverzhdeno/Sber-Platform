import { engineeringPrograms } from "./programs-engineering";
import { dataPrograms } from "./programs-data";
import { practicePrograms } from "./programs-practice";
import { engineeringExtensions } from "./advanced-engineering";
import { dataExtensions } from "./advanced-data";
import { practiceExtensions } from "./advanced-practice";
import type { LearningProgram, LearningUnit } from "./types";

const extensions: Record<string, LearningUnit[]> = {
  ...engineeringExtensions,
  ...dataExtensions,
  ...practiceExtensions,
};
export const learningPrograms: readonly LearningProgram[] = [
  ...engineeringPrograms, ...dataPrograms, ...practicePrograms,
].map((p) => ({ ...p, units: [...p.units, ...(extensions[p.courseKey] ?? [])] }));
const byKey = new Map(learningPrograms.map(item => [item.courseKey, item]));

export function learningProgramFor(courseKey: string | null | undefined): LearningProgram | null {
  return courseKey ? (byKey.get(courseKey) ?? null) : null;
}
export function allLearningUnits(): readonly LearningUnit[] {
  return learningPrograms.flatMap(item => item.units);
}
export type { LearningProgram, LearningUnit } from "./types";
