import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"],
  csrf_token: "csrf",
};

const certificate = {
  certificate_id: "cert-1",
  course_key: "python-base",
  course_title: "Python: основа",
  holder_name: "Алекс Речной",
  issued_at: "2026-10-15T10:00:00Z",
  period: "Сезон 2026",
  preview_marking: "демо",
  program_version: 3,
  result: "91%",
  specialization: "Python-разработчик",
  verification_id: "ver-cert-1",
  workload_hours: 42,
  competencies: [{ competency: "Python", evidence: "итоговый тест 91%", level: "уверенный" }],
};

const projectCredential = {
  artifact_keys: ["benchmark-report"],
  competencies: [{ competency: "Качество решения", evidence_refs: ["ref-1"], finding: "benchmark принят", level: "уверенный" }],
  contribution_version: 2,
  credential_id: "cred-1",
  customer_name: "СБЕР",
  grade_label: "B",
  holder_name: "Алекс Речной",
  payment_status: "paid",
  period: "Сезон 2026",
  personal_summary: "Воспроизводимый benchmark",
  project_key: "python-base",
  review_explanation: "Метод повторён и подтверждён",
  signed_at: "2026-10-16T10:00:00Z",
  status: "verified",
  superseded_by: null,
  task_key: "task-benchmark",
  task_title: "Проверка прототипа на данных",
  verification_id: "ver-proj-1",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/analytics/journey", (route) => route.fulfill({ json: { stages: [], successful: true, next_action: "Продолжить работу над проектом", earnings: { calculated: "0", approved: "0", paid: "0", failed: "0", currency: "RUB", unknown_items: 0 }, freshness: "fresh", generated_at: "2026-10-20T10:00:00Z" } }));
  await page.route("**/api/v1/me/growth/snapshot", (route) => route.fulfill({
    json: {
      snapshot_id: "growth-snapshot-e2e-analytics",
      generated_at: "2026-10-20T09:00:00+03:00",
      snapshot_version: 2,
      actor_timezone: "Europe/Moscow",
      definitions: {},
      period_boundaries: { day: {} },
      activity: { day: { total: 0, course_checkpoint: 0, project_submission: 0, revision_accepted: 0, event_participation: 0 } },
      activity_state: {},
      events: [],
      hours: { known: true, trusted_minutes: 0, self_reported_minutes: 0, intervals: [] },
      freshness: { known: true, latest_observed_at: "2026-10-20T09:00:00+03:00" },
      trajectories: [
        { track_key: "python", track_title: "Python-разработчик", policy_version: 1, milestones: [], completion: { percent: null, coverage: 1, partial: false }, readiness_skills: [], readiness: { percent: null, coverage: 0, partial: true }, object_refs: [], next_step_ref: null },
      ],
    },
  }));
  await page.route("**/api/v1/me/bootcamp/certificates", (route) => route.fulfill({ json: [certificate] }));
  await page.route("**/api/v1/bootcamp/certificates/**", (route) => route.fulfill({ json: certificate }));
  await page.route("**/api/v1/project-credentials/**", (route) => route.fulfill({ json: projectCredential }));
  await page.route("**/api/v1/me/project-credentials", (route) => route.fulfill({ json: [projectCredential] }));
  await page.route("**/api/v1/competency-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [] }));
});

test("documents panel reveals verification and lands exactly on certificate, project and task checkpoints", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?legacy=1");

  const documents = page.getByTestId("document-item");
  await expect(documents.filter({ hasText: "Python: основа" })).toBeVisible();
  await expect(documents.filter({ hasText: "Проверка прототипа на данных" })).toBeVisible();

  await documents.filter({ hasText: "Python: основа" }).getByRole("button", { name: "Проверить" }).click();
  const certificateViewer = page.getByTestId("document-viewer").first();
  await expect(certificateViewer).toContainText("ver-cert-1");
  await certificateViewer.getByRole("link", { name: "Открыть публичную проверку сертификата" }).click();
  await expect(page).toHaveURL(/\/verify\/ver-cert-1$/);
  await expect(page.getByRole("heading", { name: "Python: основа" })).toBeVisible();
  await expect(page.getByText(/демо · не является официальным сертификатом/)).toBeVisible();

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?legacy=1");
  await documents.filter({ hasText: "Проверка прототипа на данных" }).getByRole("button", { name: "Проверить" }).click();
  const projectViewer = page.getByTestId("document-viewer").first();
  await projectViewer.getByRole("link", { name: "Открыть публичную проверку проектного credential" }).click();
  await expect(page).toHaveURL(/\/verify\/projects\/ver-proj-1$/);

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?legacy=1");
  await page.getByRole("button", { name: /До следующего уровня/ }).click();
  const firstPlanStep = page.getByTestId("plan-step-0");
  await expect(firstPlanStep).toHaveAttribute("href", "/workspace/2");
  await firstPlanStep.click();
  await expect(page).toHaveURL(/\/workspace\/2$/);
});

test("mobile layout in light theme keeps verification and plan deep links exact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/me/theme", (route) => route.fulfill({ json: actor }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  const themeToggle = page.locator(".theme-toggle");
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "false");

  const openAnalytics = async (): Promise<void> => {
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    await expect(page.getByRole("button", { name: "Меню", exact: true })).toHaveAttribute("aria-expanded", "true");
    await page.goto("/workspace/5?legacy=1");
  };

  await openAnalytics();
  const documents = page.getByTestId("document-item");
  await expect(documents.filter({ hasText: "Проверка прототипа на данных" })).toBeVisible();
  await documents.filter({ hasText: "Проверка прототипа на данных" }).getByRole("button", { name: "Проверить" }).click();
  const projectViewer = page.getByTestId("document-viewer").first();
  await projectViewer.getByRole("link", { name: "Открыть публичную проверку проектного credential" }).click();
  await expect(page).toHaveURL(/\/verify\/projects\/ver-proj-1$/);
  await expect(page.getByRole("heading", { name: "Проверка прототипа на данных" })).toBeVisible();

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await openAnalytics();
  await page.getByRole("button", { name: /До следующего уровня/ }).click();
  const lastPlanStep = page.getByTestId("plan-step-2");
  await expect(lastPlanStep).toHaveAttribute("href", "/workspace/2");
  await lastPlanStep.click();
  await expect(page).toHaveURL(/\/workspace\/2$/);
});




/**
 * Candidate screenshot evidence only: the approved Analytics PNG/HTML are not
 * available in the repository. These captures never establish pixel parity.
 */
for (const viewport of [
  { name: "desktop-dark", width: 1440, height: 900 },
  { name: "mobile-dark", width: 390, height: 844 },
] as const) {
  test(`analytics visual audit: ${viewport.name} layout, chart, long plan links and candidate screenshot`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 700) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.goto("/workspace/5?legacy=1");

    await expect(page.getByRole("heading", { name: "Моя аналитика" })).toBeVisible();
    const profile = page.getByTestId("agentic-profile");
    const chart = page.locator(".agentic-profile-chart");
    const certification = page.locator(".agentic-certification");
    await expect(profile).toBeVisible();
    await expect(chart).toBeVisible();
    await expect(certification).toBeVisible();
    await expect(page.locator(".activity-chart-panel svg")).toBeVisible();
    await expect(page.getByText(/Нет проверяемой истории событий/)).toBeVisible();

    const chartRect = await chart.boundingBox();
    const certificationRect = await certification.boundingBox();
    expect(chartRect).not.toBeNull();
    expect(certificationRect).not.toBeNull();
    if (chartRect && certificationRect) {
      if (viewport.width >= 1080) {
        expect(certificationRect.x).toBeGreaterThan(chartRect.x + chartRect.width - 5);
        expect(Math.abs(chartRect.y - certificationRect.y)).toBeLessThan(8);
      } else {
        expect(certificationRect.y).toBeGreaterThan(chartRect.y + chartRect.height - 5);
      }
    }

    await page.getByRole("button", { name: /До следующего уровня/ }).click();
    const firstPlanLink = page.getByTestId("plan-step-0");
    await expect(firstPlanLink).toBeVisible();
    const planStyles = await firstPlanLink.evaluate((link) => {
      const styles = window.getComputedStyle(link);
      return { width: link.getBoundingClientRect().width, display: styles.display, fontSize: Number.parseFloat(styles.fontSize) };
    });
    expect(planStyles.width).toBeGreaterThan(100);
    expect(planStyles.fontSize).toBeGreaterThanOrEqual(11);
    expect(planStyles.display).not.toBe("inline");

    const htmlOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(htmlOverflow).toBeLessThanOrEqual(2);
    await page.evaluate(async () => { await document.fonts.ready; });
    const screenshot = await page.screenshot({ path: testInfo.outputPath(`analytics-candidate-${viewport.name}.png`), animations: "disabled", fullPage: true });
    await testInfo.attach(`analytics-candidate-${viewport.name}`, { body: screenshot, contentType: "image/png" });
  });
}
