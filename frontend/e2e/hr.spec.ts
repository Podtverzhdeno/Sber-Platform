import { expect, test } from "@playwright/test";

test("HR stages appear only after explicit human actions", async ({ page }) => {
  const candidateId = "00000000-0000-0000-0000-000000000010";
  const events: { id: string; candidate_id: string; candidate_name: string; stage: string; note: string; occurred_at: string; origin: string }[] = [];
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "hr-nina", display_name: "Нина HR", roles: ["hr"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "00000000-0000-0000-0000-000000000020", display_name: "Нина HR", active_role: "hr", assigned_roles: ["hr"], scopes: ["talent-pipeline:write"], consent_scopes: [], navigation: ["Кандидаты", "Воронка", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/hr/candidates", (route) => route.fulfill({ json: [{ person_id: candidateId, display_name: "Алекс Речной", accepted_projects: 2, verified_courses: 1, top_grade: "A" }] }));
  await page.route(`**/api/v1/hr/candidates/${candidateId}`, (route) => route.fulfill({ json: { person_id: candidateId, display_name: "Алекс Речной", contributions: [{ contribution_id: "c1", project_title: "R&D прототип", personal_summary: "Собрал проверяемый MVP", artifact_keys: ["repo"], grade: "A", review_reason: "Результат превысил критерии" }], courses: [] } }));
  await page.route("**/api/v1/hr/pipeline", (route) => route.fulfill({ json: { counts: { invitation: events.filter((item) => item.stage === "invitation").length, interview: events.filter((item) => item.stage === "interview").length, offer: events.filter((item) => item.stage === "offer").length, hire: events.filter((item) => item.stage === "hire").length }, events } }));
  await page.route(`**/api/v1/hr/candidates/${candidateId}/pipeline-events`, async (route) => {
    const body = route.request().postDataJSON() as { stage: string; note: string };
    const event = { id: String(events.length + 1), candidate_id: candidateId, candidate_name: "Алекс Речной", stage: body.stage, note: body.note, occurred_at: new Date().toISOString(), origin: "human" };
    events.push(event);
    await route.fulfill({ json: event });
  });
  await page.goto("/");
  await page.locator('[data-persona="hr-nina"]').click();
  await expect(page.getByRole("heading", { name: "Кандидаты и evidence-first резюме" })).toBeVisible();
  await expect(page.getByText("R&D прототип")).toBeVisible();
  await expect(page.getByRole("button", { name: "Приглашение →" })).toBeVisible();
  await page.getByRole("button", { name: "Приглашение →" }).click();
  await expect(page.getByRole("button", { name: "Интервью →" })).toBeVisible();
  await expect(page.getByText("Оффер").locator("..").getByText("0", { exact: true })).toBeVisible();
});
