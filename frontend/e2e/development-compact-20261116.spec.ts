import { expect, test, type Page } from "@playwright/test";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

const actor = {
  person_id:"00000000-0000-0000-0000-000000000002",
  display_name:"Синтетический участник",
  active_role:"participant",
  assigned_roles:["participant"],
  scopes:[],consent_scopes:[],
  navigation:["Главная","Моя траектория","Bootcamp","Задачи","Мои проекты","События","Рейтинг","Портфолио","Достижения","Аналитика","Сообщения","AI-Buddy","Настройки"],
  csrf_token:"development-compact-qa",
};

async function openDevelopment(page:Page,mode:"light"|"blue"|"midnight"){
  await page.addInitScript((value:string)=>{
    localStorage.setItem("impulse-visual-mode",value);
    localStorage.setItem("impulse-theme",value==="light"?"light":"dark");
  },mode);
  let authenticated=false;
  await page.route("**/api/v1/**",route=>route.fulfill({status:404,json:{code:"NOT_MOCKED"}}));
  await page.route("**/api/v1/config",route=>route.fulfill({json:{demo_mode:true,honor_board_enabled:false}}));
  await page.route("**/api/v1/auth/personas",route=>route.fulfill({json:[{key:"participant-alex",display_name:actor.display_name,roles:["participant"]}]}));
  await page.route(/\/api\/v1\/me$/,route=>authenticated?route.fulfill({json:actor}):route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login",route=>{authenticated=true;return route.fulfill({json:actor});});
  await page.route("**/api/v1/participant/me/development-overview",route=>route.fulfill({json:{
    ...overviewFixture,
    roles:[...overviewFixture.roles,
      {track_key:"data",title:"Data-аналитик",state:"paused",attempt_number:1,completed_milestones:1,total_milestones:3},
      {track_key:"product",title:"Продакт-менеджер",state:"unselected",attempt_number:null,completed_milestones:0,total_milestones:4},
    ],
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
  await page.goto("/workspace/1");
  await expect(page.locator('.trajectory-v2[data-reference="R-PAR-02"]')).toBeVisible();
}

for(const mode of ["light","blue","midnight"] as const){
  for(const width of [320,390,1440]){
    test("Development compact Apple reference "+mode+" at "+String(width)+"px",async({page})=>{
      await page.setViewportSize({width,height:900});
      await openDevelopment(page,mode);
      const screen=page.locator('.trajectory-v2[data-reference="R-PAR-02"]');
      await expect(screen.getByTestId("trajectory-role-card").first()).toBeVisible();
      await expect(screen.getByTestId("trajectory-role-detail")).toBeVisible();
      const geometry=await screen.evaluate(node=>{
        const header=node.querySelector<HTMLElement>(".trajectory-v2-heading");
        const columns=node.querySelector<HTMLElement>(".trajectory-v2-columns");
        if(!header||!columns)throw new Error("Development layout missing header or columns");
        const a=header.getBoundingClientRect();
        const b=columns.getBoundingClientRect();
        return {
          gap:Math.round(b.top-a.bottom),
          width:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          left:node.getBoundingClientRect().left,
          right:node.getBoundingClientRect().right,
          headerMargin:getComputedStyle(header).marginBottom,
        };
      });
      expect(geometry.gap).toBeGreaterThanOrEqual(0);
      expect(geometry.gap).toBeLessThanOrEqual(16);
      expect(geometry.scrollWidth-geometry.width).toBeLessThanOrEqual(2);
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(width+1);
      expect(geometry.headerMargin).toBe("12px");
      await page.getByRole("button",{name:"Impulse — открыть разделы"}).click();
      const menu=page.getByRole("dialog",{name:"Главное меню"});
      await expect(menu).toBeVisible();
      const dev=menu.getByRole("button",{name:"Развитие",exact:true});
      if(await dev.getAttribute("aria-expanded")!=="true")await dev.click();
      await expect(menu.getByRole("link",{name:"Моя траектория",exact:true})).toHaveAttribute("href","/workspace/1");
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });
  }
}
