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
      // All section destinations must remain available at 320px, without a hidden tab.
      const navigation = page.getByRole("navigation", {name:"Подразделы развития"});
      await expect(navigation.getByRole("button",{name:"Траектории"})).toBeVisible();
      await expect(navigation.getByRole("button",{name:"Уровни"})).toBeVisible();
      await expect(navigation.getByRole("link",{name:"Курсы"})).toBeVisible();
      if (width <= 600) {
        const contained = await navigation.evaluate(node => {
          const bounds = node.getBoundingClientRect();
          return Array.from(node.querySelectorAll("button,a")).every(item => {
            const rect = item.getBoundingClientRect();
            return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
          });
        });
        expect(contained).toBe(true);
      }
      if (mode === "light") {
        const skin = await screen.evaluate(node => {
          const selectors = [
            ".trajectory-v2-role-card",
            ".trajectory-v2-role-detail",
            ".trajectory-v2-reference-sidebar > section",
          ];
          const colors = selectors.map(selector => {
            const element = node.querySelector<HTMLElement>(selector);
            if (!element) throw new Error("Development surface missing: " + selector);
            const color = getComputedStyle(element).backgroundColor;
            const rgb = color.match(/[0-9]+/g)?.slice(0, 3).map(Number);
            if (!rgb || rgb.length !== 3) throw new Error("Non-solid Development background: " + color);
            return rgb;
          });
          return colors;
        });
        for (const [red, green, blue] of skin) {
          expect(Math.min(red, green, blue)).toBeGreaterThanOrEqual(220);
        }
        await page.getByRole("button", {name: /Все уровни/}).click();
        const gradeDialog = page.getByRole("dialog", {name: "Все уровни"});
        await expect(gradeDialog).toBeVisible();
        await expect(gradeDialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await gradeDialog.getByRole("button", {name: "Закрыть"}).click();
        await expect(gradeDialog).toBeHidden();

        // Role details are a second layer of the Development journey. Validate
        // real computed foreground/background contrast, not just theme tokens.
        const roleTrigger = screen.getByRole("button", {name: /О роли/}).first();
        await roleTrigger.click();
        const roleDialog = page.locator(".trajectory-v2-role-dialog");
        await expect(roleDialog).toBeVisible();
        await expect(roleDialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
        const roleAppearance = await roleDialog.evaluate(node => {
          const tablist = node.querySelector<HTMLElement>(".trajectory-v2-role-tabs");
          if (!tablist) throw new Error("Role details tabs missing");
          const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
          const tiles = Array.from(node.querySelectorAll<HTMLElement>(".trajectory-v2-role-intro-grid > section"));
          if (tabs.length !== 6 || tiles.length < 3) throw new Error("Role details contents missing");
          const toRgb = (value: string) => {
            const rgb = value.match(/[0-9]+/g)?.slice(0, 3).map(Number);
            if (!rgb || rgb.length !== 3) throw new Error("Unexpected color: " + value);
            return rgb;
          };
          const luminance = ([red, green, blue]: number[]) => {
            const normalized = (value: number) => {
              const c = value / 255;
              return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * normalized(red) + 0.7152 * normalized(green) + 0.0722 * normalized(blue);
          };
          const contrast = (foreground: string, background: string) => {
            const a = luminance(toRgb(foreground));
            const b = luminance(toRgb(background));
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          };
          const bg = getComputedStyle(node).backgroundColor;
          const title = node.querySelector<HTMLElement>(".trajectory-v2-role-modal-heading h2");
          if (!title) throw new Error("Role details heading missing");
          return {
            contrasts: tabs.map(tab => contrast(getComputedStyle(tab).color, bg)),
            headingContrast: contrast(getComputedStyle(title).color, bg),
            tileBackgrounds: tiles.map(tile => toRgb(getComputedStyle(tile).backgroundColor)),
            tabBounds: tabs.map(tab => {
              const rect = tab.getBoundingClientRect();
              return {left: rect.left, right: rect.right};
            }),
            listBounds: (() => {
              const rect = tablist.getBoundingClientRect();
              return {left: rect.left, right: rect.right};
            })(),
            layout: getComputedStyle(tablist).display,
          };
        });
        expect(roleAppearance.headingContrast).toBeGreaterThanOrEqual(4.5);
        for (const ratio of roleAppearance.contrasts) expect(ratio).toBeGreaterThanOrEqual(4.5);
        for (const rgb of roleAppearance.tileBackgrounds) expect(Math.min(...rgb)).toBeGreaterThanOrEqual(220);
        if (width <= 560) {
          expect(roleAppearance.layout).toBe("grid");
          roleAppearance.tabBounds.forEach(tab => {
            expect(tab.left).toBeGreaterThanOrEqual(roleAppearance.listBounds.left - 1);
            expect(tab.right).toBeLessThanOrEqual(roleAppearance.listBounds.right + 1);
          });
        }
        const roleTabs = roleDialog.getByRole("tablist", {name: "Разделы роли"});
        await roleTabs.getByRole("tab").first().focus();
        await page.keyboard.press("ArrowRight");
        await expect(roleTabs.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("Escape");
        await expect(roleDialog).toBeHidden();
        await expect(roleTrigger).toBeFocused();
      }
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
