import { describe, expect, it, vi } from "vitest";
import type { ImpulseRoleLevel } from "../impulse-role-level";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import { overviewFixture } from "../participant-home-v2/fixture";
import { followPixelPrimaryTarget, resolvePixelPrimaryTarget, toPixelHomeModel } from "./adapter";

const level: ImpulseRoleLevel = {
  track_key:"python",level:0,cycle_number:1,
  curriculum_state:"published",completed_courses:1,required_courses:2,
  credited_practices:0,approved_practices:0,required_practices:1,
  advance_ready:false,history:[],policy_version:1,max_level:3,
  required_course_keys:[],
};

describe("source-backed pixel integration adapter", () => {
  it("prioritizes an actually actionable assigned task over a suggested course", () => {
    const task=overviewFixture.active_tasks[0];
    if (!task) throw new Error("fixture requires active task");
    expect(resolvePixelPrimaryTarget(overviewFixture)).toEqual({kind:"task",key:task.task_id});
    const open=vi.fn(),fallback=vi.fn();
    followPixelPrimaryTarget(overviewFixture,open,fallback);
    expect(open).toHaveBeenCalledWith("task",task.task_id,undefined);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the verified next course and preserves its source trajectory when no task can advance", () => {
    const src:DevelopmentOverviewView={
      ...overviewFixture,
      active_tasks:overviewFixture.active_tasks.map(t=>({...t,next_action:"await_review"})),
    };
    expect(resolvePixelPrimaryTarget(src)).toEqual({
      kind:"course",key:"python-base",trajectoryKey:"python",
    });
    const open=vi.fn();
    followPixelPrimaryTarget(src,open,vi.fn());
    expect(open).toHaveBeenCalledWith("course","python-base","python");
  });

  it("falls back to the trajectory for stale next steps, not fabricated progress", () => {
    const src:DevelopmentOverviewView={
      ...overviewFixture,
      active_tasks:[],
      next_outcome:overviewFixture.next_outcome
        ? {...overviewFixture.next_outcome,stale_reason:"pending_update"} : null,
    };
    expect(resolvePixelPrimaryTarget(src).kind).toBe("trajectory");
    const fallback=vi.fn();
    followPixelPrimaryTarget(src,vi.fn(),fallback);
    expect(fallback).toHaveBeenCalledWith("trajectory");
    const view=toPixelHomeModel({overview:src,roleLevel:null,confirmedSkills:null});
    expect(view.moduleProgress).toBeNull();
    expect(view.level).toBeNull();
    expect(view.confirmedSkills).toBeNull();
    expect(view.nextTitle).toBeNull();
  });

  it("does not show unauthorized AI Buddy or invent a module percentage", () => {
    const view=toPixelHomeModel({overview:overviewFixture,roleLevel:level,confirmedSkills:0});
    expect(view.toolsSummary).toBe("Траектория и скилл-паспорт");
    expect(view.moduleProgress).toBeNull();
    expect(view.completedCourses).toBe(1);
    expect(view.requiredCourses).toBe(2);
    expect(view.confirmedSkills).toBe(0);
    expect(view.nextLevel).toBe(1);
  });

  it("uses only a real learning progress from a real course", () => {
    const src:DevelopmentOverviewView={...overviewFixture,active_tasks:[]};
    const view=toPixelHomeModel({
      overview:src,roleLevel:level,confirmedSkills:2,
      courseProgress:{complete:3,total:6},buddyAvailable:true,
    });
    expect(view.moduleProgress).toEqual({complete:3,total:6});
    expect(view.toolsSummary).toContain("AI Buddy");
    expect(view.moduleTrackTitle).toBeTruthy();
  });
});
