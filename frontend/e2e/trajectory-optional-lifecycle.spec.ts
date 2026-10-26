import { expect, test } from "@playwright/test";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

test("grey role: preview → optional study → role-scoped course → grey → restore without changing primary", async ({ page }) => {
  await page.setViewportSize({ width: 1550, height: 920 });
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Алекс Речной", active_role: "participant",
    assigned_roles: ["participant"], scopes: [], consent_scopes: [],
    navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
    csrf_token: "csrf-preview",
  };
  let loggedIn = false;
  let optionalState: "unselected" | "learning" = "unselected";
  let completedMilestones = 2;
  const tracked: Array<{ track_key: string; enabled: boolean }> = [];
  const roles = () => [
    { track_key: "python", title: "AI Security Engineer", state: "active", attempt_number: 1, completed_milestones: 1, total_milestones: 2 },
    { track_key: "product", title: "AI Architect", state: optionalState, attempt_number: optionalState === "learning" ? 1 : null,
      completed_milestones: optionalState === "learning" ? completedMilestones : 0, total_milestones: 2 },
  ];
  const stages = [
    { key: "product-intro", position: 1, title: "Введение в AI Architect", purpose: "Учебная программа",
      skill: "AI systems", target_kind: "course", target_key: "demo-course-1", completed: false, activities: [],
      deliverable: null, lab: null, estimated_hours: 1 },
    { key: "product-project", position: 2, title: "Практика AI Architect", purpose: "Учебный проект",
      skill: "AI systems", target_kind: "task", target_key: "demo-task-1", completed: false, activities: [],
      deliverable: null, lab: null, estimated_hours: 1 },
  ];
  const catalogue = [{
    track_key: "product", policy_version: 1, replacement_reason: null,
    milestones: stages, next_step: stages[0],
  }];
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [
    { key: "participant-alex", display_name: actor.display_name, roles: ["participant"] },
  ] }));
  await page.route(/\/api\/v1\/me$/, route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", route =>
    route.fulfill({ json: { ...overviewFixture, roles: roles(),
      next_outcome: { ...overviewFixture.next_outcome, trajectory_key: "python", trajectory_title: "AI Security Engineer",
        milestone_key: "security-intro", target_title: "Только основной путь" },
    } }));
  await page.route("**/api/v1/me/roadmap-catalog", route => route.fulfill({ json: catalogue }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: catalogue }));
  await page.route("**/api/v1/me/tracks/optional", async route => {
    const body = route.request().postDataJSON() as { track_key: string; enabled: boolean };
    tracked.push(body);
    if (body.track_key !== "product") return route.fulfill({ status: 409, json: { code: "WRONG_TRACK" } });
    optionalState = body.enabled ? "learning" : "unselected";
    return route.fulfill({ json: { tracks: [] } });
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?role=product");
  const primary = page.locator('.trajectory-v2-role-card[data-role-key="python"]');
  const optional = page.locator('.trajectory-v2-role-card[data-role-key="product"]');
  await expect(primary).toHaveAttribute("data-tone", "primary");
  await expect(optional).toHaveAttribute("data-tone", "unselected");
  await expect(page.getByRole("button", { name: "Изучать дополнительно →" })).toBeVisible();
  await expect(page.locator(".trajectory-v2-next-panel")).not.toContainText("Только основной путь");

  await page.getByRole("button", { name: "Изучать дополнительно →" }).click();
  await expect(optional).toHaveAttribute("data-tone", "learning");
  await expect(primary).toHaveAttribute("data-tone", "primary");
  await expect(page.locator(".trajectory-v2-next-panel")).toContainText("Введение в AI Architect");
  await expect(page.locator(".trajectory-v2-next-panel")).not.toContainText("Только основной путь");

  await page.locator(".trajectory-v2-stage-path button").first().click();
  const drawer = page.getByRole("dialog", { name: /Введение в AI Architect/ });
  await expect(drawer.getByRole("button", { name: "Открыть курс" })).toBeVisible();
  await drawer.getByRole("button", { name: "Открыть курс" }).click();
  await expect(page).toHaveURL(/\/workspace\/2\?course=demo-course-1&role=product/);

  await page.goto("/workspace/1?role=product");
  await page.getByRole("button", { name: "Сделать карточку серой" }).click();
  await expect(optional).toHaveAttribute("data-tone", "unselected");
  await expect(primary).toHaveAttribute("data-tone", "primary");
  await page.getByRole("button", { name: "Изучать дополнительно →" }).click();
  await expect(optional).toHaveAttribute("data-tone", "learning");
  await expect(primary).toHaveAttribute("data-tone", "primary");
  expect(tracked).toEqual([
    { track_key: "product", enabled: true },
    { track_key: "product", enabled: false },
    { track_key: "product", enabled: true },
  ]);
  expect(completedMilestones).toBe(2);
});
