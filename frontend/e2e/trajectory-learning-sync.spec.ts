import { expect,test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

test("saved Bootcamp certificate appears in selected trajectory without inventing completed stages or career grade",async({page})=>{
 await page.setViewportSize({width:1512,height:900});
 await installBootcampReferenceApi(page);
 const role={track_key:"product",title:"AI Architect",state:"active",attempt_number:1,completed_milestones:0,total_milestones:2};
 const stage=(n:number)=>({
  key:"arch-stage-"+String(n),position:n,title:n===1?"OpenSpec и SDD":"Агентная разработка",
  purpose:"Проверяемое обучение",skill:"ai architecture",
  target_kind:"course",target_key:"demo-course-"+String(n),
  completed:false,activities:[],deliverable:null,lab:null,estimated_hours:8,
 });
 const stages=[stage(1),stage(2)];
 await page.route("**/api/v1/participant/me/development-overview",route=>route.fulfill({json:{
  ...overviewFixture,roles:[role],
  next_outcome:{...overviewFixture.next_outcome,trajectory_key:"product",
   trajectory_title:role.title,milestone_key:stages[0]?.key, milestone_position:1,target_key:"demo-course-1",target_title:stages[0]?.title}
 }}));
 await page.route("**/api/v1/me/roadmap-catalog",route=>route.fulfill({json:[
  {track_key:"product",policy_version:1,replacement_reason:null,milestones:stages,next_step:stages[0]}
 ]}));
 await page.route("**/api/v1/me/bootcamp/overview?track=product",route=>route.fulfill({json:{
  selected_track_key:"product",role_summary:{track_key:"product",grade_state:"not_evaluable",
   current_grade_key:null,current_grade_title:null,readiness:null},
  curriculum:{state:"not_evaluable",requirements:[]}
 }}));
 await page.goto("/");
 await page.locator('[data-persona="participant-alex"]').click();
 await page.getByRole("link",{name:"Bootcamp"}).click();
 await page.evaluate(async()=>{
  const headers={"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""};
  for(let index=0;index<8;index++){
   const response=await fetch("/api/v1/me/bootcamp/impulse-study/demo-course-1/lessons/"+String(index)+"/complete",{method:"POST",headers});
   if(!response.ok)throw new Error("Lesson completion failed");
  }
  const finish=await fetch("/api/v1/me/bootcamp/impulse-study/demo-course-1/finish",{method:"POST",headers});
  if(!finish.ok)throw new Error("Course finish failed");
 });
 await page.goto("/workspace/1?role=product");
 const detail=page.getByTestId("trajectory-role-detail");
 await expect(detail).toHaveAttribute("data-role-key","product");
 await expect(page.getByTestId("trajectory-study-evidence")).toContainText("1 из 2 учебных курсов завершено");
 await expect(page.getByTestId("trajectory-study-evidence")).toContainText("0 этапов подтверждено отдельно");
 await expect(page.locator(".trajectory-v2-stage[data-study-state='studied']")).toHaveCount(1);
 await expect(page.locator(".trajectory-v2-stage[data-stage-state='completed']")).toHaveCount(1);
 await expect(page.locator(".trajectory-v2-stage[data-stage-state='current']")).toHaveCount(1);
 // The overview keeps one compact study summary; no repeated full-size progress boxes.
 const summary=page.getByTestId("trajectory-study-evidence");
 await expect(summary.getByTestId("trajectory-study-progress").locator("progress")).toHaveAttribute("max","2");
 await expect(summary.getByTestId("trajectory-study-progress").locator("progress")).toHaveAttribute("value","1");
 await expect(page.locator(".trajectory-v2-stage-detail .trajectory-v2-stage-progress")).toHaveCount(0);
 await expect(page.locator(".trajectory-v2-stage-detail .trajectory-v2-studied-course")).toHaveCount(0);
 // The active panel advances to the next uncompleted stage automatically.
 // Inspect the finished course only after explicitly selecting its historic node.
 await page.locator(".trajectory-v2-stage[data-stage-state='completed']").click();
 await expect(page.getByTestId("trajectory-course-learning")).toContainText("учебный сертификат выдан");
 await expect(page.locator(".trajectory-v2-stage-more")).toHaveCount(0);
 await expect(page.getByTestId("trajectory-official-grade")).toHaveText("—");
 await expect(page.getByText("Не опубликовано")).toBeVisible();
 await page.screenshot({path:"test-results/trajectory-learning-sync-desktop.png",fullPage:true,animations:"disabled"});
});
