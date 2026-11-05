import type { Page, TestInfo } from "@playwright/test";

export type DiagnosticEvent = {
  kind: "pageerror" | "console-error" | "request-failed" | "http-5xx";
  detail: string;
};

const SENSITIVE = /([?&](?:token|access_token|refresh_token|code|key|api_key|password|secret|session|auth|authorization|csrf_token)=)[^&#\s]+/gi;

export function sanitizeDiagnostic(value: string): string {
  return value
    .replace(SENSITIVE, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, "$1[REDACTED]")
    .slice(0, 1200);
}

export function collectPageDiagnostics(page: Page) {
  const events: DiagnosticEvent[] = [];
  const record = (kind: DiagnosticEvent["kind"], detail: string) => {
    if (events.length < 200) events.push({ kind, detail: sanitizeDiagnostic(detail) });
  };
  page.on("pageerror", error => record("pageerror", error.message));
  page.on("console", message => {
    if (message.type() === "error") record("console-error", message.text());
  });
  page.on("requestfailed", request => {
    record("request-failed", `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", response => {
    if (response.status() >= 500) {
      record("http-5xx", `${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return events;
}

export async function attachDiagnostics(testInfo: TestInfo, events: DiagnosticEvent[]) {
  await testInfo.attach("browser-diagnostics", {
    body: Buffer.from(JSON.stringify({ count: events.length, events }, null, 2)),
    contentType: "application/json",
  });
}
