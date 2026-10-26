import { describe, expect, it } from "vitest";
import { projectRoleStudy, satisfiesStudyRequirement } from "./role-study-progression";

const card=(key:string,state="not_started",required=true)=>({
  key,completion_state:state,must_take:required?{skill:"role"}:null
});
const finished=(key:string,certificate_id:string|null)=>({
  course_key:key,finished:certificate_id!==null,certificate_id
});

describe("Bootcamp role-study remainder from persistent study certificates",()=>{
  it("removes the last role course on the server's finished certificate without changing other roles",()=>{
    const selected=[card("demo-course-1","verified"),card("demo-course-6","verified"),card("demo-course-2","verified"),card("demo-course-10")];
    const before=projectRoleStudy(selected,[]);
    expect(before.pending.map(x=>x.key)).toEqual(["demo-course-10"]);
    expect(before.studied).toHaveLength(3);
    const after=projectRoleStudy(selected,[finished("demo-course-10","certificate-10")]);
    expect(after.pending).toHaveLength(0);
    expect(after.studied).toHaveLength(4);
    expect(after.completedRequired).toBe(4);
    const otherRole=projectRoleStudy([card("demo-course-3")],[finished("demo-course-10","certificate-10")]);
    expect(otherRole.pending.map(x=>x.key)).toEqual(["demo-course-3"]);
  });
  it("never treats an eighth lesson or a draft completion as a finished course",()=>{
    const required=card("demo-course-10");
    expect(satisfiesStudyRequirement(required,[{course_key:required.key,finished:false,certificate_id:null}])).toBe(false);
    expect(satisfiesStudyRequirement(required,[{course_key:required.key,finished:true,certificate_id:null}])).toBe(false);
    expect(satisfiesStudyRequirement(required,[finished("demo-course-11","some-id")])).toBe(false);
  });
  it("does not apply Impulse study certificates to external provider requirements",()=>{
    const provider=card("openspec-sdd","reported");
    expect(satisfiesStudyRequirement(provider,[finished("openspec-sdd","any")])).toBe(false);
    expect(satisfiesStudyRequirement(card("openspec-sdd","verified"),[])).toBe(true);
  });
  it("counts only the fresh, role-specific course certificates after L1 promotion",()=>{
    const level1 = [
      card("demo-course-13-ai-security"),
      card("demo-course-14-ai-security"),
    ];
    const oldAndWrongRole = [
      finished("demo-course-1","l0-certificate"),
      finished("demo-course-2","l0-certificate-2"),
      finished("demo-course-13-ai-data","another-role-certificate"),
    ];
    expect(projectRoleStudy(level1,oldAndWrongRole).completedRequired).toBe(0);
    expect(projectRoleStudy(level1,[...oldAndWrongRole,finished("demo-course-13-ai-security","new-l1-cert")]).completedRequired).toBe(1);
    const full=projectRoleStudy(level1,[
      ...oldAndWrongRole,
      finished("demo-course-13-ai-security","new-l1-cert"),
      finished("demo-course-14-ai-security","new-l1-cert-2"),
    ]);
    expect(full.pending).toHaveLength(0);
    expect(full.studied).toHaveLength(2);
  });
  it("never counts a course twice when both completion sources agree",()=>{
    const x=projectRoleStudy([card("demo-course-10","verified")],[finished("demo-course-10","study-id")]);
    expect(x.studied).toHaveLength(1);
    expect(x.pending).toHaveLength(0);
  });
});
