/** Level percentages only exist when supplied by an approved evaluation model. */
export function parseSkillPercent(level: string | null): number | null {
  if (level === null || !/^\d+(?:[.,]\d+)?%$/.test(level.trim())) return null;
  const value = Number(level.replace("%", "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
