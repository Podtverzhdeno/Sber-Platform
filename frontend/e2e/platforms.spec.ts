import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const taskId = "00000000-0000-0000-0000-000000000701";
const assignmentId = "00000000-0000-0000-0000-000000000702";
const participantId = "00000000-0000-0000-0000-000000000001";
const connectionId = "00000000-0000-0000-0000-000000000703";
const actor = {
  person_id: participantId,
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: [
    "Главная",
    "Мой путь",
    "Bootcamp",
    "Задачи",
    "Мои проекты",
    "События",
    "Рейтинг",
    "Портфолио",
    "Аналитика",
  ],
  csrf_token: "csrf-platforms",
};
const task = { id: taskId, title: "Проект с рабочими платформами", status: "published", places: 1 };
const compensation = { paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1.5", a_multiplier: "2.0", b_total: null, a_total: null, quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "После приёмки" };
const terms = { version: 1, deadline_at: "2026-11-01T18:00:00Z", deliverable: "Подготовить репозиторий и демонстрацию.", acceptance_criteria: ["Результат воспроизводим"], support_mode: "mentor", compensation };

async function mockApi(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill(loggedIn ? { json: actor } : { status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 0, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [{ assignment: { id: assignmentId, task_id: taskId, person_id: participantId, application_id: "00000000-0000-0000-0000-000000000704", status: "in_progress" }, task, terms, allowed_artifacts: [], contributions: [], decisions: [] }] }));
  await page.route(`**/api/v1/me/tasks/${taskId}`, (route) => route.fulfill({ json: { task, problem: "Нужна интеграция инструментов.", deliverable: terms.deliverable, acceptance_criteria: terms.acceptance_criteria, deadline_at: terms.deadline_at, data_constraints: "—", ip_terms: "—", terms, terms_history: [], accepted_terms_version: 1, invitation_status: null, customer: { id: "00000000-0000-0000-0000-000000000705", display_name: "Роман" }, mentor: null, support: null, team: [], membership: { id: assignmentId, task_id: taskId, person_id: participantId, status: "in_progress" }, checkpoints: [], personal: [], feedback: [], applications: [] } }));
  await page.route("**/api/v1/me/assignments/*/deadline-requests", (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/v1/projects/${taskId}/platforms`, (route) => route.fulfill({ json: { items: [
    { provider_key: "gigacode", title: "GigaCode", purpose: "ИИ-разработка", required_permissions: ["repo:read"], repository_label: "Репозиторий", connection: null },
    { provider_key: "gitverse", title: "GitVerse", purpose: "Репозиторий проекта", required_permissions: ["repo:read"], repository_label: "Репозиторий", connection: { id: connectionId, provider_key: "gitverse", workspace_ref: "impulse/demo", scopes: ["repo:read"], status: "connected", last_sync_at: null, last_error: null } },
  ] } }));
  await page.route(`**/api/v1/projects/${taskId}/platforms/connections/${connectionId}/deep-link`, (route) => route.fulfill({ json: { url: "https://gitverse.ru/impulse/demo" } }));
}

test("project workspace exposes a collapsible platform catalog and safe deep link", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto(`/workspace/4?project=${assignmentId}`);

  const toggle = page.getByRole("button", { name: /Инструменты проекта/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("platform-card-gigacode")).toBeVisible();
  await expect(page.getByTestId("platform-status-gitverse")).toHaveText("Подключено");
  await page.getByTestId("platform-open-gitverse").click();
  await expect(page.getByTestId("platform-link-gitverse")).toHaveAttribute("href", "https://gitverse.ru/impulse/demo");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("platform-card-gigacode")).not.toBeVisible();
});
