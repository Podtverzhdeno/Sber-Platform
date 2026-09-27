import { expect, test } from "@playwright/test";

const reviewId = "00000000-0000-0000-0000-000000000901";

test("mentor sees AI draft separately and publishes only through human steps", async ({ page }) => {
  let status = "draft";
  let version = 1;
  const review = () => ({
    id: reviewId,
    contribution_id: "00000000-0000-0000-0000-000000000902",
    contribution_version: 2,
    rubric_id: "00000000-0000-0000-0000-000000000903",
    rubric_version: 1,
    version,
    grade: "B",
    assessments: [{ criterion_key: "result", finding: "MVP принят заказчиком.", evidence_refs: ["artifact:mvp"] }],
    explanation: "Оценка B основана на принятом результате и личном вкладе.",
    status,
    draft_origin: "ai_suggestion",
    confirmed_by: status === "human_confirmed" || status === "published" ? "00000000-0000-0000-0000-000000000904" : null,
    published_by: status === "published" ? "00000000-0000-0000-0000-000000000904" : null,
  });
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "mentor-elena", display_name: "Елена Наставник", roles: ["mentor"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "00000000-0000-0000-0000-000000000904", display_name: "Елена Наставник", active_role: "mentor", assigned_roles: ["mentor"], scopes: [], consent_scopes: [], navigation: ["Очередь ревью", "Назначения", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/mentor/review-queue", (route) => route.fulfill({ json: [{ review: review(), payout: null, task_title: "MVP рекомендательной системы", deadline_at: "2026-10-20T18:00:00Z", personal_summary: "Реализовал ранжирование и воспроизводимые тесты.", artifact_keys: ["artifact:mvp"], contribution_accepted: true, authorship_conflict_open: false }] }));
  await page.route("**/api/v1/mentor/reviews/*/*", async (route) => {
    const action = route.request().url().split("/").at(-1);
    status = action === "propose" ? "proposed" : action === "confirm" ? "human_confirmed" : "published";
    version += 1;
    await route.fulfill({ json: review() });
  });

  await page.goto("/");
  await page.locator('[data-persona="mentor-elena"]').click();

  await expect(page.getByLabel("Черновик AI")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MVP рекомендательной системы" })).toBeVisible();
  await expect(page.getByText("Реализовал ранжирование и воспроизводимые тесты.")).toBeVisible();
  await expect(page.getByLabel("Финальное решение человека")).toContainText("ещё не опубликована");
  await page.getByRole("button", { name: "Передать на подтверждение" }).click();
  await page.getByRole("button", { name: "Подтвердить человеком" }).click();
  await page.getByRole("button", { name: "Опубликовать оценку" }).click();
  await expect(page.getByLabel("Финальное решение человека")).toContainText("подписал 00000000");
  await expect(page.getByText("Опубликовано")).toBeVisible();
});
