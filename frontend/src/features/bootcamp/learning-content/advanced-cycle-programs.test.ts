import { describe, expect, it } from "vitest";
import { advancedCycleProgramFor } from "./advanced-cycle-programs";
import { learningProgramFor } from "./programs";

const roles = ["ai-architect", "ai-engineer", "ai-security", "ai-data", "ai-mlops", "ai-agent", "ai-product"];

describe("Impulse L1-L3 advanced course content", () => {
  it("publishes 28 role-scoped course programs with eight substantive lessons each", () => {
    const ids = new Set<string>();
    for(const role of roles) {
      for(const courseNumber of [13,14,15,16]) {
        const key = "demo-course-" + String(courseNumber) + "-" + role;
        const program = learningProgramFor(key);
        expect(program?.courseKey).toBe(key);
        expect(program?.units).toHaveLength(8);
        expect(program?.description.length).toBeGreaterThan(50);
        expect(program?.result.length).toBeGreaterThan(45);
        const units = program?.units ?? [];
        expect(new Set(units.map(unit => unit.id)).size).toBe(8);
        for(const unit of units) {
          expect(unit.practice.length).toBeGreaterThan(38);
          expect(unit.expected.length).toBeGreaterThan(35);
          expect(unit.theory).toHaveLength(2);
          expect(unit.checklist).toHaveLength(3);
          expect(unit.minutes).toBeGreaterThanOrEqual(20);
        }
        ids.add(key);
      }
    }
    expect(ids.size).toBe(28);
  });
  it("never aliases new course keys to a former L0 certificate or another role", () => {
    expect(advancedCycleProgramFor("demo-course-3")).toBeNull();
    expect(advancedCycleProgramFor("demo-course-13-ai-does-not-exist")).not.toBeNull();
    expect(advancedCycleProgramFor("demo-course-17-ai-security")).toBeNull();
    expect(advancedCycleProgramFor("demo-course-13-ai-security%2F../")).toBeNull();
  });
});
