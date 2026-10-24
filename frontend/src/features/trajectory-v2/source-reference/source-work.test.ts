import { describe, expect, it } from "vitest";

import type { MilestoneView } from "../client";
import { verifiedTasksForStage, type ParticipantWorkItem } from "./source-work";

const milestone: MilestoneView = {
  key: "deliver",
  position: 3,
  title: "Настоящая задача",
  purpose: "Практика",
  skill: "architecture",
  target_kind: "task",
  target_key: "verified-task-1",
  completed: false,
  deliverable: null, lab: null, estimated_hours: null,
};

function workItem(taskKey: string, latestDecision: "accepted" | "revision_requested"): ParticipantWorkItem {
  return {
    assignment: { id: "a", task_id: "t", person_id: "p", application_id: "app", status: "active" },
    task: { id: "t", task_key: taskKey, title: "Проверенный бизнес-кейс", project_key: "business", status: "published", places: 1, nominated_mentor_id: null, support_mode: null, support_assignee_id: null },
    terms: {},
    allowed_artifacts: [],
    contributions: [{ id: "c", assignment_id: "a", version: 2, personal_summary: "Работа", artifact_keys: [], status: "submitted" }],
    decisions: [{ id: "d", contribution_id: "c", contribution_version: 2, decision: latestDecision, reason: "reviewed", deadline_at: null, owner_id: null }],
  } as unknown as ParticipantWorkItem;
}

describe("authorized participant work projection", () => {
  it("matches exact source target_key without leaking unrelated assignments", () => {
    const result = verifiedTasksForStage(milestone, [workItem("other-task", "accepted"), workItem("verified-task-1", "accepted")]);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.title).toBe("Проверенный бизнес-кейс");
    expect(result?.[0]?.status).toBe("completed");
    expect(result?.[0]?.xp).toBeNull();
  });
  it("does not mark unaccepted or unrelated versions completed", () => {
    const result = verifiedTasksForStage(milestone, [workItem("verified-task-1", "revision_requested")]);
    expect(result?.[0]?.status).toBe("current");
  });
  it("does not pretend a course milestone has work assignments", () => {
    expect(verifiedTasksForStage({ ...milestone, target_kind: "course" }, [workItem("verified-task-1", "accepted")])).toBeUndefined();
    expect(verifiedTasksForStage(milestone, undefined)).toBeUndefined();
  });
});
