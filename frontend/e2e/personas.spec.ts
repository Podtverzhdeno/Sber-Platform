import { expect, test } from "@playwright/test";

const personas = [
  ["participant-alex", "Алекс Речной", "participant", ["Главная", "Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"]],
  ["mentor-elena", "Елена Наставник", "mentor", ["Главная", "Очередь ревью", "Назначения", "Аналитика"]],
  ["customer-roman", "Роман Заказчик", "customer", ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика"]],
  ["manager-olga", "Ольга Руководитель", "manager", ["Главная", "Инициативы", "Результаты", "Аналитика"]],
  ["hr-nina", "Нина HR", "hr", ["Главная", "Кандидаты", "Воронка", "Аналитика"]],
  ["operator-pavel", "Павел Оператор", "operator", ["Главная", "Операционная очередь", "Проверки", "Споры", "Аналитика"]],
] as const;

test.beforeEach(async ({ page }) => {
  let authenticatedActor: Record<string, unknown> | null = null;
  await page.route("**/api/v1/config", async (route) => {
    await route.fulfill({ json: { honor_board_enabled: false } });
  });
  await page.route("**/api/v1/auth/personas", async (route) => {
    await route.fulfill({
      json: [...personas.map(([key, display_name, role]) => ({
        key,
        display_name,
        roles: key === "manager-olga" ? ["manager", "customer"] : [role],
      })), { key: "participant-second", display_name: "Второй участник", roles: ["participant"] }],
    });
  });
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill(authenticatedActor
      ? { json: authenticatedActor }
      : { status: 401, json: { code: "AUTH_REQUIRED" } });
  });
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    const body = route.request().postDataJSON() as { persona_key: string };
    const persona = personas.find(([key]) => key === body.persona_key);
    if (!persona) {
      await route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } });
      return;
    }
    const [key, display_name, role, navigation] = persona;
    authenticatedActor = {
        person_id: "00000000-0000-0000-0000-000000000001",
        display_name,
        active_role: role,
        assigned_roles: key === "manager-olga" ? ["manager", "customer"] : [role],
        scopes: [],
        consent_scopes: [],
        navigation,
        csrf_token: "csrf-token",
      };
    await route.fulfill({ json: authenticatedActor });
  });
  await page.route("**/api/v1/development/tracks", async (route) => {
    await route.fulfill({
      json: {
        active_count: 1,
        max_active: 2,
        tracks: [
          {
            key: "python",
            title: "Python-разработчик",
            status: "active",
            completed_milestones: [],
          },
        ],
      },
    });
  });
  await page.route("**/api/v1/me/roadmaps", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/mentor/review-queue", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/customer/tasks", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/manager/overview", async (route) => {
    await route.fulfill({ json: { initiatives: [], task_count: 0, accepted_result_count: 0, reused_result_count: 0 } });
  });
  await page.route("**/api/v1/hr/candidates", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/hr/pipeline", async (route) => {
    await route.fulfill({ json: { counts: { invitation: 0, interview: 0, offer: 0, hire: 0 }, events: [] } });
  });
  await page.route("**/api/v1/ops/cases", async (route) => {
    await route.fulfill({ json: [] });
  });
});

test("picker shows one persona per role and disables secondary demo roles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".persona-card")).toHaveCount(6);
  await expect(page.locator('[data-persona="participant-second"]')).toHaveCount(0);
  await expect(page.locator('[data-persona="participant-alex"]')).toBeEnabled();
  await expect(page.locator('[data-persona="customer-roman"]')).toBeEnabled();
  for (const key of ["mentor-elena", "manager-olga", "hr-nina", "operator-pavel"]) {
    await expect(page.locator(`[data-persona="${key}"]`)).toBeDisabled();
  }
});

for (const [key, displayName, , navigation] of personas.filter(
  ([personaKey]) => personaKey === "participant-alex" || personaKey === "customer-roman",
)) {
  test("persona " + key + " can navigate only server-authorized sections via grouped menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator('[data-persona="' + key + '"]').click();
    await expect(page).toHaveURL(/\/workspace\/0(?:[?#]|$)/);

    // The minimal shell uses grouped navigation. Old welcome headings are removed.
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await expect(page.locator(".owner-profile-identity strong")).toHaveText(displayName);
    await page.getByRole("button", { name: "Меню профиля" }).click();

    const mobileMenu = page.getByRole("button", { name: "Меню", exact: true });
    await mobileMenu.click();
    const navigationTree = page.getByRole("navigation", { name: "Навигация роли" });
    await expect(navigationTree).toBeVisible();

    // Do not allow UI grouping to grant extra routes or rewrite server-side indices.
    const allLinks = navigationTree.locator('a[href^="/workspace/"]');
    await expect(allLinks).toHaveCount(navigation.length);
    const actualLabels = (await allLinks.allTextContents()).map((label) => label.trim()).sort();
    expect(actualLabels).toEqual([...navigation].sort());

    for (const [index, label] of navigation.entries()) {
      if (index > 0) await mobileMenu.click();
      const link = navigationTree.locator('a[href="/workspace/' + String(index) + '"]');
      await expect(link).toHaveCount(1);
      if (!(await link.isVisible())) {
        const groupToggle = link.locator("xpath=ancestor::ul[1]/preceding-sibling::button");
        await expect(groupToggle).toHaveAttribute("aria-expanded", "false");
        await groupToggle.click();
        await expect(groupToggle).toHaveAttribute("aria-expanded", "true");
      }
      await expect(link).toHaveAccessibleName(label);
      await link.click();
      await expect(page).toHaveURL(new RegExp("/workspace/" + String(index) + "(?:[?#]|$)"));
      await expect(mobileMenu).toHaveAttribute("aria-expanded", "false");
    }
  });
}
