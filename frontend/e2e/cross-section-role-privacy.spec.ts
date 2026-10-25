import { expect, test, type Page } from "@playwright/test";

type RoleActor = {
  person_id: string;
  active_role: string;
  navigation: string[];
};

async function logInAs(page: Page, personaKey: string): Promise<RoleActor> {
  const response = await page.context().request.post("/api/v1/auth/demo-login", {
    data: { persona_key: personaKey },
  });
  expect(response.status(), `Login failed for ${personaKey}`).toBe(200);
  const me = await page.context().request.get("/api/v1/me");
  expect(me.status(), `Actor context missing for ${personaKey}`).toBe(200);
  return await me.json() as RoleActor;
}

async function status(page: Page, path: string): Promise<number> {
  return (await page.context().request.get(path)).status();
}

test("real PostgreSQL enforces owner-only evidence across every participant and enterprise role", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");

  const alex = await logInAs(page, "participant-alex");
  expect(alex.active_role).toBe("participant");
  expect(await status(page, "/api/v1/me/journey/snapshot")).toBe(200);
  expect(await status(page, "/api/v1/me/rating/standings")).toBe(200);
  expect(await status(page, "/api/v1/me/talent-passport")).toBe(200);
  expect(await status(page, "/api/v1/me/portfolio")).toBe(200);
  expect(await status(page, "/api/v1/agents/buddy/suggestion")).toBe(200);

  // A second participant has an independent snapshot, never Alex's evidence.
  const maria = await logInAs(page, "participant-maria");
  expect(maria.active_role).toBe("participant");
  expect(maria.person_id).not.toBe(alex.person_id);
  const own = await page.context().request.get("/api/v1/me/journey/snapshot");
  expect(own.status()).toBe(200);
  const ownSnapshot = await own.json() as { person_id: string };
  expect(ownSnapshot.person_id).toBe(maria.person_id);
  expect(ownSnapshot.person_id).not.toBe(alex.person_id);
  const ownRank = await page.context().request.get("/api/v1/me/rating/standings");
  expect(ownRank.status()).toBe(200);
  expect(JSON.stringify(await ownRank.json())).not.toContain(alex.person_id);

  for (const personaKey of [
    "mentor-elena", "customer-roman", "manager-olga", "hr-nina", "operator-pavel",
  ]) {
    const actor = await logInAs(page, personaKey);
    expect(actor.active_role).not.toBe("participant");
    expect(actor.navigation).not.toContain("AI-Buddy");
    expect(actor.navigation).not.toContain("AI Buddy");

    for (const endpoint of [
      "/api/v1/me/journey/snapshot",
      "/api/v1/me/rating/standings",
      "/api/v1/me/talent-passport",
      "/api/v1/me/portfolio",
      "/api/v1/agents/buddy/suggestion",
    ]) {
      const forbidden = await page.context().request.get(endpoint);
      expect(
        [403, 404],
        `${personaKey} must not read ${endpoint}; got ${String(forbidden.status())}`,
      ).toContain(forbidden.status());
      expect(await forbidden.text()).not.toContain(alex.person_id);
      expect(await forbidden.text()).not.toContain(maria.person_id);
    }

    // A new navigation tree must not include stale participant-only Buddy UI.
    await page.reload();
    await expect(page.getByTestId("buddy-live-context")).toHaveCount(0);
  }

  const returned = await logInAs(page, "participant-alex");
  expect(returned.person_id).toBe(alex.person_id);
  const back = await page.context().request.get("/api/v1/me/journey/snapshot");
  expect(back.status()).toBe(200);
  expect((await back.json() as { person_id: string }).person_id).toBe(alex.person_id);
});
