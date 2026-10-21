import { expect, test, type Page } from "@playwright/test";

type ApiResult<T> = { status: number; body: T };

async function api<T>(
  page: Page,
  path: string,
  options: { method?: string; csrf?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const response = await page.context().request.fetch(path, {
    method: options.method ?? "GET",
    headers: options.csrf ? { "X-CSRF-Token": options.csrf } : undefined,
    data: options.body,
  });
  return { status: response.status(), body: (await response.json()) as T };
}

function moscowDate(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

test("participant engagement journey persists through the real API and PostgreSQL", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");

  const login = await api<{ csrf_token: string }>(page, "/api/v1/auth/demo-login", {
    method: "POST",
    body: { persona_key: "participant-alex" },
  });
  expect(login.status).toBe(200);
  expect(login.body.csrf_token).toBeTruthy();
  const csrf = login.body.csrf_token;

  const roadmaps = await api<
    Array<{
      track_key: string;
      next_step: { key: string } | null;
      milestones: Array<{ key: string }>;
    }>
  >(page, "/api/v1/me/roadmaps");
  expect(roadmaps.status).toBe(200);
  const roadmap = roadmaps.body.find((item) => item.next_step !== null) ?? roadmaps.body[0];
  expect(roadmap).toBeTruthy();
  const milestoneKey = roadmap.next_step?.key ?? roadmap.milestones[0]?.key;
  expect(milestoneKey).toBeTruthy();

  const goal = await api<{
    track_key: string;
    goal_ref: string;
    history_count: number;
    contours: { target: number };
  }>(page, "/api/v1/me/growth/monthly-goal", {
    method: "POST",
    csrf,
    body: { track_key: roadmap.track_key, milestone_key: milestoneKey },
  });
  expect(goal.status).toBe(200);
  expect(goal.body.track_key).toBe(roadmap.track_key);
  expect(goal.body.goal_ref).toContain(milestoneKey);
  expect(goal.body.contours.target).toBeGreaterThanOrEqual(1);

  const freezeBefore = await api<{
    available: number;
    consumed_total: number;
  }>(page, "/api/v1/me/engagement/freeze");
  expect(freezeBefore.status).toBe(200);
  expect(freezeBefore.body.available).toBeGreaterThanOrEqual(1);

  const runId = `${Date.now().toString(10)}-${Math.random().toString(16).slice(2)}`;
  const threeDaysAgo = moscowDate(-3);
  const twoDaysAgo = moscowDate(-2);
  const today = moscowDate(0);
  const tomorrow = moscowDate(1);
  const firstQualification = await api<{ qualified_dates: string[] }>(
    page,
    "/api/v1/me/engagement/qualify",
    {
      method: "POST",
      csrf,
      body: {
        source: "course_learning",
        source_ref: `e2e-24.7-first-${runId}`,
        occurred_at: `${threeDaysAgo}T12:00:00+03:00`,
      },
    },
  );
  expect(firstQualification.status).toBe(200);
  expect(firstQualification.body.qualified_dates).toContain(threeDaysAgo);

  const earlierQualification = await api<{ qualified_dates: string[] }>(
    page,
    "/api/v1/me/engagement/qualify",
    {
      method: "POST",
      csrf,
      body: {
        source: "course_learning",
        source_ref: `e2e-24.7-earlier-${runId}`,
        occurred_at: `${twoDaysAgo}T12:00:00+03:00`,
      },
    },
  );
  expect(earlierQualification.status).toBe(200);
  expect(earlierQualification.body.qualified_dates).toContain(twoDaysAgo);

  const freezeUse = await api<{ frozen_dates: string[]; freeze_state: string }>(
    page,
    "/api/v1/me/engagement/freeze/use",
    { method: "POST", csrf },
  );
  expect(freezeUse.status).toBe(200);
  expect(freezeUse.body.frozen_dates.length).toBeGreaterThanOrEqual(1);

  const todayQualification = await api<{ qualified_dates: string[]; today_saved: boolean }>(
    page,
    "/api/v1/me/engagement/qualify",
    {
      method: "POST",
      csrf,
      body: {
        source: "course_learning",
        source_ref: `e2e-24.7-today-${runId}`,
        occurred_at: `${today}T12:00:00+03:00`,
      },
    },
  );
  expect(todayQualification.status).toBe(200);
  expect(todayQualification.body.qualified_dates).toContain(today);
  expect(todayQualification.body.today_saved).toBe(true);

  const freezeAfter = await api<{ available: number; consumed_total: number }>(
    page,
    "/api/v1/me/engagement/freeze",
  );
  expect(freezeAfter.status).toBe(200);
  expect(freezeAfter.body.available).toBe(freezeBefore.body.available - 1);
  expect(freezeAfter.body.consumed_total).toBe(freezeBefore.body.consumed_total + 1);

  const savedRhythm = await api<{
    version: number | null;
    preset: string | null;
    reminder_hour: number | null;
  }>(page, "/api/v1/me/engagement/rhythm", {
    method: "POST",
    csrf,
    body: {
      preset: "all_week",
      custom_days: [],
      reminder_hour: 18,
      reminder_window_hours: 3,
      effective_from: tomorrow,
    },
  });
  expect(savedRhythm.status).toBe(200);
  expect(savedRhythm.body.version).toBeGreaterThanOrEqual(1);
  expect(savedRhythm.body.preset).toBe("all_week");
  expect(savedRhythm.body.reminder_hour).toBe(18);

  const persistedGoal = await api<{ track_key: string; history_count: number }>(
    page,
    "/api/v1/me/growth/monthly-goal",
  );
  expect(persistedGoal.status).toBe(200);
  expect(persistedGoal.body.track_key).toBe(roadmap.track_key);
  expect(persistedGoal.body.history_count).toBeGreaterThanOrEqual(1);

  const snapshot = await api<{
    snapshot_version: number;
    trajectories: Array<{
      track_key: string;
      completion: { percent: number; partial: boolean };
      readiness: { percent: number; coverage: number; partial: boolean };
    }>;
  }>(page, "/api/v1/me/growth/snapshot");
  expect(snapshot.status).toBe(200);
  expect(snapshot.body.snapshot_version).toBe(2);
  const trajectory = snapshot.body.trajectories.find(
    (item) => item.track_key === roadmap.track_key,
  );
  expect(trajectory).toBeTruthy();
  expect(trajectory?.completion.percent).toBeGreaterThan(0);
  expect(trajectory?.completion.partial).toBe(false);
  expect(trajectory?.readiness.coverage).toBeGreaterThan(0);

  const catalog = await api<
    Array<{ completion_state: string; verified_evidence: string | null }>
  >(page, "/api/v1/me/bootcamp/catalog");
  expect(catalog.status).toBe(200);
  expect(
    catalog.body.some(
      (course) => course.completion_state === "verified" && course.verified_evidence !== null,
    ),
  ).toBe(true);

  await page.reload();
  await expect(page).toHaveURL(/\/workspace\/0$/);
  await expect(page.locator(".streak-utility .streak-button")).toHaveAccessibleName(
    /Учебный стрик: [1-9]\d* (?:день|дня|дней)/,
  );
});
