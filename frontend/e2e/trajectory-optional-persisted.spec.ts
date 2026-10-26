import { expect, test } from "@playwright/test";

/**
 * Unlike the UI-only optional-trajectory fixture test, this test deliberately
 * makes no page.route overrides: the CI job runs a real API and PostgreSQL.
 */
test("real DB: grey AI role → optional trajectory → complete course → grey → restore", async ({ page }) => {
  test.setTimeout(120_000);
  const trackKey = "backend"; // MLOps Engineer: an initially grey, unenrolled role in the seeded catalog
  const courseKey = "demo-course-1"; // First published MLOps Engineer course

  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  const loggedIn = page.waitForResponse(response =>
    response.request().method() === "POST" && response.url().endsWith("/api/v1/auth/demo-login"),
  );
  await page.locator('[data-persona="participant-alex"]').click();
  expect((await loggedIn).ok()).toBe(true);
  await expect.poll(async () =>
    (await page.request.get("/api/v1/me")).status(),
  ).toBe(200);

  type Role = { track_key: string; state: string; attempt_number: number | null };
  const getOverview = async (): Promise<{ roles: Role[] }> => {
    const response = await page.request.get("/api/v1/participant/me/development-overview");
    expect(response.ok(), `Overview status ${String(response.status())}: ${(await response.text()).slice(0, 1500)}`).toBe(true);
    return await response.json() as { roles: Role[] };
  };
  const getStudy = async (): Promise<{
    completed_units: number; finished: boolean; certificate_id: string | null;
  }> => {
    const response = await page.request.get(
      `/api/v1/me/bootcamp/impulse-study/${courseKey}`,
    );
    expect(response.ok()).toBe(true);
    return await response.json() as {
      completed_units: number; finished: boolean; certificate_id: string | null;
    };
  };
  const before = await getOverview();
  const primaryBefore = before.roles.filter(role => role.state === "active").map(role => role.track_key);
  expect(primaryBefore.length).toBeGreaterThan(0);
  expect(before.roles.find(role => role.track_key === trackKey)?.state).toBe("unselected");

  await page.goto(`/workspace/1?role=${trackKey}`);
  const selected = page.getByTestId("trajectory-role-detail");
  const optional = page.locator(`.trajectory-v2-role-card[data-role-key="${trackKey}"]`);

  // Repair prior test state if this seeded persona was already exploring.
  if (await selected.getByRole("button", { name: "Сделать карточку серой" }).isVisible()) {
    await selected.getByRole("button", { name: "Сделать карточку серой" }).click();
  }
  await expect(optional).toHaveAttribute("data-tone", "unselected");
  await selected.getByRole("button", { name: "Изучать дополнительно →" }).click();
  await expect(optional).toHaveAttribute("data-tone", "learning");
  expect((await getOverview()).roles.find(role => role.track_key === trackKey)?.state).toBe("learning");

  // The user's real course is completed through Bootcamp UI and saved by API.
  await page.goto(`/workspace/2?course=${courseKey}&role=${trackKey}`);
  const reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  const earlier = await getStudy();
  if (!earlier.finished) {
    await reader.getByRole("button", { name: /Перейти к программе/ }).click();
    await reader.locator(".imp-study__program-list button").first().click();
    for (let lesson = earlier.completed_units; lesson < 8; lesson++) {
      await reader.locator(".imp-study__navigation .imp-study__primary").click();
    }
    await reader.locator(".imp-study__finish").click();
    await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();
  }
  const finished = await getStudy();
  expect(finished.finished).toBe(true);
  expect(finished.completed_units).toBe(8);
  expect(finished.certificate_id).not.toBeNull();

  // UI state and server state must both return to grey without deleting study.
  await page.goto(`/workspace/1?role=${trackKey}`);
  await selected.getByRole("button", { name: "Сделать карточку серой" }).click();
  await expect(optional).toHaveAttribute("data-tone", "unselected");
  await page.reload();
  await expect(optional).toHaveAttribute("data-tone", "unselected");
  const archived = await getOverview();
  expect(archived.roles.find(role => role.track_key === trackKey)?.attempt_number).toBeNull();
  expect(await getStudy()).toMatchObject({
    finished: true,
    completed_units: 8,
    certificate_id: finished.certificate_id,
  });

  // Reopen and verify the same persisted course, unchanged primary and role.
  await selected.getByRole("button", { name: "Изучать дополнительно →" }).click();
  await expect(optional).toHaveAttribute("data-tone", "learning");
  await page.reload();
  await expect(optional).toHaveAttribute("data-tone", "learning");
  const reopened = await getOverview();
  expect(reopened.roles.find(role => role.track_key === trackKey)?.attempt_number).not.toBeNull();
  expect(reopened.roles.filter(role => role.state === "active").map(role => role.track_key))
    .toEqual(primaryBefore);
  expect(await getStudy()).toMatchObject({
    finished: true, completed_units: 8, certificate_id: finished.certificate_id,
  });
});
