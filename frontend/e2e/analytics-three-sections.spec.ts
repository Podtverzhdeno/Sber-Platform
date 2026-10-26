import { test, expect } from "@playwright/test";
const actor = {
  person_id:"00000000-0000-0000-0000-000000000001",display_name:"Алекс Речной",
  active_role:"participant",assigned_roles:["participant"],scopes:[],consent_scopes:[],
  navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],csrf_token:"csrf",
};
test.beforeEach(async ({page})=>{
 await page.route("**/api/v1/config",r=>r.fulfill({json:{honor_board_enabled:true}}));
 await page.route("**/api/v1/me",r=>r.fulfill({json:actor}));
 await page.route("**/api/v1/auth/demo-login",r=>r.fulfill({json:actor}));
 await page.route("**/api/v1/me/growth/snapshot",r=>r.fulfill({json:{
  snapshot_id:"analytics-v3",generated_at:new Date().toISOString(),actor_timezone:"Europe/Moscow",
  freshness:{known:true,latest_observed_at:new Date().toISOString()},
  events:Array.from({length:14},(_,i)=>({occurred_at:new Date(Date.now()-(i+1)*86400000).toISOString(),kind:i%4===0?"course_lesson":i%4===1?"completed_task":i%4===2?"project_update":"event_attendance",title:["Завершён урок","Выполнена задача","Обновлён проект","Участие в событии"][i%4],source_kind:"Impulse",source_ref:"sample-"+String(i)}))
 }}));
 await page.route("**/api/v1/me/agentic-coding/profile**",r=>r.fulfill({json:{
  role_key:"developer",role_title:"Разработчик",profile_scope:"impulse_learning",scale_key:"agentic_coding_1_4",framework_version:"agentic-coding-source-map-2026-10-23",
  as_of:new Date().toISOString(),certification_state:"not_connected",certification_reason:"issuer not connected",known_evidence_count:10,data_origin:"source_map",
  skills:["prompting","prompt_engineering","context_management","tools_mcp","creating_skills","agents_team"].map((key,i)=>({key,title:key,target_level:[3,4,3,2,3,2][i],current_level:[2,3,2,2,1,2][i],evidence_count:2,data_state:"verified",unresolved_methodology:false}))
 }}));
 await page.route("**/api/v1/me/analytics/journey",r=>r.fulfill({json:{stages:[{key:"verified_experience",title:"Подтверждено",count:4,status:"completed"}],successful:true,next_action:"Продолжить",generated_at:new Date().toISOString()}}));
 await page.route("**/api/v1/me/bootcamp/certificates",r=>r.fulfill({json:[{certificate_id:"COURSE-001",course_title:"Основы Agentic Coding",holder_name:"Алекс Речной",issued_at:new Date().toISOString(),verification_id:"demo-verification-001",workload_hours:24,result:"passed"}]}));
});
test("all three analytics screens, live charts, evidence and certification interactions",async({page})=>{
 await page.setViewportSize({width:1586,height:992});
 await page.goto("/workspace/9");
 const root=page.getByTestId("analytics-v3");
 await expect(root).toBeVisible();
 await expect(root).toHaveAttribute("data-tab","activity");
 await expect(page.getByRole("heading",{name:"Твоя активность"})).toBeVisible();
 await expect(root.locator(".av3-heat-column")).toHaveCount(0);
 await expect(root.locator(".ac-week")).toHaveCount(52);
 await expect(root.getByText("14",{exact:true}).first()).toBeVisible();
 await page.screenshot({path:"test-results/analytics-v3-activity-1586x992.png",fullPage:true,animations:"disabled"});
 await root.getByRole("button",{name:"Skill Passport",exact:true}).click();
 await expect(root).toHaveAttribute("data-tab","passport");
 await expect(page.getByRole("heading",{name:"Ваш Skill Passport"})).toBeVisible();
 await expect(root.locator(".ref-radar svg")).toBeVisible();
 await page.screenshot({path:"test-results/analytics-v3-passport-1586x992.png",fullPage:true,animations:"disabled"});
 await root.getByRole("button",{name:"Сертификация",exact:true}).click();
 await expect(root).toHaveAttribute("data-tab","certification");
 await expect(root.getByText("COURSE-001")).toBeVisible();
 await expect(root.getByRole("link",{name:/Открыть сертификат/})).toHaveAttribute("href",/verify/);
 await root.getByRole("button",{name:/Practitioner/}).first().click();
 await expect(page.getByRole("dialog",{name:"Practitioner"})).toBeVisible();
 await page.getByRole("button",{name:"Закрыть",exact:true}).click();
 await page.screenshot({path:"test-results/analytics-v3-certification-1586x992.png",fullPage:true,animations:"disabled"});
});
test("responsive analytics navigation, range selectors and stable button animations",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/workspace/9");
 const root=page.getByTestId("analytics-v3");
 await expect(root.getByRole("heading",{name:"Твоя активность"})).toBeVisible();
 await root.getByRole("combobox",{name:"Период аналитики"}).selectOption("12");
 await expect(root.locator(".ac-week")).toHaveCount(12);
 await root.getByRole("button",{name:"Сертификация",exact:true}).click();
 await expect(root.getByRole("heading",{name:"Твоя сертификация"})).toBeVisible();
 const w=await root.evaluate(el=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth,transition:getComputedStyle(el.querySelector("button")??el).transitionProperty}));
 expect(w.width).toBeLessThanOrEqual(w.viewport+2);
 expect(w.transition).toContain("transform");
});
test("missing-source values never masquerade as issued certification or verified activity",async({page})=>{
 await page.route("**/api/v1/me/growth/snapshot",r=>r.fulfill({status:503,json:{detail:"down"}}));
 await page.route("**/api/v1/me/bootcamp/certificates",r=>r.fulfill({status:503,json:{detail:"down"}}));
 await page.goto("/workspace/9");
 await expect(page.getByRole("alert").filter({hasText:"История активности недоступна"})).toBeVisible();
 await page.getByRole("button",{name:"Сертификация",exact:true}).click();
 await expect(page.getByText("ID сертификата")).toBeVisible();
 await expect(page.getByText("Не присвоен")).toBeVisible();
 await expect(page.getByText("Реестр сертификатов недоступен")).toBeVisible();
});

for (const viewport of [
 { name: "desktop-1586", width: 1586, height: 992 },
 { name: "compact-desktop-1366", width: 1366, height: 900 },
 { name: "mobile-390", width: 390, height: 844 },
] as const) {
 test("analytics tab switcher stays stationary — "+viewport.name, async ({page}) => {
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.goto("/workspace/9");
  const root=page.getByTestId("analytics-v3");
  const nav=root.getByRole("navigation",{name:"Подразделы аналитики"});
  await expect(nav).toBeVisible();
  const sample=async()=>{
   await page.evaluate(async()=>{await document.fonts.ready;});
   return nav.evaluate((el)=>{
    const r=el.getBoundingClientRect();
    const buttons=Array.from(el.querySelectorAll<HTMLButtonElement>("button"), x=>{
     const rect=x.getBoundingClientRect();
     return {x:rect.x+window.scrollX,y:rect.y+window.scrollY,width:rect.width,height:rect.height};
    });
    return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height,buttons};
   });
  };
  const initial=await sample();
  for(const [tab,label] of [
   ["passport","Skill Passport"],["certification","Сертификация"],["activity","Активность"],
   ["certification","Сертификация"],["passport","Skill Passport"],
  ] as const) {
   await nav.getByRole("button",{name:label,exact:true}).click();
   await expect(root).toHaveAttribute("data-tab",tab);
   const next=await sample();
   for(const k of ["x","y","width","height"] as const){
    expect(Math.abs(next[k]-initial[k]),viewport.name+": nav "+k+" moved on "+label).toBeLessThanOrEqual(1);
   }
   expect(next.buttons.length).toBe(initial.buttons.length);
   initial.buttons.forEach((first,i)=>{
    const current=next.buttons.at(i);
    if(current===undefined)throw new Error("Missing analytics tab at index "+String(i));
    for(const k of ["x","y","width","height"] as const){
     expect(Math.abs(current[k]-first[k]),viewport.name+": button "+String(i)+" "+k+" moved on "+label).toBeLessThanOrEqual(1);
    }
   });
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
 });
}

test("certification reflects stored course and practice evidence, without inert checkboxes",async({page})=>{
 await page.route("**/api/v1/me/bootcamp/impulse-study/summary",r=>r.fulfill({json:{
  started_courses:1,finished_courses:1,completed_lessons:8,approved_practices:0,
  credited_practices:1,courses:[],
 }}));
 await page.goto("/workspace/9?analyticsTab=certification");
 const root=page.getByTestId("analytics-v3");
 await expect(root).toHaveAttribute("data-tab","certification");
 await expect(root.locator(".av3-requirements").getByText("1 завершено")).toBeVisible();
 await expect(root.locator(".av3-requirements").getByText("1 учтено")).toBeVisible();
 await expect(root.locator(".av3-todo input[type=checkbox]")).toHaveCount(0);
 await expect(root.getByRole("button",{name:"Условия сертификации"})).toBeVisible();
 await expect(root.getByRole("combobox",{name:"Период аналитики"})).toHaveCount(0);
 await root.getByRole("button",{name:"Условия сертификации"}).click();
 await expect(page.getByRole("dialog",{name:"Независимая сертификация"})).toBeVisible();
});
