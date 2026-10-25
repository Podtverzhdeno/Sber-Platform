import { expect, test } from "@playwright/test";

test("portfolio: reference layout, verified proof, tabs, accessible dialogs and HR visibility", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000001", display_name: "Алекс Речной",
    active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [],
    navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"], csrf_token: "csrf",
  };
  let hrVisible = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({ json: {
    person_id: actor.person_id, display_name: actor.display_name, demo_data: true,
    visibility: { hr_profile: hrVisible, public_profile: false, public_trophies: false },
    contributions: [
      { contribution_id: "10000000-0000-0000-0000-000000000001", project_title: "R&D прототип", personal_summary: "Реализовал API и проверяемый эксперимент.", artifact_keys: ["demo-report"], grade: "A", review_reason: "Результат воспроизводим, вклад подтверждён.", verification_status: "verified" },
      { contribution_id: "10000000-0000-0000-0000-000000000002", project_title: "Вторая задача", personal_summary: "Проверил пользовательский сценарий.", artifact_keys: ["report", "source"], grade: "B", review_reason: "Результат принят.", verification_status: "verified" },
    ],
    courses: [{ key: "openspec", title: "OpenSpec и SDD", status: "verified" }],
    credentials: [{ verification_id: "COURSE-1", title: "OpenSpec и SDD", credential_type: "course", status: "Проверяемый", issuer: "Impulse" }],
    trophies: [{ title: "Победитель", organizer: "Организатор", source_url: "https://example.org/proof", trophy_type: "Победа" }],
    offers: [],
  } }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: {
    verified_courses: ["openspec"],
    skills: [{ key: "Самостоятельность", practical_level: "L3", confirmed_case_count: 1 }],
    cases: [{ contribution_id: "10000000-0000-0000-0000-000000000001", submitted_at: "2026-09-28", reviewer_id: "10000000-0000-0000-0000-000000000010" }],
  } }));
  await page.route("**/api/v1/me/project-credentials", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/consents/hr_profile", async route => {
    hrVisible = (route.request().postDataJSON() as { granted: boolean }).granted;
    await route.fulfill({ json: { scope: "hr_profile", granted: hrVisible, granted_scopes: hrVisible ? ["hr_profile"] : [] } });
  });

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Портфолио" }).click();
  await expect(page.getByTestId("portfolio-v2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Алекс Речной" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(6);
  await expect(page.getByRole("tab", { name: "Обзор" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".p2-project")).toHaveCount(2);
  await expect(page.getByText("Самостоятельность", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("OpenSpec и SDD").first()).toBeVisible();

  await page.screenshot({path:"test-results/portfolio-reference-1672x941.png",fullPage:true});
  const hero = await page.locator(".p2-hero").boundingBox();
  const tabs = await page.locator(".p2-tabs").boundingBox();
  const projects = await page.locator(".p2-projects-panel").boundingBox();
  const passport = await page.locator(".p2-passport-panel").boundingBox();
  if (!hero || !tabs || !projects || !passport) throw new Error("Portfolio geometry is incomplete");
  expect(hero.height).toBeGreaterThanOrEqual(200);
  expect(hero.height).toBeLessThan(350);
  expect(Math.abs((tabs.y - hero.y - hero.height) - 12)).toBeLessThanOrEqual(3);
  expect(projects.x).toBeLessThan(passport.x);
  expect(Math.abs(projects.y - passport.y)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);

  await page.getByRole("button", { name: /Открыть кейс/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Подтверждённый проект" })).toBeVisible();
  await expect(page.getByText("Результат воспроизводим, вклад подтверждён.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "Skill Passport" }).click();
  await expect(page.locator(".p2-skill-detail")).toContainText("1 подтверждённых кейсов");
  await page.getByRole("tab", { name: "Сертификация" }).click();
  await page.getByRole("button", { name: /OpenSpec и SDD/ }).click();
  await expect(page.getByRole("dialog", { name: "Сертификат" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("tab", { name: "Достижения" }).click();
  await expect(page.getByText("Победитель", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "О себе" }).click();
  await page.getByRole("checkbox", { name: "Резюме для HR" }).click();
  await expect.poll(() => hrVisible).toBe(true);
  await expect(page.getByRole("checkbox", { name: "Резюме для HR" })).toBeChecked();
  await page.getByRole("tab", { name: "Обзор" }).click();
  await expect(page.locator(".p2-project")).toHaveCount(2);
});

test("portfolio: narrow layout never overflows and all six tabs remain reachable", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/v1/me/portfolio", route=>route.fulfill({json:{
    person_id:"demo",display_name:"Алекс Речной",demo_data:true,
    visibility:{hr_profile:false,public_profile:false,public_trophies:false},
    contributions:[],courses:[],credentials:[],trophies:[],offers:[],
  }}));
  await page.route("**/api/v1/me/talent-passport", route=>route.fulfill({json:{verified_courses:[],skills:[],cases:[]}}));
  await page.route("**/api/v1/me/project-credentials", route=>route.fulfill({json:[]}));
  await page.route("**/api/v1/config", route=>route.fulfill({json:{honor_board_enabled:false}}));
  await page.route("**/api/v1/me", route=>route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/personas", route=>route.fulfill({json:[{key:"participant-alex",display_name:"Алекс Речной",roles:["participant"]}]}));
  await page.route("**/api/v1/auth/demo-login", route=>route.fulfill({json:{
    person_id:"demo",display_name:"Алекс Речной",active_role:"participant",
    assigned_roles:["participant"],scopes:[],consent_scopes:[],navigation:["Главная","Портфолио"],csrf_token:"csrf",
  }}));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  const menu = page.getByRole("button", { name: /Меню/ });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "Портфолио" }).click();
  await expect(page.getByTestId("portfolio-v2")).toBeVisible();
  for (const name of ["Обзор","Skill Passport","Проекты","Сертификация","Достижения","О себе"]) {
    await page.getByRole("tab",{name}).click();
    await expect(page.getByRole("tab",{name})).toHaveAttribute("aria-selected","true");
  }
  await expect(page.getByRole("heading",{name:"Алекс Речной"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
  await page.screenshot({path:"test-results/portfolio-mobile-390x844.png",fullPage:true});
});
