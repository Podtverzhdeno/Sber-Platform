import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

const roleLevel = {
  track_key: "python",
  level: 0,
  cycle_number: 1,
  curriculum_state: "published",
  completed_courses: 0,
  required_courses: 2,
  approved_practices: 0,
  credited_practices: 0,
  required_practices: 1,
  advance_ready: false,
  policy_version: 2,
  max_level: 3,
  history: [],
  required_course_keys: ["demo-course-3", "demo-course-10"],
};

for (const width of [1440, 390]) {
  test(`home grade lists authoritative courses and links to the correct Bootcamp course at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installBootcampReferenceApi(page);
    await page.route(/\/api\/v1\/me\/bootcamp\/impulse-level(?:\?.*)?$/, (route) =>
      route.fulfill({ json: roleLevel }),
    );
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    const grade = page.getByTestId("grade-summary");
    await expect(grade).toHaveAttribute("data-grade-state", "impulse-known");
    await grade.locator(".home-v2-next-grade").click();
    const drawer = page.getByRole("dialog", { name: "Требования следующего грейда" });
    const courses = drawer.getByTestId("home-grade-required-courses");
    await expect(courses).toContainText("Python: основа");
    await expect(courses).toContainText("Безопасность данных");
    await expect(courses.getByRole("button", { name: "Пройти курс «Python: основа»" })).toBeVisible();
    await courses.getByRole("button", { name: "Пройти курс «Python: основа»" }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page).toHaveURL(/\/workspace\/2\?/);
    await expect(page).toHaveURL(/course=demo-course-3/);
    await expect(page).toHaveURL(/role=python/);
    await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
  });
}
