import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const stylesPath = existsSync(new URL("../src/styles.css", import.meta.url))
  ? "../src/styles.css"
  : "../src/styles.scss";
const styles = await readFile(new URL(stylesPath, import.meta.url), "utf8");

const failures = [];
if (!html.includes("Content-Security-Policy")) failures.push("CSP meta is missing");
if (!html.includes("object-src 'none'")) failures.push("CSP object-src is not locked down");
if (html.includes("frame-ancestors")) failures.push("frame-ancestors must be delivered as an HTTP header, not meta");
if (html.includes("'unsafe-inline'")) failures.push("production CSP allows unsafe inline code");
if (/<script(?![^>]*\bsrc=)[^>]*>/iu.test(html)) failures.push("inline script found");
if (/\son[a-z]+\s*=/iu.test(html)) failures.push("inline event handler found");
if (/javascript:/iu.test(html)) failures.push("javascript URL found");
if (!styles.includes("prefers-reduced-motion: reduce")) failures.push("reduced-motion fallback missing");

// R-MSG-01 production boundary (25.7): the user-visible surface is our own
// messenger shell. The reference compositions must never ship their source
// artifacts or hardcode real content, endpoints, keys or embedded binaries.
const bundleFiles = ["../dist/index.html"];
if (existsSync(new URL("../public/theme-init.js", import.meta.url))) {
  bundleFiles.push("../public/theme-init.js");
}
for (const asset of await readdir(new URL("../dist/assets", import.meta.url))) {
  bundleFiles.push(`../dist/assets/${asset}`);
}
let bundle = "";
for (const file of bundleFiles) {
  bundle += `${await readFile(new URL(file, import.meta.url), "utf8")}\n`;
}

if (bundle.includes("СберЧат")) failures.push("reference app marker «СберЧат» leaked into the bundle");
if (/[Dd]ownloads[/\\]/u.test(bundle)) failures.push(
  "Downloads path leaked into the bundle",
);
if (/data:(?:image|font)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{384,}/u.test(bundle)) {
  failures.push("large embedded base64 asset found in the bundle");
}
if (
  /(?:sk-[A-Za-z0-9]{16,}|sk_live_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,})/u.test(bundle)
) {
  failures.push("hardcoded secret-like key found in the bundle");
}

const urlAllowlist = [
  "http://www.w3.org/",
  "https://react.dev/errors/",
  "https://reactrouter.com/en/main/routers/picking-a-router.",
  "https://github.com/ungap/",
  "http://localhost",
  "https://example.org/demo-evidence",
  "https://github.com/impulse/project",
  "https://developers.sber.ru/",
];
// Exact, reviewed documentation links used by the editorial Bootcamp curriculum.
// Do not use a hostname wildcard: an unrelated URL must still fail the bundle scan.
const approvedLearningUrls = new Set([
  "https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md",
  "https://reference.langchain.com/python/langgraph/overview",
  "https://docs.python.org/3/tutorial/",
  "https://fastapi.tiangolo.com/tutorial/",
  "https://www.postgresql.org/docs/18/tutorial.html",
  "https://developers.google.com/analytics/devguides/collection/ga4/events",
  "https://developers.google.com/machine-learning/crash-course",
  "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
  "https://docs.pytest.org/en/stable/getting-started.html",
  "https://owasp.org/projects/web-security-testing-guide",
  "https://developers.google.com/tech-writing",
  "https://handbook.gitlab.com/handbook/engineering/workflow/code-review/",
  "https://python.reference.langfuse.com/langfuse",
  "https://git-scm.com/book/en/v2",
  "https://playwright.dev/docs/intro",
  "https://genai.owasp.org/glossary/prompt-injection/",
  "https://airc.nist.gov/airmf-resources/playbook/",
]);
for (const match of bundle.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#@!$&()+,;=%-]{3,}/gu)) {
  if (!approvedLearningUrls.has(match[0]) && !urlAllowlist.some((prefix) => match[0].startsWith(prefix))) {
    failures.push(`URL outside the allowlist leaked into the bundle: ${match[0]}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Frontend security check failed:\n- ${failures.join("\n- ")}`);
}
console.log("Frontend CSP, inline-code, reduced-motion and R-MSG-01 boundary checks passed");
