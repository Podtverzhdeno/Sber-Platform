import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PropsWithChildren } from "react";

import { roleLevelQueryKey, type ImpulseRoleLevel } from "../impulse-role-level";
import { learningSummaryQueryKey, type LearningSummary } from "../learning-progress";
import { overviewFixture } from "../participant-home-v2/fixture";
import { usePixelLiveDashboard } from "./usePixelLiveDashboard";

const level: ImpulseRoleLevel = {
  track_key:"python",level:0,cycle_number:1,
  curriculum_state:"published",completed_courses:1,required_courses:2,
  credited_practices:0,approved_practices:0,required_practices:1,
  advance_ready:false,history:[],policy_version:1,max_level:3,
};

const summary: LearningSummary = {
  started_courses:1,finished_courses:0,completed_lessons:3,
  approved_practices:0,credited_practices:0,
  courses:[{
    course_key:"python-base",title:"Python: основы",
    completed_units:3,total_units:6,finished:false,finished_at:null,
    certificate_id:null,updated_at:"2026-11-14T10:00:00Z",
    practice_status:null,practical_certificate_id:null,
  }],
};

function seed() {
  const queryClient = new QueryClient({
    defaultOptions:{queries:{staleTime:Infinity,gcTime:0,retry:false}},
  });
  queryClient.setQueryData(roleLevelQueryKey("python"), level);
  queryClient.setQueryData(["talent-passport"], {
    skills:[
      {key:"Python",practical_level:"Уверенный",confirmed_case_count:2},
      {key:"LLM",practical_level:"Начальный",confirmed_case_count:0},
    ],
  });
  queryClient.setQueryData(learningSummaryQueryKey, summary);
  const wrapper = ({children}: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {wrapper,queryClient};
}

afterEach(cleanup);

describe("live pixel dashboard source connector", () => {
  it("uses exact source level and only skills with verified cases", () => {
    const {wrapper} = seed();
    const {result} = renderHook(() => usePixelLiveDashboard(overviewFixture,true),{wrapper});
    expect(result.current.model.level).toBe(0);
    expect(result.current.model.nextLevel).toBe(1);
    expect(result.current.model.completedCourses).toBe(1);
    expect(result.current.model.requiredCourses).toBe(2);
    expect(result.current.model.confirmedSkills).toBe(1);
    expect(result.current.model.activeTaskCount).toBe(overviewFixture.active_tasks.length);
    expect(result.current.model.moduleProgress).toBeNull();
    expect(result.current.model.toolsSummary).toContain("AI Buddy");
    expect(result.current.loading).toBe(false);
    expect(result.current.partialData).toBe(false);
  });

  it("only uses the matching live course progress when the course is actionable", () => {
    const {wrapper} = seed();
    const src = {...overviewFixture,active_tasks:[]};
    const {result} = renderHook(() => usePixelLiveDashboard(src,false),{wrapper});
    expect(result.current.model.nextTitle).toBe("Python: основы");
    expect(result.current.model.moduleProgress).toEqual({complete:3,total:6});
    expect(result.current.model.toolsSummary).not.toContain("AI Buddy");
    expect(result.current.model.activeTaskCount).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("does not invent course progress if the current course is absent from the fetched summary", () => {
    const {wrapper,queryClient} = seed();
    queryClient.setQueryData(learningSummaryQueryKey,{...summary,courses:[]});
    const {result} = renderHook(() => usePixelLiveDashboard({...overviewFixture,active_tasks:[]}),{wrapper});
    expect(result.current.model.moduleProgress).toBeNull();
  });
});
