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
  await page.route("**/api/v1/me", (route) => {
    const workspaceRoute = new URL(page.url()).pathname.startsWith("/workspace/");
    return workspaceRoute ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } });
  });
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
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", route => route.fulfill({json:{
    started_courses:1,finished_courses:1,completed_lessons:8,approved_practices:0,credited_practices:0,
    courses:[{course_key:"python-base",title:"Python: основа",completed_units:8,total_units:8,finished:true,
      finished_at:"2026-10-15T10:00:00Z",certificate_id:"cert-1",updated_at:"2026-10-15T10:00:00Z",
      practice_status:null,practical_certificate_id:null}],
  }}));
});


/** The active participant Analytics route is V3, not the retired legacy document dashboard. */
test("V3 certification displays server course certificate and public verification", async ({page})=>{
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?analyticsTab=certification");
  const analytics=page.getByTestId("analytics-v3");
  await expect(analytics).toHaveAttribute("data-tab","certification");
  await expect(page.getByRole("heading",{name:"Твоя сертификация"})).toBeVisible();
  await expect(analytics).toContainText("Python: основа");
  await expect(analytics).toContainText("cert-1");
  await expect(page.getByTestId("analytics-study-results")).toContainText("Python: основа");
  await analytics.getByRole("link",{name:/Открыть сертификат/}).click();
  await expect(page).toHaveURL(/\/verify\/ver-cert-1$/);
  await expect(page.getByRole("heading",{name:"Python: основа"})).toBeVisible();
});
test("V3 mobile personal learning progress and tab links remain navigable",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?analyticsTab=certification");
  const panel=page.getByTestId("analytics-v3");
  await expect(panel).toHaveAttribute("data-tab","certification");
  await expect(page.getByTestId("analytics-study-results")).toContainText("Python: основа");
  const tabs=panel.getByRole("navigation",{name:"Подразделы аналитики"});
  await tabs.getByRole("button",{name:"Активность"}).click();
  await expect(panel).toHaveAttribute("data-tab","activity");
  await tabs.getByRole("button",{name:"Сертификация"}).click();
  await expect(page).toHaveURL(/analyticsTab=certification/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
for(const viewport of [{name:"desktop-dark",width:1440,height:900},{name:"mobile-dark",width:390,height:844}] as const){
  test(`V3 analytics ${viewport.name}: activity evidence, certification and visual capture`,async({page},testInfo)=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.emulateMedia({colorScheme:"dark"});
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    await page.goto("/workspace/5");
    const panel=page.getByTestId("analytics-v3");
    await expect(panel).toHaveAttribute("data-tab","activity");
    await expect(page.getByRole("heading",{name:"Твоя активность"})).toBeVisible();
    const period=panel.getByRole("combobox",{name:"Период аналитики"});
    await period.selectOption("12");
    await expect(period).toHaveValue("12");
    await panel.getByRole("navigation",{name:"Подразделы аналитики"}).getByRole("button",{name:"Сертификация"}).click();
    await expect(panel).toHaveAttribute("data-tab","certification");
    await expect(panel).toContainText("Отдельно от подтверждения профессиональных компетенций");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    const png=await page.screenshot({path:testInfo.outputPath(`analytics-v3-${viewport.name}.png`),fullPage:true,animations:"disabled"});
    await testInfo.attach(`analytics-v3-${viewport.name}`,{body:png,contentType:"image/png"});
  });
}
