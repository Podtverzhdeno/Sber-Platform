/**
 * Bootcamp v2 action selector (participant-bootcamp-v2 BC2-203).
 *
 * Pure mapping from a course access state to the honest action set. States
 * that must not show a call to action (locked, reported for review, verified,
 * revoked/rejected handling) either omit the action or explain why it is
 * absent — never a misleading button.
 */

export type CourseLearningState =
  | "not_started"
  | "in_progress"
  | "completed"
  | "reported"
  | "verified"
  | "rejected"
  | "revoked";

export type CourseActionKind = "start" | "continue" | "complete" | "retry" | "recommend";

export type CourseAction = {
  kind: CourseActionKind;
  label: string;
};

export type CourseAccessState = {
  /** Server enrollment access; false hides every learning CTA. */
  accessible: boolean;
  /** Enrollment is reachable after prerequisites; the course page explains what is missing. */
  locked: boolean;
  learning: CourseLearningState;
  recommendedForUser: boolean;
};

const ACTION_LABELS: Record<CourseActionKind, string> = {
  start: "Начать курс",
  continue: "Продолжить обучение",
  complete: "Завершить",
  retry: "Повторить выполнение",
  recommend: "Рекомендовать роль",
};

function honestAction(kind: CourseActionKind): CourseAction[] {
  return [{ kind, label: ACTION_LABELS[kind] }];
}

export function selectCourseActions(state: CourseAccessState): CourseAction[] {
  // Locked or inaccessible courses get no learning CTA; the course page itself explains missing prerequisites.
  if (!state.accessible || state.locked) {
    return [];
  }
  switch (state.learning) {
    case "not_started":
      return honestAction("start");
    case "in_progress":
      return honestAction("continue");
    case "completed":
      return honestAction("complete");
    case "reported":
      return []; // review pending: no CTA
    case "verified":
      return []; // already confirmed: no accidental restart
    case "rejected":
      return honestAction("retry");
    case "revoked":
      return []; // access revoked: server must re-admit first
    default:
      return [];
  }
}

/** Recommendation affordance is independent of learning progress and stays visible. */
export function selectRecommendationAction(state: CourseAccessState): CourseAction | null {
  return state.recommendedForUser ? { kind: "recommend", label: ACTION_LABELS.recommend } : null;
}
