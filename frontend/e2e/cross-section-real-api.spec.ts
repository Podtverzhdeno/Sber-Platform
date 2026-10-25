import { expect, test, type Page } from "@playwright/test";

/** Real browser and PostgreSQL: no Playwright route fulfillment/mocked data. */
async function api<T>(
  page: Page,
  path: string,
  options: { method?: string; csrf?: string; data?: unknown } = {},
): Promise<T> {
  const result = await page.context().request.fetch(path, {
    method: options.method ?? "GET",
    headers: options.csrf ? { "X-CSRF-Token": options.csrf } : undefined,
    data: options.data,
    failOnStatusCode: false,
  });
  const body = await result.json() as T;
  expect(result.status(), `${options.method ?? "GET"} ${path}: ${JSON.stringify(body)}`).toBe(200);
  return body;
}

type Actor = { person_id: string; navigation: string[] };
type Course = { key: string; access_state: string };
type StudySummary = {
  finished_courses: number;
  courses: {
    course_key: string; finished: boolean; certificate_id: string | null;
  }[];
};
type Journey = {
  person_id: string;
  verified_provider_course_count: number;
  courses: {
    course_key: string; provider_verified: boolean;
    self_study: { finished: boolean; certificate_id: string | null } | null;
    roadmap_links: { milestone_completed: boolean }[];
  }[];
};
type Passport = { skills: { key: string; confirmed_case_count: number }[] };
type OwnRank = { season_id: string; place: number | null; score: string | number | null }[];

test("real PostgreSQL course completion propagates to analytics, trajectory and Buddy without awards", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  const signedIn = await api<{ csrf_token: string }>(
    page, "/api/v1/auth/demo-login",
    { method: "POST", data: { persona_key: "participant-alex" } },
  );
  const csrf = signedIn.csrf_token;
  const actor = await api<Actor>(page, "/api/v1/me");
  const analyticsIndex = actor.navigation.indexOf("Аналитика");
  const trajectoryIndex = actor.navigation.indexOf("Моя траектория");
  const buddyIndex = actor.navigation.findIndex(name => name === "AI-Buddy" || name === "AI Buddy");
  expect(analyticsIndex).toBeGreaterThanOrEqual(0);
  expect(trajectoryIndex).toBeGreaterThanOrEqual(0);
  expect(buddyIndex).toBeGreaterThanOrEqual(0);

  const available = await api<Course[]>(page, "/api/v1/me/bootcamp/catalog");
  const course = available.find(item =>
    /^demo-course-\d+$/.test(item.key) && item.access_state === "available",
  );
  expect(course, "An unlocked real Impulse course is required for this E2E").toBeTruthy();
  const courseKey = course?.key ?? "";
  const endpoint = `/api/v1/me/bootcamp/impulse-study/${encodeURIComponent(courseKey)}`;
  const summaryBefore = await api<StudySummary>(page, "/api/v1/me/bootcamp/impulse-study/summary");
  const prior = summaryBefore.courses.find(item => item.course_key === courseKey);
  expect(prior?.finished ?? false).toBe(false);
  const gradeBefore = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  const skillsBefore = await api<Passport>(page, "/api/v1/me/talent-passport");
  const rankBefore = await api<OwnRank>(page, "/api/v1/me/rating/standings");

  for (let unit = 0; unit < 8; unit++) {
    await api(page, `${endpoint}/lessons/${String(unit)}/complete`, { method: "POST", csrf });
  }
  const finished = await api<{ certificate_id: string; finished: boolean }>(
    page, `${endpoint}/finish`, { method: "POST", csrf },
  );
  expect(finished.finished).toBe(true);
  expect(finished.certificate_id).toBeTruthy();
  const duplicate = await api<{ certificate_id: string }>(
    page, `${endpoint}/finish`, { method: "POST", csrf },
  );
  expect(duplicate.certificate_id).toBe(finished.certificate_id);

  // Reload after the write; this must be in PostgreSQL, not optimistic React state.
  await page.reload();
  const summaryAfter = await api<StudySummary>(page, "/api/v1/me/bootcamp/impulse-study/summary");
  expect(summaryAfter.finished_courses).toBe(summaryBefore.finished_courses + 1);
  const persisted = summaryAfter.courses.find(item => item.course_key === courseKey);
  expect(persisted?.finished).toBe(true);
  expect(persisted?.certificate_id).toBe(finished.certificate_id);
  const joined = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  const linked = joined.courses.find(item => item.course_key === courseKey);
  expect(joined.person_id).toBe(actor.person_id);
  expect(linked?.self_study?.finished).toBe(true);
  expect(linked?.self_study?.certificate_id).toBe(finished.certificate_id);
  expect(joined.verified_provider_course_count).toBe(gradeBefore.verified_provider_course_count);
  expect(linked?.provider_verified).toBe(
    gradeBefore.courses.find(item => item.course_key === courseKey)?.provider_verified ?? false,
  );
  const skillsAfter = await api<Passport>(page, "/api/v1/me/talent-passport");
  expect(skillsAfter.skills).toEqual(skillsBefore.skills);
  const rankAfter = await api<OwnRank>(page, "/api/v1/me/rating/standings");
  expect(rankAfter).toEqual(rankBefore);

  await page.goto(`/workspace/${String(analyticsIndex)}?analyticsTab=certification`);
  const analytics = page.getByTestId("analytics-v3");
  await expect(analytics).toBeVisible();
  await expect(analytics.getByTestId("learn-finished")).toHaveText(String(summaryAfter.finished_courses));

  await page.goto(`/workspace/${String(trajectoryIndex)}`);
  const bridge = page.getByTestId("learning-progress-bridge");
  await expect(bridge).toBeVisible();
  await expect(bridge.getByTestId("learn-finished")).toHaveText(String(summaryAfter.finished_courses));

  await page.goto(`/workspace/${String(buddyIndex)}`);
  await expect(page.getByTestId("buddy-live-context")).toBeVisible();
  await expect(page.getByTestId("buddy-finished-count")).toHaveText(String(summaryAfter.finished_courses));

  await api(page, "/api/v1/auth/demo-login", {
    method: "POST", data: { persona_key: "customer-roman" },
  });
  const denied = await page.context().request.get("/api/v1/me/journey/snapshot");
  expect(denied.status()).toBe(404);
});
