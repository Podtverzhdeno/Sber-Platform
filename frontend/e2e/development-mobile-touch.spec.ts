import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

type VisualMode = "blue" | "midnight" | "light";

async function openDevelopment(page: Page, mode: VisualMode): Promise<void> {
  await page.addInitScript((selected: VisualMode) => {
    localStorage.setItem("impulse-visual-mode", selected);
    localStorage.setItem("impulse-theme", selected === "light" ? "light" : "dark");
  }, mode);
  await installBootcampReferenceApi(page);
  // The exact published requirements and learning record are source-shaped,
  // deterministic test fixtures, never fabricated production progress.
  await page.route("**/api/v1/me/bootcamp/impulse-level**", route =>
    route.fulfill({ json: {
      track_key: "python", level: 0, max_level: 3,
      cycle_number: 1, curriculum_state: "published",
      completed_courses: 1, required_courses: 2,
      credited_practices: 1, approved_practices: 0, required_practices: 2,
      required_course_keys: ["python-base", "rag-mvp"],
      advance_ready: false, history: [], policy_version: 1,
    } }));
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", route =>
    route.fulfill({ json: {
      started_courses: 2, finished_courses: 1, completed_lessons: 11,
      approved_practices: 0, credited_practices: 1,
      courses: [
        {
          course_key: "python-base", title: "Основы Python",
          completed_units: 8, total_units: 8, finished: true,
          finished_at: "2026-11-10T10:00:00Z", certificate_id: "CERT-PY",
          updated_at: "2026-11-10T10:00:00Z",
          practice_status: "approved", practical_certificate_id: null,
        },
        {
          course_key: "rag-mvp", title: "Надёжный RAG",
          completed_units: 3, total_units: 8, finished: false,
          finished_at: null, certificate_id: null,
          updated_at: "2026-11-11T10:00:00Z",
          practice_status: null, practical_certificate_id: null,
        },
      ],
    } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?hub=levels");
  await expect(page.getByTestId("development-level-requirements")).toBeVisible();
  await expect(page.getByTestId("development-required-courses").locator("li")).toHaveCount(2);
}

for (const mode of ["blue", "midnight", "light"] as const) {
  test(`Development mobile courses remain tappable and readable in ${mode} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDevelopment(page, mode);

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const requirements = page.getByTestId("development-level-requirements");
      await expect(requirements).toBeVisible();

      const actualMode = await page.locator("html").getAttribute("data-impulse-visual-mode");
      expect(actualMode).toBe(mode);
      await expect(page.getByRole("navigation", { name: "Подразделы развития" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Обязательные курсы" })).toBeVisible();

      // The compact topbar moves search onto a second row on phones.
      // Its fixed search control must never cover the first page label.
      const search = await page.locator(".topbar .global-search").boundingBox();
      const heading = await page.locator(".development-hub__header .development-hub__eyebrow").boundingBox();
      if (search === null || heading === null) throw new Error("Mobile header geometry unavailable");
      expect(
        heading.y - (search.y + search.height),
        `Development heading clears global search at ${String(width)}px`,
      ).toBeGreaterThanOrEqual(8);

      const levelLabel = page.locator(".development-hub__header-progress small");
      await expect(levelLabel).toBeVisible();
      await expect(levelLabel).toHaveText("Уровень Impulse");

      for (const link of [
        page.getByRole("link", { name: "Все курсы" }),
        page.getByRole("link", { name: "Открыть курс Надёжный RAG" }),
      ]) {
        await expect(link).toBeVisible();
        const rectangle = await link.boundingBox();
        if (rectangle === null) throw new Error("Development course control disappeared");
        expect(rectangle.height, `Tap target at ${String(width)}px`).toBeGreaterThanOrEqual(44);
        expect(rectangle.x, "Action starts inside the document").toBeGreaterThanOrEqual(0);
        expect(rectangle.x + rectangle.width, "Action ends inside the document").toBeLessThanOrEqual(width + 2);
      }

      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(geometry.content - geometry.viewport, `No document overflow at ${String(width)}px`)
        .toBeLessThanOrEqual(2);

      await page.screenshot({
        path: `test-results/development-mobile-${mode}-${String(width)}.png`,
        fullPage: true,
      });
    }
  });
}

test("Development course links keep the authorized route and Browser Back on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openDevelopment(page, "blue");
  const course = page.getByRole("link", { name: "Открыть курс Надёжный RAG" });
  await expect(course).toHaveAttribute("href", "/workspace/2?role=python&course=rag-mvp&panel=detail");
  await course.click();
  await expect(page).toHaveURL(/\/workspace\/2\?role=python&course=rag-mvp&panel=detail/);
  await page.goBack();
  await expect(page).toHaveURL(/\/workspace\/1\?hub=levels/);
  await expect(page.getByTestId("development-required-courses")).toBeVisible();
});

test("Development tap targets stay keyboard-accessible without animation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDevelopment(page, "midnight");
  const target = page.getByRole("link", { name: "Открыть курс Надёжный RAG" });
  await target.focus();
  await expect(target).toHaveCSS("outline-style", "solid");
  const height = await target.evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(44);
});
