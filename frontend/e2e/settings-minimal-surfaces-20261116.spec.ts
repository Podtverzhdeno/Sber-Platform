import { expect, test, type Page } from "@playwright/test";

type Mode = "light" | "blue" | "midnight";
const actor = {
  person_id: "00000000-0000-4000-8000-000000000002",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Главная", "AI-Buddy", "Настройки"],
  csrf_token: "settings-apple-qa",
};
const profile = {
  person_id: actor.person_id, display_name: actor.display_name,
  city: "Москва", university: "МГТУ", study_year: "3",
  primary_track: "python", email: "example@test.invalid",
  telegram: "", about: "", avatar_url: "", locale: "ru-RU",
  theme: "light", timezone: "Europe/Moscow", buddy_enabled: false, skills: [],
};
async function openSettings(page: Page, mode: Mode) {
  await page.addInitScript((value: string) => {
    localStorage.setItem("impulse-visual-mode", value);
    localStorage.setItem("impulse-theme", value === "light" ? "light" : "dark");
  }, mode);
  let authenticated = true;
  await page.route("**/api/v1/**", route => route.fulfill({status:404,json:{code:"NOT_AVAILABLE"}}));
  await page.route("**/api/v1/config", route => route.fulfill({json:{demo_mode:true,honor_board_enabled:false}}));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({json:[{
    key:"settings-synthetic",display_name:actor.display_name,roles:["participant"],
  }]}));
  await page.route(/\/api\/v1\/me$/, route => authenticated
    ? route.fulfill({json:actor})
    : route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", route => {
    authenticated = true;
    return route.fulfill({json:actor});
  });
  await page.route("**/api/v1/me/profile", route => route.fulfill({json:profile}));
  await page.route("**/api/v1/me/visibility", route => route.fulfill({json:{visibility:{
    hr_basic:true,hr_skills:true,hr_projects:true,hr_achievements:true,
    hr_learning:true,hr_contacts:false,
  }}}));
  await page.goto("/workspace/2", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".participant-settings.additional-page")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode",mode);
  await expect(page.getByRole("heading",{name:"Настройки",exact:true})).toBeVisible();
}
function perceivedLightness(value: string) {
  const m = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if(!m) throw new Error("Unknown RGB "+value);
  return (0.2126*Number(m[1])+0.7152*Number(m[2])+0.0722*Number(m[3]))/255;
}
async function inspectSurface(page:Page,selector:string) {
  return page.locator(".participant-settings.additional-page "+selector).first().evaluate(el=>{
    const style=getComputedStyle(el);
    const bounds=el.getBoundingClientRect();
    return {background:style.backgroundColor,foreground:style.color,left:bounds.left,right:bounds.right};
  });
}
for(const mode of ["light","blue","midnight"] as const){
  for(const width of [320,390,1440]){
    test("Grouped Settings "+mode+" "+String(width)+"px",async({page})=>{
      await page.setViewportSize({width,height:900});
      await openSettings(page,mode);
      const navigation=page.getByRole("navigation",{name:"Разделы настроек"});
      await expect(navigation.getByRole("button")).toHaveCount(8);
      await expect(page.getByRole("button",{name:"Сохранить изменения"})).toBeVisible();
      const panels=[
        [".settings-panel","content panel"],
        [".settings-nav","settings navigation"],
        [".form-grid input","profile input"],
        [".settings-select input","photo URL input"],
        [".profile-avatar","initials avatar"],
      ] as const;
      for(const [selector,label] of panels){
        const surface=await inspectSurface(page,selector);
        const lightness=perceivedLightness(surface.background);
        if(mode==="light")expect(lightness,label+" shouldn't be dark").toBeGreaterThan(0.8);
        else expect(lightness,label+" shouldn't be white").toBeLessThan(0.28);
        expect(surface.right,label+" should fit viewport").toBeLessThanOrEqual(width+2);
      }
      await navigation.getByRole("button",{name:"Безопасность"}).click();
      const security=await inspectSurface(page,".settings-cards article");
      await navigation.getByRole("button",{name:"Согласия"}).click();
      const toggle=await inspectSurface(page,".settings-toggle");
      const checkbox=page.getByRole("checkbox",{name:"Публичный профиль и достижения"});
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
      await navigation.getByRole("button",{name:"Уведомления"}).click();
      const notification=await inspectSurface(page,".notification-group");
      const required=await inspectSurface(page,".required-notification-list li");
      await navigation.getByRole("button",{name:"Видимость для HR"}).click();
      const hr=await inspectSurface(page,".hr-preview");
      await navigation.getByRole("button",{name:"AI-Buddy"}).click();
      const danger=await inspectSurface(page,".danger-zone");
      for(const [label,surface] of Object.entries({security,toggle,notification,required,hr,danger})){
        const l=perceivedLightness(surface.background);
        if(mode==="light")expect(l,label+" shouldn't use a dark surface").toBeGreaterThan(0.8);
        else expect(l,label+" shouldn't use a light surface").toBeLessThan(0.28);
      }
      await navigation.getByRole("button",{name:"Предпочтения"}).click();
      const select=await inspectSurface(page,".form-grid select");
      if(mode==="light")expect(perceivedLightness(select.background)).toBeGreaterThan(0.8);
      else expect(perceivedLightness(select.background)).toBeLessThan(0.28);
      await navigation.getByRole("button",{name:"Подбор"}).click();
      await expect(page.getByRole("checkbox",{name:"Показывать мой профиль в подборе"})).toBeVisible();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,"no horizontal document scrolling").toBeLessThanOrEqual(2);
    });
  }
}

test("Settings: preference input and tab selection remain available on mobile",async({page})=>{
  await page.setViewportSize({width:320,height:720});
  await openSettings(page,"light");
  const nav=page.getByRole("navigation",{name:"Разделы настроек"});
  await nav.getByRole("button",{name:"Профиль"}).click();
  const name=page.getByRole("textbox",{name:"ФИО"});
  await expect(name).toHaveValue(actor.display_name);
  await name.fill("Новый участник");
  await nav.getByRole("button",{name:"Предпочтения"}).click();
  await expect(page.getByRole("combobox",{name:"Тема"})).toBeVisible();
  await nav.getByRole("button",{name:"Профиль"}).click();
  await expect(page.getByRole("textbox",{name:"ФИО"})).toHaveValue("Новый участник");
  await page.getByRole("button",{name:"Impulse — открыть разделы"}).click();
  const menu=page.getByRole("dialog",{name:"Главное меню"});
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
