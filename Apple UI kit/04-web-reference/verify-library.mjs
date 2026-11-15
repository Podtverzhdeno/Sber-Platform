#!/usr/bin/env node
/**
 * Offline integrity checks for Apple UI kit reference library.
 * No external requests, no Apple assets downloaded and no production app touched.
 * Run from any working directory: node "Apple UI kit/04-web-reference/verify-library.mjs"
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const libraryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let errors = [];
let passed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    errors.push(message);
  }
}

function text(path) {
  const file = join(libraryRoot, path);
  check(existsSync(file), "Missing file: " + path);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const files = [
  "README.md",
  "01-sources/official-links.md",
  "01-sources/source-manifest.json",
  "02-specifications/liquid-glass.md",
  "02-specifications/foundations.md",
  "02-specifications/component-catalog.md",
  "02-specifications/patterns-and-states.md",
  "03-impulse/integration-map.md",
  "03-impulse/visual-qa-checklist.md",
  "04-web-reference/README.md",
  "04-web-reference/impulse-apple-tokens.css",
  "04-web-reference/reference-gallery.html",
  "04-web-reference/casebook.html",
  "04-web-reference/casebook.css",
  "04-web-reference/casebook.js",
  "05-legal-and-sources/LICENSING.md",
  "06-cases/README.md",
  "06-cases/case-matrix.json",
  "04-web-reference/compare-screenshots.py",
  "04-web-reference/visual-comparison.md"
];
for (const file of files) check(text(file).length > 80, "Empty or too short: " + file);

const cases = [
  "01-navigation",
  "02-liquid-glass",
  "03-messaging",
  "04-inputs-and-controls",
  "05-overlays-and-dialogs",
  "06-data-and-dashboards",
  "07-mobile-adaptive",
  "08-accessibility",
  "09-search-and-command",
  "10-notifications-and-feedback",
  "11-identity-and-settings",
  "12-media-and-attachments"
];
for (const slug of cases) {
  const file = "06-cases/" + slug + "/README.md";
  const content = text(file);
  check(content.includes("https://developer.apple.com/") || content.includes("https://www.figma.com/"),
    "No official Apple reference URL: " + file);
  check(content.length > 500, "Case too short: " + file);
}

const manifest = JSON.parse(text("01-sources/source-manifest.json"));
check(Array.isArray(manifest.sources) && manifest.sources.length >= 10, "Manifest has too few sources");
const ids = new Set();
for (const source of manifest.sources ?? []) {
  check(typeof source.id === "string" && source.id.length > 0, "Source without id");
  check(typeof source.url === "string" && /^https:\/\//.test(source.url), "Non-HTTPS source: " + source.id);
  check(!ids.has(source.id), "Duplicate source id: " + source.id);
  ids.add(source.id);
}
const caseMatrix = JSON.parse(text("06-cases/case-matrix.json"));
check(Array.isArray(caseMatrix.cases) && caseMatrix.cases.length === 12, "Case matrix must have 12 entries");
const seenCaseIds = new Set();
for (const row of caseMatrix.cases ?? []) {
  check(cases.includes(row.id), "Unknown case ID: " + row.id);
  check(!seenCaseIds.has(row.id), "Duplicate case: " + row.id);
  seenCaseIds.add(row.id);
  check(typeof row.readme === "string" && existsSync(join(libraryRoot, "06-cases", row.readme)),
    "Missing case README mapping: " + row.id);
  for (const sourceId of row.source_ids ?? []) {
    check(ids.has(sourceId), "Unresolved source reference " + sourceId + " in " + row.id);
  }
  check(Array.isArray(row.required_states) && row.required_states.length > 0,
    "Missing required state coverage: " + row.id);

  // Reference maps use concrete repository files, not extensionless imports.
  // Permit distributing this reference folder standalone: skip path checks if
  // frontend source is absent; GitHub CI checks them in the complete repository.
  const repoRoot = resolve(libraryRoot, "..");
  if (existsSync(join(repoRoot, "frontend/src/App.tsx"))) {
    check(Array.isArray(row.impulse_paths) && row.impulse_paths.length > 0,
      "Missing IMPULSE file paths: " + row.id);
    for (const target of row.impulse_paths ?? []) {
      const resolvedTarget = resolve(repoRoot, target);
      const relativeTarget = relative(repoRoot, resolvedTarget);
      check(typeof target === "string"
        && /^frontend\/src\/[A-Za-z0-9_./-]+\.(?:ts|tsx|css|scss)$/.test(target)
        && relativeTarget.length > 0 && !relativeTarget.startsWith("..")
        && !isAbsolute(relativeTarget)
        && existsSync(resolvedTarget),
        "Unresolved concrete IMPULSE file: " + row.id + " -> " + target);
    }
  }
}

// Verify each standalone original SVG, provenance manifest and local gallery links.
const vectorManifest = JSON.parse(text("06-cases/visual-manifest.json"));
check(Array.isArray(vectorManifest.cards) && vectorManifest.cards.length === 12,
  "Vector gallery manifest must contain 12 cases");
const seenVectorIds = new Set();
for (const card of vectorManifest.cards ?? []) {
  check(cases.includes(card.id), "Unknown vector case: " + card.id);
  check(!seenVectorIds.has(card.id), "Duplicate vector case: " + card.id);
  seenVectorIds.add(card.id);
  check(card.measured_from_apple === false && card.verified_pixel_parity === false,
    "Vector board must not claim Apple pixel parity: " + card.id);
  const relative = "06-cases/" + card.image;
  const xml = text(relative);
  check(xml.startsWith('<?xml version="1.0"') && xml.includes('<svg') && xml.includes('</svg>'),
    "Missing SVG root or closing tag: " + relative);
  check(!/<script\b|<foreignObject\b|https?:[^"'\s]*\.(png|jpg|webp|svg)/i.test(xml),
    "Unexpected embedded script/external asset in " + relative);
  check(card.image === card.id + "/reference-board.svg",
    "Incorrect case SVG path: " + card.id);
}
const visualGallery = text("06-cases/visual-gallery.html");
for (const card of vectorManifest.cards ?? []) {
  check(visualGallery.includes('./' + card.image), "Visual gallery has no linked SVG: " + card.id);
}

const html = text("04-web-reference/casebook.html");
for (const localHref of html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) {
  const local = resolve(libraryRoot, "04-web-reference", localHref[1]);
  check(existsSync(local), "Broken casebook relative resource: " + localHref[1]);
}
for (const section of ["overview", "navigation", "messaging", "controls", "materials"]) {
  check(html.includes('data-section="' + section + '"'), "Missing casebook section: " + section);
}
const css = text("04-web-reference/impulse-apple-tokens.css");
for (const selector of ['data-theme="dark"', "prefers-reduced-motion", "forced-colors", "backdrop-filter"]) {
  check(css.includes(selector), "Missing token fallback: " + selector);
}
const jsResult = spawnSync(process.execPath, [
  "--check",
  join(libraryRoot, "04-web-reference/casebook.js")
], { encoding: "utf8" });
check(jsResult.status === 0, "casebook.js syntax check failed: " + jsResult.stderr);

if (errors.length) {
  console.error("Apple UI kit verification FAILED (" + errors.length + "):");
  errors.forEach((message) => console.error(" - " + message));
  process.exitCode = 1;
} else {
  console.log("Apple UI kit verification passed: " + passed + " offline checks");
  console.log("Notes: this does NOT test visual parity with Apple, external link availability, browser runtime or frontend CI.");
}
