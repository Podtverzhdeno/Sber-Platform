import { expect, test } from "@playwright/test";

const preview = "/src/features/trajectory-v2/source-reference/preview.html";

test("TRJ source composition desktop 1672×1038 has exact DOM atom order", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1038 });
  await page.goto(preview);
  const shell = page.locator(".trj-source");
  await expect(shell).toBeVisible();
  await expect(shell.locator(".role-card")).toHaveCount(7);
  await expect(shell.locator(".milestone")).toHaveCount(7);
  await expect(shell.locator(".task-row")).toHaveCount(3);
  await expect(shell.locator(".right-stack > section")).toHaveCount(3);

  const regions = await Promise.all(
    [".roles-grid", ".role-detail", ".stage-card", ".grade-card", ".next-card", ".skills-card"].map(selector => shell.locator(selector).boundingBox()),
  );
  const [roles, role, stage, grade, next, skills] = regions;
  if (!roles || !role || !stage || !grade || !next || !skills) throw new Error("Incomplete source composition");
  expect(role.y).toBeGreaterThan(roles.y);
  expect(grade.x).toBeGreaterThan(role.x + role.width - 3);
  expect(stage.y).toBeGreaterThan(role.y + role.height - 3);
  expect(next.y).toBeGreaterThan(grade.y + grade.height - 3);
  expect(skills.y).toBeGreaterThan(next.y + next.height - 3);

  await test.info().attach("TRJ-SCREEN-01-source-react-desktop", {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
});

test("TRJ source composition mobile 390px preserves two-column roles and horizontal roadmap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(preview);
  const shell = page.locator(".trj-source");
  await expect(shell.locator(".role-card")).toHaveCount(7);
  const boxes = await Promise.all([0, 1, 2].map(index => shell.locator(".role-card").nth(index).boundingBox()));
  const [a, b, c] = boxes;
  if (!a || !b || !c) throw new Error("Role cards were not laid out");
  expect(Math.abs(a.y - b.y)).toBeLessThan(3);
  expect(b.x).toBeGreaterThan(a.x);
  expect(c.y).toBeGreaterThan(a.y);
  const scroll = await shell.locator(".roadmap-steps").evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(scroll.content).toBeGreaterThan(scroll.width);
  await test.info().attach("TRJ-SCREEN-06-source-react-mobile", {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
});
