/** Live projection of Bootcamp study evidence for the selected role.
 * Completing an Impulse lesson program clears its *study* requirement, not an
 * independent provider verification or an official career-grade policy edge.
 */
export type RequirementCourse = {
  key: string;
  must_take: object | null;
  completion_state: string;
};
export type StudyRecord = { course_key: string; finished: boolean; certificate_id: string | null };

export function satisfiesStudyRequirement(
  card: RequirementCourse,
  records: readonly StudyRecord[],
): boolean {
  if (card.completion_state === "verified") return true;
  // Only Impulse's demo course keys can be satisfied by Impulse's own
  // server-issued study certificate; external LMS courses remain independent.
  if (!/^demo-course-(?:[1-9]|1[0-2]|1[3-6]-[a-z][a-z0-9-]*)$/.test(card.key)) return false;
  return records.some(record =>
    record.course_key === card.key && record.finished && record.certificate_id !== null
  );
}

export function projectRoleStudy<T extends RequirementCourse>(
  roleCourses: readonly T[],
  records: readonly StudyRecord[],
) {
  const required = roleCourses.filter(card => card.must_take !== null);
  const pending = required.filter(card => !satisfiesStudyRequirement(card, records));
  const studied = roleCourses.filter(card => satisfiesStudyRequirement(card, records));
  return {
    required,
    pending,
    studied,
    completedRequired: required.length - pending.length,
    // A verified completion and an Impulse course certificate are not both
    // counted twice even when they refer to the same course.
    totalRoleCourses: roleCourses.length,
  };
}
