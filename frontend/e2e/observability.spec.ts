import { expect, test } from "@playwright/test";
import { attachDiagnostics, collectPageDiagnostics, sanitizeDiagnostic } from "./support/diagnostics";

test("diagnostics redact credentials from URLs and bearer headers", () => {
  expect(sanitizeDiagnostic("GET /api?token=abcd&code=xyz&api_key=secret")).toBe(
    "GET /api?token=[REDACTED]&code=[REDACTED]&api_key=[REDACTED]",
  );
  expect(sanitizeDiagnostic("Bearer abc.def.ghi")).toBe("Bearer [REDACTED]");
  expect(sanitizeDiagnostic("https://site.test/path?session=private#part")).not.toContain("private");
  expect(sanitizeDiagnostic("x".repeat(1500))).toHaveLength(1200);
});

test("browser errors and failed API calls leave a redacted diagnostic artifact", async ({ page }, testInfo) => {
  const events = collectPageDiagnostics(page);
  await page.route("**/observability-test-api?token=private-value", route =>
    route.fulfill({ status: 503, body: "temporary outage" }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/observability-test-api?token=private-value");
    console.error("observable test console failure");
    setTimeout(() => { throw new Error("observable test page error"); }, 0);
  });
  await expect.poll(() => events.some(e => e.kind === "pageerror")).toBe(true);
  await attachDiagnostics(testInfo, events);
  expect(events.some(e => e.kind === "http-5xx" && e.detail.includes("503"))).toBe(true);
  expect(events.some(e => e.kind === "console-error" && e.detail.includes("observable test"))).toBe(true);
  expect(events.some(e => e.kind === "pageerror" && e.detail.includes("observable test"))).toBe(true);
  expect(JSON.stringify(events)).not.toContain("private-value");
});

test("analytics navigation emits an inspectable diagnostics report", async ({ page }, testInfo) => {
  const events = collectPageDiagnostics(page);
  await page.goto("/workspace/9");
  await expect(page.locator("body")).toBeVisible();
  await attachDiagnostics(testInfo, events);
  // This is a diagnostic smoke check. Real database-backed participant
  // assertions remain a separate mandatory acceptance criterion (issue #135).
  expect(events.filter(e => e.kind === "pageerror"), JSON.stringify(events)).toEqual([]);
});
