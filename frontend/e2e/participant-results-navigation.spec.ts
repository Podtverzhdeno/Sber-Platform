import { expect, test, type Page } from "@playwright/test";

const navigation = [
  "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
  "Портфолио", "События", "Достижения", "Рейтинг", "Аналитика",
  "Сообщения", "AI-Buddy", "Настройки",
];

const portfolio = {
  person_id: "00000000-0000-4000-8000-000000000002",
  display_name: "Тест Участник", headline: "Практика и обучение",
  about: "", bio: "", location: "", public_url: null, demo_data: false,
  contributions: [], credentials: [], trophies: [], courses: [], offers: [],
  visibility: { public_profile: false, public_trophies: false, hr_profile: false },
};

async function setup(page: Page, allowed: string[]) {
  const actor = {
    person_id: portfolio.person_id, display_name: portfolio.display_name,
    active_role: "participant", assigned_roles: ["participant"],
    scopes: [], consent_scopes: [], navigation: allowed, csrf_token: "results-e2e",
  };
  let signedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({status:404, json:{code:"NOT_FOUND"}}));
  await page.route("**/api/v1/config", route => route.fulfill({json:{demo_mode:true}}));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({json:[{key:"results-participant",display_name:portfolio.display_name,roles:["participant"]}]}));
  await page.route(/\/api\/v1\/me$/, route => signedIn ? route.fulfill({json:actor}) : route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", route => {signedIn=true;return route.fulfill({json:actor});});
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({json:portfolio}));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({json:{skills:[],overall_level:null}}));
  await page.route("**/api/v1/me/project-credentials", route => route.fulfill({json:[]}));
  await page.route("**/api/v1/me/messaging/channels", route => route.fulfill({json:[]}));
  await page.route("**/api/v1/ecosystem/events", route => route.fulfill({json:{items:[],next_cursor:null}}));
  await page.goto("/");
  await page.locator('[data-persona="results-participant"]').click();
}

test("Results tabs link all four existing authorized sections and preserve history", async ({page}) => {
  await setup(page, navigation);
  await page.goto("/workspace/5");
  const nav = page.getByRole("navigation",{name:"Подразделы результатов"});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link",{name:"Портфолио"})).toHaveAttribute("aria-current","page");

  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(nav).toBeVisible();
    const box = await page.getByTestId("results-navigation").boundingBox();
    if (!box) throw Error("Results navigation missing");
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  }

  await nav.getByRole("link",{name:"Аналитика"}).click();
  await expect(page).toHaveURL(/\/workspace\/9/);
  const analyticsNav=page.getByRole("navigation",{name:"Подразделы результатов"});
  await expect(analyticsNav.getByRole("link",{name:"Аналитика"})).toHaveAttribute("aria-current","page");
  await analyticsNav.getByRole("link",{name:"Достижения"}).click();
  await expect(page).toHaveURL(/\/workspace\/7/);
  const achievementsNav=page.getByRole("navigation",{name:"Подразделы результатов"});
  await expect(achievementsNav.getByRole("link",{name:"Достижения"})).toHaveAttribute("aria-current","page");
  await achievementsNav.getByRole("link",{name:"Рейтинг"}).click();
  await expect(page).toHaveURL(/\/workspace\/8/);
  const ratingNav=page.getByRole("navigation",{name:"Подразделы результатов"});
  await expect(ratingNav.getByRole("link",{name:"Рейтинг"})).toHaveAttribute("aria-current","page");
  await ratingNav.getByRole("link",{name:"Портфолио"}).click();
  await expect(page).toHaveURL(/\/workspace\/5/);
  await expect(nav.getByRole("link",{name:"Портфолио"})).toHaveAttribute("aria-current","page");
  await page.goBack();
  await expect(page).toHaveURL(/\/workspace\/8/);
  await expect(page.getByRole("navigation",{name:"Подразделы результатов"}).getByRole("link",{name:"Рейтинг"})).toHaveAttribute("aria-current","page");
});

test("Results tabs do not create unauthorized portfolio or ranking entries", async ({page}) => {
  await setup(page, ["Главная","Аналитика","Достижения"]);
  await page.goto("/workspace/1");
  const nav = page.getByRole("navigation",{name:"Подразделы результатов"});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.getByRole("link",{name:"Портфолио"})).toHaveCount(0);
  await expect(nav.getByRole("link",{name:"Рейтинг"})).toHaveCount(0);
});
