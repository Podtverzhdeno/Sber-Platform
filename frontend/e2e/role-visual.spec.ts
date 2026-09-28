import { expect, test } from "@playwright/test";

type VisualPersona = {
  key: string;
  displayName: string;
  role: "mentor" | "manager" | "operator";
  navigation: string[];
  reference: string;
  heading: string;
};

const personas: VisualPersona[] = [
  { key: "mentor-elena", displayName: "Елена Наставник", role: "mentor", navigation: ["Очередь ревью", "Назначения", "Аналитика"], reference: "R-MEN-02", heading: "Проверка вкладов" },
  { key: "manager-olga", displayName: "Ольга Руководитель", role: "manager", navigation: ["Инициативы", "Результаты", "Аналитика"], reference: "R-MGR-02", heading: "Результаты команд без лишних персональных данных" },
  { key: "operator-pavel", displayName: "Павел Оператор", role: "operator", navigation: ["Операционная очередь", "Проверки", "Споры", "Аналитика"], reference: "R-OPS-02", heading: "Дела, источники и зависимости" },
];

for (const persona of personas) {
  test(`${persona.reference} visual contract`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: persona.key, display_name: persona.displayName, roles: [persona.role] }] }));
    await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
    await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: `visual-${persona.role}`, display_name: persona.displayName, active_role: persona.role, assigned_roles: [persona.role], scopes: [], consent_scopes: [], navigation: persona.navigation, csrf_token: "visual-csrf" } }));
    await page.route("**/api/v1/mentor/review-queue", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/manager/overview", (route) => route.fulfill({ json: { initiatives: [], task_count: 0, accepted_result_count: 0, reused_result_count: 0 } }));
    await page.route("**/api/v1/ops/cases", (route) => route.fulfill({ json: [] }));

    await page.goto("/");
    await page.locator(`[data-persona="${persona.key}"]`).click();
    await expect(page.getByRole("heading", { name: persona.heading })).toBeVisible();
    await expect(page.locator(".demo-data-chip")).toBeVisible();
    await expect(page).toHaveScreenshot(`${persona.reference.toLowerCase()}-desktop.png`, {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
