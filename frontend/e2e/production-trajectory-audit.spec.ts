import { test, expect } from "@playwright/test";

type Course = {course_key:string;finished:boolean;certificate_id:string|null;completed_units:number;total_units:number};
type Stage = {key:string;target_kind:string;target_key:string;completed:boolean};
type Role = {track_key:string;state:string;attempt_number:number|null;completed_milestones:number};
type Overview = {roles:Role[];next_outcome:{trajectory_key:string}|null;concepts:{career_grade:{current_grade:string|null}}};
type Roadmap = {track_key:string;milestones:Stage[]};
type GradeSummary = {selected_track_key:string;role_summary:{grade_state:string;current_grade_title:string|null}};
type Me = {navigation:string[]};

test("production demo session: saved learning, selected trajectory, verified stages and grade stay consistent",async({page})=>{
 test.setTimeout(100_000);
 const browserErrors:string[]=[];
 page.on("pageerror",err=>browserErrors.push(err.message));
 const url="https://sber-platform-production.up.railway.app";
 await page.setViewportSize({width:1440,height:900});
 const initial=await page.goto(url,{waitUntil:"domcontentloaded"});
 expect(initial?.ok(),"Production HTML request").toBe(true);
 const persona=page.locator('[data-persona="participant-alex"]');
 await expect(persona,"Production demo persona login accessible").toBeVisible({timeout:18000});
 await persona.click();
 // Demo login is asynchronous; 401 immediately after the click is a race,
 // not evidence that production authentication failed.
 await expect.poll(async()=>page.evaluate(async()=>{
   const response=await fetch("/api/v1/me",{credentials:"same-origin"});
   return response.status;
 }),{timeout:20000,intervals:[250,500,1000]}).toBe(200);
 const api=async<T>(path:string):Promise<T>=>{
  const res=await page.evaluate(async path=>{
   const response=await fetch(path,{credentials:"same-origin"});
   return {ok:response.ok,status:response.status,body:await response.text()};
  },path);
  expect(res.ok,`GET ${path} returned ${String(res.status)}`).toBe(true);
  return JSON.parse(res.body) as T;
 };
 const me=await api<Me>("/api/v1/me");
 const overview=await api<Overview>("/api/v1/participant/me/development-overview");
 const roles=overview.roles.filter(role=>role.attempt_number!==null);
 expect(roles.length,"At least one selected or enrolled role").toBeGreaterThan(0);
 const focus=roles.find(r=>r.track_key===overview.next_outcome?.trajectory_key)??roles[0];
 const track=focus.track_key;
 const learning=await api<{courses:Course[]}>("/api/v1/me/bootcamp/impulse-study/summary");
 const catalog=await api<Roadmap[]>("/api/v1/me/roadmap-catalog");
 const roadmap=catalog.find(item=>item.track_key===track);
 if(!roadmap)throw new Error(`Published roadmap for enrolled role ${track} not found`);
 const trajectoryIndex=me.navigation.indexOf("Моя траектория");
 expect(trajectoryIndex,"Trajectory navigation present").toBeGreaterThanOrEqual(0);
 await page.goto(`${url}/workspace/${String(trajectoryIndex)}?role=${encodeURIComponent(track)}`);
 const detail=page.getByTestId("trajectory-role-detail");
 await expect(detail).toHaveAttribute("data-role-key",track,{timeout:15000});
 const expectedStudied=roadmap.milestones.filter(m=>m.target_kind==="course"&&
  learning.courses.some(c=>c.course_key===m.target_key&&c.finished&&c.certificate_id!==null)).length;
 const expectedAccepted=roadmap.milestones.filter(m=>m.completed).length;
 const studiedSteps=page.locator(".trajectory-v2-stage[data-study-state='studied']");
 const acceptedSteps=page.locator(".trajectory-v2-stage[data-stage-state='completed']");
 // The trajectory fetches study evidence separately from the role overview;
 // never assert against the first render before React Query settles.
 await expect(studiedSteps,"Course certificates must eventually appear in their trajectory").toHaveCount(expectedStudied,{timeout:20000});
 await expect(acceptedSteps,"Accepted steps mirror server roadmap").toHaveCount(expectedAccepted,{timeout:12000});
 const actualStudied=await studiedSteps.count();
 const actualAccepted=await acceptedSteps.count();
 const stageTitle=page.locator(".trajectory-v2-stage-block header small").first();
 await expect(stageTitle).toContainText(`${String(expectedAccepted)} этапов подтверждено`);
 const gradeResponse=await page.evaluate(async track=>{
  const response=await fetch("/api/v1/me/bootcamp/overview?track="+encodeURIComponent(track),{credentials:"same-origin"});
  return {ok:response.ok,status:response.status,body:response.ok?(await response.json() as unknown):null};
 },track);
 const shownGrade=(await page.getByTestId("trajectory-official-grade").innerText()).trim();
 const grade=gradeResponse.ok?(gradeResponse.body as GradeSummary):null;
 if(grade?.selected_track_key===track&&grade.role_summary.grade_state==="known"&&grade.role_summary.current_grade_title){
  expect(shownGrade,"Displayed grade must equal backend issued grade").toBe(grade.role_summary.current_grade_title);
 }
 if(expectedStudied>0)await expect(page.getByTestId("trajectory-study-evidence")).toContainText(`${String(expectedStudied)} из`);
 expect(browserErrors,"No uncaught JavaScript exceptions").toEqual([]);
 await page.screenshot({path:"test-results/production-trajectory-desktop.png",fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:390,height:844});
 await expect(detail).toBeVisible();
 await page.screenshot({path:"test-results/production-trajectory-mobile.png",fullPage:true,animations:"disabled"});
 const horizontalOverflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
 console.log("PRODUCTION_TRAJECTORY_AUDIT "+JSON.stringify({
  selectedTrack:track,courseRecords:learning.courses.length,studiedSteps:actualStudied,
  acceptedSteps:actualAccepted,renderedGrade:shownGrade,officialGradeState:grade?.role_summary.grade_state??"unavailable",
  mobileHorizontalOverflowPx:horizontalOverflow,uncaughtErrors:browserErrors.length,
 }));
});
