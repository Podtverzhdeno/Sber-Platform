import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика", "Настройки"],
  csrf_token: "csrf",
};

async function openPortfolio(page: import("@playwright/test").Page, skills: {key:string;practical_level:string;confirmed_case_count:number}[]) {
  await page.route("**/api/v1/config", route => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key:"participant-alex", display_name: actor.display_name, roles:["participant"] }] }));
  await page.route("**/api/v1/me", route => route.fulfill({ status:401, json:{ code:"AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => route.fulfill({ json:actor }));
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({ json:{
    person_id:actor.person_id, display_name:actor.display_name, demo_data:false,
    visibility:{hr_profile:false,public_profile:false,public_trophies:false},
    contributions:[], courses:[], credentials:[], trophies:[], offers:[],
  } }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({json:{
    verified_courses:[], cases:[], skills,
  }}));
  await page.route("**/api/v1/me/project-credentials", route => route.fulfill({ json:[] }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  // SPA navigation preserves the demo session when the mobile sidebar is collapsed.
  await page.locator('a[href="/workspace/5"]').evaluate(node => { (node as HTMLAnchorElement).click(); });
  await expect(page.getByTestId("portfolio-v2")).toBeVisible();
}

for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test(`qualitative passport renders two actual skills without imaginary radar levels (${viewport.width}px)`, async ({page}) => {
    await page.setViewportSize(viewport);
    await openPortfolio(page, [
      {key:"python",practical_level:"подтверждено",confirmed_case_count:2},
      {key:"recommender-systems",practical_level:"практически подтверждено",confirmed_case_count:1},
    ]);
    const panel=page.getByRole("region",{name:"Skill Passport"});
    await expect(panel.getByTestId("passport-evidence-chart")).toBeVisible();
    await expect(panel.getByTestId("passport-skill-radar")).toHaveCount(0);
    await expect(panel.getByText("Python",{exact:true})).toBeVisible();
    await expect(panel.getByText("Рекомендательные системы",{exact:true})).toBeVisible();
    await expect(panel.getByText("Число кейсов не означает уровень компетенции")).toBeVisible();
    await expect(panel.getByText("2",{exact:true}).first()).toBeVisible();
    await expect(panel.locator(".p2-skill-level")).toHaveCount(2);
    await panel.getByRole("button",{name:/Открыть Skill Passport/}).click();
    await expect(page).toHaveURL(/analyticsTab=passport$/);
  });
}

test("measurable passport with three independently scored skills draws real three-axis radar",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await openPortfolio(page,[
    {key:"python",practical_level:"L2",confirmed_case_count:1},
    {key:"architecture",practical_level:"L3",confirmed_case_count:3},
    {key:"testing",practical_level:"L4",confirmed_case_count:2},
  ]);
  const panel=page.getByRole("region",{name:"Skill Passport"});
  const radar=panel.getByTestId("passport-skill-radar");
  await expect(radar).toBeVisible();
  await expect(radar).toHaveAttribute("aria-label",/python — 2.*architecture — 3.*testing — 4/);
  await expect(panel.locator(".p2-skill-level")).toHaveCount(3);
});
