import type { LearningCourse } from "../learning-progress";
import type { MilestoneView } from "./client";

export type TrajectoryStudyProgress = {
  matchedCourses: number;
  finishedCourses: number;
  pendingEvidence: number;
  lessonsDone: number;
  lessonsTotal: number;
  studiedKeys: ReadonlySet<string>;
};

/** Match by exact, server-owned course key and only in the selected roadmap.
 * A finished study course is not an officially completed milestone; practice,
 * project acceptance and career-grade policies have separate verification. */
export function trajectoryStudyProgress(
  milestones: readonly MilestoneView[],
  courses: readonly LearningCourse[] | null | undefined,
  enrolled: boolean,
): TrajectoryStudyProgress {
  const scoped = enrolled ? milestones.filter(m => m.target_kind === "course") : [];
  const index = new Map((courses ?? []).map(c => [c.course_key, c]));
  const matched = scoped.map(m => ({ milestone:m, course:index.get(m.target_key) })).filter(
    (item):item is {milestone:MilestoneView;course:LearningCourse} => item.course !== undefined,
  );
  const studied = matched.filter(item => item.course.finished && item.course.certificate_id !== null);
  return {
    matchedCourses: matched.length,
    finishedCourses: studied.length,
    pendingEvidence: studied.filter(item => !item.milestone.completed).length,
    lessonsDone: matched.reduce((sum,item)=>sum+item.course.completed_units,0),
    lessonsTotal: matched.reduce((sum,item)=>sum+item.course.total_units,0),
    studiedKeys: new Set(studied.map(item => item.milestone.key)),
  };
}
