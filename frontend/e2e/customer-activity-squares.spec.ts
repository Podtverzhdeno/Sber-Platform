import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000005",
  display_name: "Роман Воронов",
  active_role: "customer",
  assigned_roles: ["customer"],
  scopes: [], consent_scopes: [], csrf_token: "csrf",
  navigation: ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"],
};

test("customer activity matches participant day squares and opens actual events in a dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = new Date();
  const prior = new Date(today.getTime() - 86_400_000);
  const stamp = prior.toISOString();

  await page.route("**/api/v1/config", route => route.fulfill({json:{demo_mode:true}}));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json:[{key:"customer-roman",display_name:actor.display_name,roles:["customer"]}],
  }));
  await page.route(/\/api\/v1\/me$/, route => route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", route => route.fulfill({json:actor}));
  await page.route("**/api/v1/customer/tasks", route => route.fulfill({
    json:[{id:"project-1",title:"Рекомендательная система",status:"in_progress"}],
  }));
  await page.route("**/api/v1/customer/analytics/activity", route => route.fulfill({
    json:{
      generated_at:new Date().toISOString(),window_days:84,
      events:[{id:"event-1",kind:"result_accepted",task_id:"project-1",task_title:"Рекомендательная система",occurred_at:stamp}],
    },
  }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Аналитика"}).click();

  const dashboard=page.getByTestId("customer-activity-v3");
  await expect(dashboard).toBeVisible();
  await expect(dashboard.locator(".ca3-heat-cell")).toHaveCount(56);
  const dimensions=await dashboard.locator(".ca3-heat-cell").first().evaluate(node=>{
    const r=node.getBoundingClientRect();
    return {width:r.width,height:r.height};
  });
  expect(dimensions).toEqual({width:14,height:14});

  const populated=dashboard.locator(".ca3-heat-cell[aria-label*='1 событий']").first();
  await expect(populated).toBeVisible();
  await populated.hover();
  await expect(page.getByRole("tooltip")).toContainText("1 событий");
  await populated.click();
  const dialog=page.getByRole("dialog",{name:/Активность/});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Результат принят");
  await expect(dialog).toContainText("Рекомендательная система");
  await expect(dialog).toContainText("Часы работы не вычисляются");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await dashboard.getByRole("combobox",{name:"Период аналитики заказчика"}).selectOption("4");
  await expect(dashboard.locator(".ca3-heat-cell")).toHaveCount(28);
  await page.setViewportSize({width:390,height:844});
  await expect(dashboard.locator(".ca3-heat-cell").first()).toHaveCSS("width","14px");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
