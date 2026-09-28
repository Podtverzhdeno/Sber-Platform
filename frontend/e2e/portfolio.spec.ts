import { expect, test } from "@playwright/test";

test("participant controls HR visibility and sees review reason", async ({ page }) => {
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000001", display_name: "Алекс Речной",
    active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [],
    navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"], csrf_token: "csrf",
  };
  let hrVisible = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/portfolio", (route) => route.fulfill({ json: {
    person_id: actor.person_id, display_name: actor.display_name, demo_data: true,
    visibility: { hr_profile: hrVisible, public_profile: false, public_trophies: false },
    contributions: [{ contribution_id: "10000000-0000-0000-0000-000000000001", project_title: "R&D прототип", personal_summary: "Реализовал API и проверяемый эксперимент.", artifact_keys: ["demo-report"], grade: "A", review_reason: "Результат воспроизводим, вклад подтверждён.", verification_status: "verified" }],
    courses: [{ key: "openspec", title: "OpenSpec и SDD", status: "verified" }], credentials: [], trophies: [], offers: [],
  } }));
  await page.route("**/api/v1/me/consents/hr_profile", async (route) => { hrVisible = (route.request().postDataJSON() as { granted: boolean }).granted; await route.fulfill({ json: { scope: "hr_profile", granted: hrVisible, granted_scopes: hrVisible ? ["hr_profile"] : [] } }); });

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Портфолио" }).click();
  await expect(page.getByRole("heading", { name: "Алекс Речной" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Мой лучший принятый вклад" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Чем выделяется кандидат" })).toBeVisible();
  await expect(page.getByText("Талант-сигнал")).toBeVisible();
  await page.getByRole("button", { name: /Самостоятельность/ }).click();
  await expect(page.getByText(/Сам находит ограничения/)).toBeVisible();
  await expect(page.getByText("Результат воспроизводим, вклад подтверждён.")).toBeVisible();
  await page.getByRole("button", { name: "Открыть кейс" }).click();
  await expect(page.getByRole("dialog", { name: "Карточка принятого вклада" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("checkbox", { name: /Резюме для HR/ }).click();
  await expect.poll(() => hrVisible).toBe(true);
  await expect(page.getByRole("checkbox", { name: /Резюме для HR/ })).toBeChecked();
});
