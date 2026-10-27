import { test, expect } from "@playwright/test";

type Course = {course_key:string;finished:boolean;certificate_id:string|null;completed_units:number;total_units:number};
type Stage = {key:string;target_kind:string;target_key:string;completed:boolean};
type Role = {track_key:string;state:string;attempt_number:number|null;completed_milestones:number};
type Overview = {roles:Role[];next_outcome:{trajectory_key:string}|null;concepts:{career_grade:{current_grade:string|null}}};
type Roadmap = {track_key:string;milestones:Stage[]};
type ImpulseLevel = {track_key:string;level:number;cycle_number:number;curriculum_state:string};
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
 const verifiedKeys=new Set(roadmap.milestones.filter(m=>m.completed).map(m=>m.key));
 const studiedKeys=new Set(roadmap.milestones.filter(m=>m.target_kind==="course" &&
  learning.courses.some(c=>c.course_key===m.target_key&&c.finished&&c.certificate_id!==null)).map(m=>m.key));
 // Learning closes navigation steps, but does NOT independently verify a professional milestone.
 const expectedLearningCompleted=new Set([...verifiedKeys,...studiedKeys]).size;
 const studiedSteps=page.locator(".trajectory-v2-stage[data-study-state='studied']");
 const completedLearningSteps=page.locator(".trajectory-v2-stage[data-stage-state='completed']");
 // Read-only production audit: wait for React Query's asynchronous evidence projection.
 await expect(studiedSteps,"Certified courses must appear in the learning path").toHaveCount(expectedStudied,{timeout:20000});
 await expect(completedLearningSteps,"Learning path must combine independently verified and certified steps").toHaveCount(expectedLearningCompleted,{timeout:12000});
 const actualStudied=await studiedSteps.count();
 const actualAccepted=verifiedKeys.size;
 const studySummary=page.getByTestId("trajectory-study-evidence");
 if(expectedStudied>0){
  await expect(studySummary).toContainText(`${String(expectedLearningCompleted)} из ${String(roadmap.milestones.length)} учебных шагов выполнено`);
  await expect(studySummary).toContainText(`${String(focus.completed_milestones)} этапов подтверждено отдельно`);
 }
 // Impulse is a study level, not an independently awarded professional grade.
 // Check the actual authoritative learning-level endpoint and the current view.
 const level=await api<ImpulseLevel>("/api/v1/me/bootcamp/impulse-level?track="+encodeURIComponent(track));
 expect(level.track_key,"Server Impulse level belongs to selected role").toBe(track);
 const shownLevel=page.getByTestId("trajectory-impulse-level");
 await expect(shownLevel,"Displayed Impulse level must be server-issued").toHaveText("L"+String(level.level));
 await expect(page.locator(".trajectory-v2-grade-ring small"),"Displayed cycle must match server").toHaveText("Цикл "+String(level.cycle_number));
 if(expectedStudied>0)await expect(page.getByTestId("trajectory-study-evidence")).toContainText(`${String(expectedStudied)} из`);
 expect(browserErrors,"No uncaught JavaScript exceptions").toEqual([]);
 await page.screenshot({path:"test-results/production-trajectory-desktop.png",fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:390,height:844});
 await expect(detail).toBeVisible();
 await page.screenshot({path:"test-results/production-trajectory-mobile.png",fullPage:true,animations:"disabled"});
 const horizontalOverflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
 console.log("PRODUCTION_TRAJECTORY_AUDIT "+JSON.stringify({
  selectedTrack:track,courseRecords:learning.courses.length,studiedSteps:actualStudied,
  acceptedSteps:actualAccepted,renderedImpulseLevel:"L"+String(level.level),impulseCycle:level.cycle_number,
  mobileHorizontalOverflowPx:horizontalOverflow,uncaughtErrors:browserErrors.length,
 }));
});
