import { engineeringPrograms } from "./programs-engineering";
import { dataPrograms } from "./programs-data";
import { practicePrograms } from "./programs-practice";
import type { LearningProgram, LearningUnit } from "./types";

export const learningPrograms: readonly LearningProgram[] = [
  ...engineeringPrograms, ...dataPrograms, ...practicePrograms,
];
const byKey = new Map(learningPrograms.map(item => [item.courseKey, item]));

export function learningProgramFor(courseKey: string | null | undefined): LearningProgram | null {
  return courseKey ? (byKey.get(courseKey) ?? null) : null;
}
export function allLearningUnits(): readonly LearningUnit[] {
  return learningPrograms.flatMap(item => item.units);
}
export type { LearningProgram, LearningUnit } from "./types";
