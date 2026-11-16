import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id:"00000000-0000-0000-0000-000000000001",
  display_name:"Синтетический участник",
  active_role:"participant",
  assigned_roles:["participant"],scopes:[],consent_scopes:[],
  navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],
  csrf_token:"analytics-light-qa",
};
const isoNow=()=>new Date().toISOString();
const eventDay=()=>new Date(Date.now()-86400000).toISOString();
async function prepare(page:Page,mode:"light"|"blue"|"midnight"){
  await page.addInitScript((visualMode:string)=>{
    localStorage.setItem("impulse-visual-mode",visualMode);
    localStorage.setItem("impulse-theme",visualMode==="light"?"light":"dark");
  },mode);
  await page.route("**/api/v1/config",r=>r.fulfill({json:{demo_mode:true,honor_board_enabled:false}}));
  await page.route("**/api/v1/me",r=>r.fulfill({json:actor}));
  await page.route("**/api/v1/me/growth/snapshot",r=>r.fulfill({json:{
    snapshot_id:"analytics-light-check",generated_at:isoNow(),actor_timezone:"Europe/Moscow",
    freshness:{known:true,latest_observed_at:eventDay()},
    events:[{occurred_at:eventDay(),kind:"lesson_finished",title:"Синтетический проверенный урок",source_kind:"impulse_action",source_ref:"lesson-1"}],
  }}));
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary",r=>r.fulfill({json:{
    started_courses:1,finished_courses:1,completed_lessons:3,approved_practices:0,
    credited_practices:0,courses:[{
      course_key:"python",title:"Python",completed_units:3,total_units:3,finished:true,
      finished_at:isoNow(),certificate_id:"CERT-PY",updated_at:isoNow(),
      practice_status:null,practical_certificate_id:null,
    }],
  }}));
  await page.route("**/api/v1/me/bootcamp/certificates",r=>r.fulfill({json:[]}));
  await page.goto("/workspace/9",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("analytics-v3")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
}
const color=async(page:Page,selector:string)=>page.locator(selector).first().evaluate(el=>getComputedStyle(el).backgroundColor);
const isDark=(background:string)=>{
  const m=background.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if(!m)throw Error("Unrecognized background: "+background);
  return (Number(m[1])+Number(m[2])+Number(m[3]))/3<140;
};

for(const mode of ["light","blue","midnight"] as const){
  for(const width of [320,390,1440]){
    test("analytics solid surfaces "+mode+" "+String(width)+"px",async({page})=>{
      await page.setViewportSize({width,height:840});
      await prepare(page,mode);
      const root=page.getByTestId("analytics-v3");
      const calendar=root.getByTestId("activity-calendar");
      await expect(calendar).toBeVisible();
      await expect(calendar.locator(".ac-week")).toHaveCount(52);
      const card=await color(page,".analytics-v3 .ac-calendar-card");
      const summary=await color(page,".analytics-v3 .ac-summary span");
      const filter=await color(page,".analytics-v3 .av3-global-filters select");
      if(mode==="light"){
        expect(card).toBe("rgb(255, 255, 255)");
        expect(isDark(summary)).toBe(false);
        expect(isDark(filter)).toBe(false);
      } else{
        expect(isDark(card)).toBe(true);
        expect(isDark(summary)).toBe(true);
        expect(isDark(filter)).toBe(true);
      }
      const populated=calendar.locator(".ac-day:not(.ac-level-0):not(.ac-unknown)").first();
      await expect(populated).toBeVisible();
      await populated.click();
      const dayDialog=page.getByRole("dialog",{name:/Активность /});
      await expect(dayDialog).toBeVisible();
      if(mode==="light"){
        expect(await color(page,".ac-day-dialog")).toBe("rgb(255, 255, 255)");
        expect(isDark(await color(page,".ac-day-events article"))).toBe(false);
      } else {
        expect(isDark(await color(page,".ac-day-dialog"))).toBe(true);
      }
      await dayDialog.getByRole("button",{name:"Закрыть подробности дня"}).click();
      await expect(dayDialog).toHaveCount(0);
      await root.getByRole("button",{name:"Сертификация",exact:true}).click();
      await expect(root).toHaveAttribute("data-tab","certification");
      await expect(root.getByTestId("analytics-study-results")).toBeVisible();
      for(const selector of [".av3-study-results",".av3-study-metrics>div",".av3-study-course"]){
        const bg=await color(page,".analytics-v3 "+selector);
        if(mode==="light")expect(isDark(bg),selector).toBe(false);
        else expect(isDark(bg),selector).toBe(true);
      }
      await root.getByRole("button",{name:/Practitioner/}).first().click();
      const levelDialog=page.getByRole("dialog",{name:/Practitioner/});
      await expect(levelDialog).toBeVisible();
      if(mode==="light")expect(await color(page,".analytics-v3 .av3-dialog")).toBe("rgb(255, 255, 255)");
      else expect(isDark(await color(page,".analytics-v3 .av3-dialog"))).toBe(true);
      await levelDialog.getByRole("button",{name:"Закрыть"}).click();
      await expect(levelDialog).toHaveCount(0);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,"document-level horizontal overflow").toBeLessThanOrEqual(2);
    });
  }
}
