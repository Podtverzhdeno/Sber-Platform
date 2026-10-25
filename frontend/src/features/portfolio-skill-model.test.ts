import { describe, expect, it } from "vitest";
import { confirmedPassportSkills, countVerifiedCases, numericPassportLevel, passportEvidenceMax } from "./portfolio-skill-model";

describe("verified practical skills", () => {
  it("does not manufacture numeric grades from qualitative evidence states or unrelated digits", () => {
    expect(numericPassportLevel("подтверждён практикой")).toBeNull();
    expect(numericPassportLevel("L3")).toBe(3);
    expect(numericPassportLevel("Уровень 4")).toBe(4);
    expect(numericPassportLevel("2/5")).toBe(2);
    expect(numericPassportLevel("level 10")).toBeNull();
    expect(numericPassportLevel("unknown")).toBeNull();
  });

  it("uses only accepted cases to count and scale practical evidence", () => {
    const skills = [
      { key: "python", practical_level: "подтверждено", confirmed_case_count: 2 },
      { key: "recommender-systems", practical_level: "практика", confirmed_case_count: 1 },
      { key: "unreviewed", practical_level: "L5", confirmed_case_count: 0 },
    ];
    expect(confirmedPassportSkills(skills).map(s => s.key)).toEqual(["python", "recommender-systems"]);
    expect(countVerifiedCases(skills)).toBe(3);
    expect(passportEvidenceMax(skills)).toBe(2);
    expect(passportEvidenceMax([])).toBe(1);
  });
});
