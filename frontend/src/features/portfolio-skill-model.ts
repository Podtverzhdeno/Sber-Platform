/** Presentation helpers for server-confirmed practical skills.
 * Verified evidence count is not a competency level.
 */
export type VerifiedPassportSkill = {
  key: string;
  practical_level: string;
  confirmed_case_count: number;
  last_confirmed_at?: string | null;
};

export function numericPassportLevel(value: string): number | null {
  const explicit = /^(?:(?:L|level|уровень)\s*[:№-]?\s*)?([1-5])(?:\s*\/\s*5)?$/i.exec(value.trim());
  return explicit ? Number(explicit[1]) : null;
}

export function confirmedPassportSkills(skills: readonly VerifiedPassportSkill[]): VerifiedPassportSkill[] {
  return skills.filter(skill => Number.isFinite(skill.confirmed_case_count) && skill.confirmed_case_count > 0);
}

export function passportEvidenceMax(skills: readonly VerifiedPassportSkill[]): number {
  return Math.max(1, ...confirmedPassportSkills(skills).map(skill => skill.confirmed_case_count));
}

export function countVerifiedCases(skills: readonly VerifiedPassportSkill[]): number {
  return confirmedPassportSkills(skills).reduce((total, skill) => total + skill.confirmed_case_count, 0);
}
