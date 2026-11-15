import { expect, test, type Page } from "@playwright/test";

const profile = {
  person_id: "00000000-0000-4000-8000-000000000002",
  display_name: "Тест Участник", city: "", university: "", study_year: "",
  primary_track: "python", email: "", telegram: "", about: "",
  avatar_url: "", locale: "ru-RU", theme: "dark", timezone: "Europe/Moscow",
  buddy_enabled: false, skills: [],
};

async function installAdditionalActor(page: Page, navigation: string[]) {
  const actor = {
    person_id: profile.person_id, display_name: profile.display_name,
    active_role: "participant", assigned_roles: ["participant"],
    scopes: [], consent_scopes: [], navigation, csrf_token: "additional-e2e-csrf",
  };
  let signedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true, honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-test", display_name: profile.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me$/, route => signedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => { signedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/me/profile", route => route.fulfill({ json: profile }));
  await page.goto("/");
  await page.locator('[data-persona="participant-test"]').click();
}

test("Additional local tabs navigate between real Settings and disabled AI Buddy at 320,390,1440", async ({page}) => {
  await installAdditionalActor(page, ["Главная", "Задачи", "AI-Buddy", "Настройки"]);
  await page.goto("/workspace/3");
  const nav = page.getByRole("navigation", { name: "Подразделы дополнительного" });
  await expect(nav.getByRole("link", { name: "Настройки" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "AI Buddy" })).toHaveAttribute("href", "/workspace/2");
  await expect(page.getByRole("heading", { name: "Настройки", exact: true })).toBeVisible();

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({width, height:900});
    await expect(page.getByTestId("additional-navigation")).toBeVisible();
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, "Settings must not horizontally overflow the document").toBeLessThanOrEqual(width+1);
  }
  await nav.getByRole("link", { name: "AI Buddy" }).click();
  await expect(page).toHaveURL(/\/workspace\/2/);
  await expect(page.getByText("AI-Buddy отключён в настройках.")).toBeVisible();
  const buddyNav = page.getByRole("navigation", { name: "Подразделы дополнительного" });
  await expect(buddyNav.getByRole("link", { name: "AI Buddy" })).toHaveAttribute("aria-current", "page");
  await buddyNav.getByRole("link", { name: "Настройки" }).click();
  await expect(page).toHaveURL(/\/workspace\/3/);
});

test("Additional never adds unauthorized AI Buddy destination", async ({page}) => {
  await installAdditionalActor(page, ["Главная", "Задачи", "Настройки"]);
  await page.goto("/workspace/2");
  const nav = page.getByRole("navigation", { name: "Подразделы дополнительного" });
  await expect(nav.getByRole("link", { name: "Настройки" })).toHaveAttribute("href", "/workspace/2");
  await expect(nav.getByRole("link", { name: "AI Buddy" })).toHaveCount(0);
});
