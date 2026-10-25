import { test, expect, type Page } from "@playwright/test";
const actor={
  person_id:"00000000-0000-0000-0000-000000000001",
  display_name:"Алекс Речной",active_role:"participant",
  assigned_roles:["participant"],scopes:[],consent_scopes:[],
  navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения"],csrf_token:"csrf",
};
const now=()=>new Date().toISOString();
const course=(key:string,title:string,done:number,total:number,finished:boolean)=>({
  course_key:key,title,completed_units:done,total_units:total,finished,
  finished_at:finished?now():null,certificate_id:finished?"CERT-"+key:null,
  updated_at:now(),practice_status:null,practical_certificate_id:null,
});
async function stubs(page:Page){
 await page.route("**/api/v1/config",r=>r.fulfill({json:{honor_board_enabled:true}}));
 await page.route("**/api/v1/me",r=>r.fulfill({json:actor}));
 await page.route("**/api/v1/auth/demo-login",r=>r.fulfill({json:actor}));
 await page.route("**/api/v1/me/bootcamp/impulse-study/summary",r=>r.fulfill({json:{
  started_courses:3,finished_courses:2,completed_lessons:17,approved_practices:1,
  courses:[course("python","Python: основа",8,8,true),
   course("agents","Агентная разработка",8,8,true),
   course("product","Аналитика продукта",1,8,false)]
 }}));
 await page.route("**/api/v1/me/engagement/overview",r=>r.fulfill({json:{
  current_days:11,best_days:11,today_saved:true,reason:"",grace_available:false,
  qualified_dates:[],frozen_dates:[],freeze_state:"idle"
 }}));
 await page.route("**/api/v1/me/growth/snapshot",r=>r.fulfill({json:{
  snapshot_id:"act-fixture",generated_at:now(),actor_timezone:"Europe/Moscow",
  freshness:{known:true,latest_observed_at:now()},trajectories:[],
  events:Array.from({length:5},(_,i)=>({
   occurred_at:new Date(Date.now()-(i+1)*86400000).toISOString(),
   kind:i<2?"lesson_finished":i===2?"task_completed":i===3?"project_review":"event_participation",
   title:["Завершён урок","Выполнено обучение","Практика","Обновлён проект","Участие в сообществе"][i],
   source_kind:"impulse_action",source_ref:"event-"+String(i)
  }))
 }}));
 await page.route("**/api/v1/me/bootcamp/certificates",r=>r.fulfill({json:[]}));
}
test("premium analytics is bound to Bootcamp, streak and activity sources",async({page})=>{
 await page.setViewportSize({width:1586,height:992});await stubs(page);
 await page.goto("/workspace/9");
 const root=page.getByTestId("analytics-v3");
 await expect(root).toHaveAttribute("data-tab","activity");
 const premium=root.getByTestId("premium-activity");
 await expect(premium).toBeVisible();
 await expect(premium.getByRole("heading",{name:"Учебный прогресс"})).toBeVisible();
 await expect(premium.getByText("17",{exact:true})).toBeVisible();
 await expect(premium.getByText("2",{exact:true}).first()).toBeVisible();
 await expect(premium.getByText("11 дней")).toBeVisible();
 await expect(premium.getByRole("heading",{name:"Текущие курсы"})).toBeVisible();
 await expect(premium.locator(".avp-course")).toHaveCount(3);
 await expect(premium.locator(".av3-week-columns > div")).toHaveCount(8);
 await expect(premium.locator(".avp-profile__legend > div")).toHaveCount(5);
 await expect(premium.getByText("Длительность сессий не измеряется")).toBeVisible();
 await page.screenshot({path:"test-results/analytics-premium-1586.png",fullPage:true,animations:"disabled"});
 await premium.getByRole("button",{name:"Все курсы"}).click();
 await expect(page).toHaveURL(/workspace\/2/);
});
test("premium analytics fits mobile and period and tabs remain interactive",async({page})=>{
 await page.setViewportSize({width:390,height:844});await stubs(page);
 await page.goto("/workspace/9");
 const root=page.getByTestId("analytics-v3");
 const premium=root.getByTestId("premium-activity");
 await expect(premium).toBeVisible();
 await root.getByRole("combobox",{name:"Период аналитики"}).selectOption("4");
 await expect(premium.locator(".av3-week-columns > div")).toHaveCount(4);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.screenshot({path:"test-results/analytics-premium-mobile-390.png",fullPage:true,animations:"disabled"});
 await root.getByRole("button",{name:"Skill Passport",exact:true}).click();
 await expect(root).toHaveAttribute("data-tab","passport");
 await root.getByRole("button",{name:"Активность",exact:true}).click();
 await expect(root).toHaveAttribute("data-tab","activity");
});
test("missing activity or streak source displays unknown, never fake zeros",async({page})=>{
 await stubs(page);
 await page.route("**/api/v1/me/growth/snapshot",r=>r.fulfill({status:503,json:{message:"Unavailable"}}));
 await page.route("**/api/v1/me/engagement/overview",r=>r.fulfill({status:503,json:{message:"Unavailable"}}));
 await page.goto("/workspace/9");
 const root=page.getByTestId("premium-activity");
 await expect(root).toBeVisible();
 await expect(root.getByText("Показатель временно недоступен")).toBeVisible();
 await expect(root.getByText(/Нет истории активности/)).toBeVisible();
 await expect(root.getByText("Длительность сессий не измеряется")).toBeVisible();
});
