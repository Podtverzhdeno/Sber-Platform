import { expect, test } from "@playwright/test";

const runtimeMocks = (page: import("@playwright/test").Page) => {
  void page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: false } }));
  void page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
};

test("public course certificate verify page shows facts and competency matrix", async ({ page }) => {
  runtimeMocks(page);
  await page.route("**/api/v1/bootcamp/certificates/*", (route) => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
  await page.route("**/api/v1/bootcamp/certificates/COURSE-OS-2026-0142", (route) => route.fulfill({ json: {
    certificate_id: "2f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    verification_id: "COURSE-OS-2026-0142",
    person_id: "3f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    holder_name: "Алекс Речной",
    course_key: "openspec-sdd",
    course_title: "OpenSpec и SDD",
    specialization: "Python / Data / Product / ML",
    program_version: "1.0.0",
    period: "10.2026",
    workload_hours: 24,
    result: "Демонстрационный курс пройден по контрольным точкам.",
    competencies: [
      { competency: "Спецификация и документация", level: "базовый", evidence: "OpenSpec-задание курса" },
      { competency: "Ведение проекта по SDD", level: "базовый", evidence: "Практическое задание курса" },
    ],
    preview_marking: "Демонстрационный образец",
  } }));
  await page.goto("/verify/COURSE-OS-2026-0142");
  await expect(page.getByRole("heading", { name: "OpenSpec и SDD" })).toBeVisible();
  await expect(page.getByText("Алекс Речной")).toBeVisible();
  await expect(page.getByText("Спецификация и документация")).toBeVisible();
  await expect(page.getByText("Ведение проекта по SDD")).toBeVisible();
  await expect(page.getByText(/Демонстрационный образец · не является официальным сертификатом/)).toBeVisible();
});

test("public project credential verify page shows signed facts and matrix", async ({ page }) => {
  runtimeMocks(page);
  await page.route("**/api/v1/project-credentials/*", (route) => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
  await page.route("**/api/v1/project-credentials/proj-a1b2c3d4e5f6", (route) => route.fulfill({ json: {
    credential_id: "1f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    verification_id: "proj-a1b2c3d4e5f6",
    contribution_id: "9f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    contribution_version: 2,
    person_id: "3f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    holder_name: "Алекс Речной",
    customer_id: "7f2a93a7-7d3d-5dd1-a7ba-b9cd3a3b29ef",
    customer_name: "Роман Заказчик",
    task_key: "semantic-search-rd",
    task_title: "Семантический поиск для программ",
    project_key: "demo-rd-lab",
    period: "17.10.2026",
    personal_summary: "Реализовал API поиска и добавил замер offline-метрики.",
    artifact_keys: ["personal-api-proof"],
    grade_label: "Оценка A · соответствует 5+",
    review_explanation: "Результат выше критериев, подтверждён примерами.",
    competencies: [
      { competency: "result", level: "уверенный", evidence_refs: ["artifact:result"], finding: "Метрика подтверждена." },
      { competency: "evidence", level: "базовый", evidence_refs: ["artifact:evidence"], finding: "Основания зафиксированы." },
    ],
    payment_status: "Оплачено",
    signed_at: "2026-10-17T18:21:44.108146Z",
    status: "valid",
    superseded_by: null,
  } }));
  await page.goto("/verify/projects/proj-a1b2c3d4e5f6");
  await expect(page.getByRole("heading", { name: "Семантический поиск для программ" })).toBeVisible();
  await expect(page.getByText("Роман Заказчик")).toBeVisible();
  await expect(page.getByText("Оценка A · соответствует 5+")).toBeVisible();
  await expect(page.getByText("Матрица компетенций")).toBeVisible();
  await expect(page.getByText("artifact:result")).toBeVisible();
  await expect(page.getByText("Демонстрационное подтверждение · не является официальным сертификатом")).toBeVisible();
});

test("unknown verification id renders restricted state", async ({ page }) => {
  runtimeMocks(page);
  await page.route("**/api/v1/project-credentials/*", (route) => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
  await page.route("**/api/v1/bootcamp/certificates/*", (route) => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
  await page.goto("/verify/projects/proj-unknown");
  await expect(page.getByText("Проектный документ не найден или владелец закрыл публичную проверку.")).toBeVisible();
  await expect(page.getByRole("button", { name: "На главную" })).toBeVisible();
});
