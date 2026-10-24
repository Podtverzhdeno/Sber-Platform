import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория"],
  csrf_token: "csrf-trajectory",
};

const checkpoint = {
  key: "foundation",
  position: 1,
  title: "Освоить основу",
  purpose: "Подготовиться к проектной практике",
  skill: "Python",
  target_kind: "course",
  target_key: "python-base",
  state: "CURRENT",
  state_label: "Текущий шаг",
  mandatory: true,
  actionable: true,
  points_available: 20,
  points_earned: 0,
  points_rule: "После проверки evidence",
  policy_version: 1,
  locked_reasons: [],
  branch: null,
};

const track = {
  track_key: "python",
  policy_version: 1,
  replacement_reason: null,
  current_key: "foundation",
  checkpoints: [checkpoint],
  progress: { completed_mandatory: 0, total_mandatory: 1, percent: 0 },
};

async function installApi(page: Page, trajectoryMethods: string[]) {
  let loggedIn = false;
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND", message: "not used" } }),
  );
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { honor_board_enabled: true, demo_mode: true } }),
  );
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    loggedIn
      ? route.fulfill({ json: actor })
      : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED", message: "login" } }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/trajectory-map", (route) => {
    trajectoryMethods.push(route.request().method());
    return route.fulfill({ json: [track] });
  });
  await page.route("**/api/v1/me/trajectory-map/checkpoints/*", (route) => {
    trajectoryMethods.push(route.request().method());
    return route.fulfill({
      json: {
        checkpoint,
        goal: checkpoint.purpose,
        outcome: "Проверяемый результат курса",
        prerequisites: [],
        evidence_refs: ["course:python-base"],
        skill_impact: {
          skill: "Python",
          current_level: "не подтверждено",
          target_level: "уверенный",
          projected_level: "базовый",
          forecast_only: true,
          explanation: "Уровень изменится только после проверки evidence.",
          missing_evidence: ["course:python-base"],
          fallback: null,
        },
        replay: false,
        policy_version: 1,
      },
    });
  });
}

test("mounted trajectory map keeps deep links, Back/reload and read-only progress", async ({ page }) => {
  const methods: string[] = [];
  await installApi(page, methods);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?classic=1");
  await expect(page.getByTestId("trajectory-map")).toBeVisible();

  const step = page.getByRole("button", { name: "Освоить основу. Текущий шаг" });
  await step.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/checkpoint=foundation/);
  await expect(page.getByTestId("trajectory-detail-title")).toHaveText("Освоить основу");
  await expect(page.getByTestId("trajectory-detail-points")).toContainText("20");
  await expect(page.getByTestId("trajectory-skill-impact")).toContainText("не подтверждено");

  await page.reload();
  await expect(page.getByTestId("trajectory-detail-title")).toHaveText("Освоить основу");
  await page.goBack();
  await expect(page).not.toHaveURL(/checkpoint=/);
  expect(methods.length).toBeGreaterThan(0);
  expect(methods.every((method) => method === "GET")).toBe(true);
});

test("trajectory map remains usable in light theme and mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("impulse-theme", "light");
  });
  await installApi(page, []);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.goto("/workspace/1?classic=1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Освоить основу. Текущий шаг" }).click();
  await expect(page.getByRole("dialog", { name: "Веха траектории" })).toBeVisible();
});
