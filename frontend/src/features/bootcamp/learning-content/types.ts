/** Editorial learning materials written for Impulse's demonstration catalog.
 * This is NOT the published versioned LMS curriculum, nor verified completion.
 * Keys are exact catalog keys; never infer a program by a fuzzy course title. */
export type LearningUnit = {
  id: string;
  title: string;
  purpose: string;
  theory: string[];
  example: string;
  practice: string;
  expected: string;
  checklist: string[];
  minutes: number;
};
export type LearningProgram = {
  courseKey: string;
  title: string;
  description: string;
  result: string;
  units: LearningUnit[];
};
export function unit(id: string, title: string, purpose: string, theory: string[], example: string, practice: string, expected: string, checklist: string[], minutes = 20): LearningUnit {
  return { id, title, purpose, theory, example, practice, expected, checklist, minutes };
}
export function program(courseKey: string, title: string, description: string, result: string, units: LearningUnit[]): LearningProgram {
  return { courseKey, title, description, result, units };
}
