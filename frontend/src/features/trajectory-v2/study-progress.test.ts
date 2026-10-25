import { describe, expect, it } from "vitest";
import { trajectoryStudyProgress } from "./study-progress";
import type { MilestoneView } from "./client";
import type { LearningCourse } from "../learning-progress";

const milestone=(key:string,target_key:string,completed=false,kind="course"):MilestoneView=>({
  key,position:1,title:key,purpose:key,skill:"ai-security",
  target_kind:kind,target_key,completed,activities:[],deliverable:null,
  lab:null,estimated_hours:null,
});
const study=(key:string,finished:boolean,certificate:string|null,units=8):LearningCourse=>({
  course_key:key,title:key,completed_units:units,total_units:8,
  finished,certificate_id:certificate,finished_at:finished?"2026-10-26T01:00:00Z":null,
  updated_at:"2026-10-26T01:00:00Z",practice_status:null,practical_certificate_id:null,
});

describe("role-specific trajectory learning reconciliation",()=>{
  it("shows two studied security modules and 16/16 lessons without granting verified milestones",()=>{
    const milestones=[milestone("security-1","demo-course-1"),milestone("security-2","demo-course-2"),
      milestone("security-3","demo-course-3"),milestone("practical","task-42",false,"task")];
    const progress=trajectoryStudyProgress(milestones,[
      study("demo-course-1",true,"certificate-1"),study("demo-course-2",true,"certificate-2"),
    ],true);
    expect(progress.matchedCourses).toBe(2);
    expect(progress.finishedCourses).toBe(2);
    expect(progress.lessonsDone).toBe(16);
    expect(progress.lessonsTotal).toBe(16);
    expect(progress.pendingEvidence).toBe(2);
    expect([...progress.studiedKeys]).toEqual(["security-1","security-2"]);
  });
  it("does not count an unfinished or unsigned course or another role's evidence",()=>{
    const progress=trajectoryStudyProgress([milestone("target","demo-course-1")],[
      study("demo-course-1",true,null),study("demo-course-8",true,"certificate-for-another-course"),
    ],true);
    expect(progress.finishedCourses).toBe(0);
    expect(progress.pendingEvidence).toBe(0);
    expect(trajectoryStudyProgress([milestone("target","demo-course-1")],[study("demo-course-1",true,"cert")],false).finishedCourses).toBe(0);
  });
  it("does not demand stage confirmation when the trusted roadmap has already accepted it",()=>{
    const result=trajectoryStudyProgress([milestone("stage-1","demo-course-1",true)],[study("demo-course-1",true,"cert")],true);
    expect(result.finishedCourses).toBe(1);
    expect(result.pendingEvidence).toBe(0);
  });
});
