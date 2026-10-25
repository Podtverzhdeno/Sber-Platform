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
test("annual calendar shows real source events on hover and in the day popup", async ({ page }) => {
 await page.setViewportSize({ width: 1586, height: 992 });
 await stubs(page);
 await page.goto("/workspace/9");
 const root = page.getByTestId("analytics-v3");
 const calendar = root.getByTestId("activity-calendar");
 await expect(calendar).toBeVisible();
 await expect(calendar.locator(".ac-week")).toHaveCount(52);
 await expect(calendar.locator(".ac-day:not(.ac-level-0):not(.ac-unknown)").first()).toBeVisible();
 const populated = calendar.locator(".ac-day:not(.ac-level-0):not(.ac-unknown)").first();
 await expect(populated).toBeVisible();
 await populated.hover();
 await expect(page.getByRole("tooltip")).toContainText("Завершён");
 await populated.click();
 const modal = page.getByRole("dialog", { name: /Активность/ });
 await expect(modal).toBeVisible();
 await expect(modal.getByText(/часы: длительность не измеряется/)).toBeVisible();
 await expect(modal.locator(".ac-day-events article")).toHaveCount(1);
 await page.screenshot({ path: "test-results/activity-calendar-desktop.png", fullPage: true, animations: "disabled" });
 await modal.getByRole("button", { name: "Закрыть подробности дня" }).click();
 await expect(modal).not.toBeVisible();
 await expect(populated).toBeFocused();
});

test("calendar is scrollable on mobile and period selector controls weeks", async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await stubs(page);
 await page.goto("/workspace/9");
 const root = page.getByTestId("analytics-v3");
 const calendar = root.getByTestId("activity-calendar");
 await expect(calendar.locator(".ac-week")).toHaveCount(52);
 await root.getByRole("combobox", { name: "Период аналитики" }).selectOption("12");
 await expect(calendar.locator(".ac-week")).toHaveCount(12);
 const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
 expect(horizontalOverflow).toBeLessThanOrEqual(2);
 const scroll = calendar.getByRole("region", { name: /горизонтальная прокрутка/ });
 await expect(scroll).toBeVisible();
 await page.screenshot({ path: "test-results/activity-calendar-mobile.png", fullPage: true, animations: "disabled" });
 await root.getByRole("button", { name: "Skill Passport", exact: true }).click();
 await expect(root).toHaveAttribute("data-tab", "passport");
});

test("failed growth feed keeps error visible and does not fabricate hours", async ({ page }) => {
 await stubs(page);
 await page.route("**/api/v1/me/growth/snapshot", route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
 await page.goto("/workspace/9");
 await expect(page.getByRole("alert").filter({ hasText: "История активности недоступна" })).toBeVisible();
 const calendar = page.getByTestId("activity-calendar");
 await expect(calendar).toBeVisible();
 await expect(calendar.getByText(/Показаны только зарегистрированные действия/)).toBeVisible();
 const populated = calendar.locator(".ac-day:not(.ac-level-0):not(.ac-unknown)").first();
 await populated.click();
 await expect(page.getByRole("dialog").getByText(/часы: длительность не измеряется/)).toBeVisible();
});
