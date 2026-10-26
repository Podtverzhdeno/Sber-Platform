import { beforeEach, describe, expect, it } from "vitest";
import { markStageOpened, projectLearningStages, stageWasOpened, visitScope } from "./stage-flow";
import type { RoadmapView } from "./client";
import type { LearningCourse } from "../learning-progress";

const stages: RoadmapView = {
  track_key:"python", policy_version:1, replacement_reason:null,
  milestones:[
    {key:"course",position:1,title:"Security",purpose:"Learn",skill:"security",target_kind:"course",target_key:"demo-course-10",completed:false,deliverable:null,lab:null,estimated_hours:null},
    {key:"task",position:2,title:"Practice",purpose:"Apply",skill:"security",target_kind:"task",target_key:"demo-task-5",completed:false,deliverable:null,lab:null,estimated_hours:null},
  ],
  next_step:{key:"course",position:1,title:"Security",purpose:"Learn",skill:"security",target_kind:"course",target_key:"demo-course-10",completed:false,deliverable:null,lab:null,estimated_hours:null},
};
const first = stages.milestones[0];
const second = stages.milestones[1];
if (!first || !second) throw new Error("Roadmap fixture is missing published stages");
const study: LearningCourse = {
  course_key:"demo-course-10",title:"Security",completed_units:8,total_units:8,
  finished:true,finished_at:null,certificate_id:"study-cert",
  updated_at:"2026-10-26T00:00:00Z",practice_status:null,practical_certificate_id:null,
};
describe("course completion automatically advances the learning path",()=>{
  it("completes the certified course step and highlights the first published next step",()=>{
    const before=projectLearningStages(stages, [{...study,finished:false,certificate_id:null}], true);
    expect(before.stateOf(first)).toBe("current");
    const after=projectLearningStages(stages, [study], true);
    expect(after.stateOf(first)).toBe("completed");
    expect(after.next?.key).toBe("task");
    expect(after.stateOf(second)).toBe("current");
    expect(first.completed).toBe(false);
  });
  it("ignores partial, uncertified and unrelated courses or unselected roles",()=>{
    for(const courses of [[{...study,finished:false}], [{...study,certificate_id:null}], [{...study,course_key:"demo-course-9"}]]) {
      expect(projectLearningStages(stages,courses,true).next?.key).toBe("course");
    }
    expect(projectLearningStages(stages,[study],false).stateOf(first)).toBe("preview");
  });
  it("does not invent unpublished stages",()=>{
    expect(projectLearningStages({...stages,milestones:[first]},[study],true).next).toBeNull();
  });
});
describe("first-opening acknowledgement",()=>{
  beforeEach(()=>{window.localStorage.clear();});
  it("persists per participant, role, attempt and policy version",()=>{
    const scope=visitScope("alice","python",1,3);
    expect(stageWasOpened(scope,"task")).toBe(false);
    markStageOpened(scope,"task");
    expect(stageWasOpened(scope,"task")).toBe(true);
    expect(stageWasOpened(scope,"course")).toBe(false);
    expect(stageWasOpened(visitScope("bob","python",1,3),"task")).toBe(false);
    expect(stageWasOpened(visitScope("alice","python",2,3),"task")).toBe(false);
  });
});
