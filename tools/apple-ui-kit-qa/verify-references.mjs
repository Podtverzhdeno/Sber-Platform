#!/usr/bin/env node
// Read-only QA for the owner-controlled Apple UI kit reference tree.
// Run: node tools/apple-ui-kit-qa/verify-references.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../Apple UI kit");
const errors = [];
const tested = { main: 0, advanced: 0, svg: 0, documentation: 0, workbench: 0 };

function check(label, callback) {
  try { callback(); }
  catch (error) { errors.push({label, reason: String(error.message || error)}); }
}
function read(relative) {
  const path = resolve(root, relative);
  assert.ok(path.startsWith(root + sep), "Path escaped kit directory: " + relative);
  assert.ok(existsSync(path), "File missing: " + relative);
  assert.ok(statSync(path).isFile(), "Expected file: " + relative);
  return readFileSync(path, "utf8");
}
const json = path => JSON.parse(read(path));

function verifySvg(relative, expectedWidth, expectedHeight) {
  const content = read(relative);
  assert.ok(content.startsWith("<svg "), "SVG opening tag missing");
  assert.ok(content.trim().endsWith("</svg>"), "SVG closing tag missing");
  assert.ok(content.includes('xmlns="http://www.w3.org/2000/svg"'), "Missing SVG namespace");
  assert.match(content, new RegExp('width="' + expectedWidth + '"'));
  assert.match(content, new RegExp('height="' + expectedHeight + '"'));
  assert.ok(content.includes("<title"), "Missing accessible SVG title");
  assert.ok(content.includes("<desc"), "Missing accessible SVG description");
  assert.doesNotMatch(content, /<(?:script|foreignObject|image|iframe)\b/i, "External or active markup forbidden");
  assert.doesNotMatch(content, /\b(?:xlink:href|href)\s*=/i, "Linked external SVG resources forbidden");
  assert.doesNotMatch(content, /javascript\s*:/i);
  assert.doesNotMatch(content, /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i, "Unescaped XML entity");
  // Tiny XML tag-stack validator (our generated SVGs use no CDATA/doctype).
  const stack = [];
  const tags = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>/g;
  let item, count = 0;
  while ((item = tags.exec(content)) !== null) {
    count++;
    const closing = Boolean(item[1]), name = item[2], attributes = item[3];
    if (closing) assert.equal(stack.pop(), name, "Mismatched closing tag: " + name);
    else if (!attributes.trim().endsWith("/")) stack.push(name);
  }
  assert.ok(count > 10, "Suspiciously small illustration");
  assert.deepEqual(stack, [], "SVG unclosed tags");
  tested.svg++;
}

function verifyCaseDocs(relative, sourceUrl) {
  const content = read(relative);
  assert.ok(content.length > 350, "Case documentation too short");
  assert.match(content, /developer\.apple\.com\/design\/resources/);
  assert.match(content, /(?:not an Apple|не.*Apple|not official|Apple artwork|Apple UI Kits)/i, "Need a clear provenance notice");
  assert.ok(sourceUrl.startsWith("https://developer.apple.com/"), "Source must be first-party Apple HIG");
  tested.documentation++;
}

check("reference-cases/manifest", () => {
  const doc = json("reference-cases/manifest.json");
  assert.equal(doc.total_cases, 16);
  assert.equal(doc.cases.length, 16);
  const unique = new Set();
  for (const c of doc.cases) {
    check("reference-cases/" + c.slug, () => {
      assert.match(c.slug, /^0[1-9]-|^1[0-6]-/);
      assert.ok(!unique.has(c.slug), "Duplicate case slug");
      unique.add(c.slug);
      assert.equal(c.pixel_verified, false, "Unverified pixels cannot be marked as verified");
      assert.equal(c.measured_from_official_kit, false);
      const base = "reference-cases/" + c.slug + "/";
      verifySvg(base + (c.vector || "cover.svg"), 1200, 760);
      verifyCaseDocs(base + (c.readme || "README.md"), c.source_url);
      tested.main++;
    });
  }
});

check("advanced-cases/manifest", () => {
  const doc = json("advanced-cases/manifest.json");
  assert.equal(doc.case_count, 10);
  assert.equal(doc.svg_count, 20);
  assert.equal(doc.cases.length, 10);
  assert.equal(doc.not_official_apple_assets, true);
  const seen = new Set();
  for (const c of doc.cases) {
    check("advanced-cases/" + c.folder, () => {
      assert.ok(!seen.has(c.folder), "Duplicate case folder");
      seen.add(c.folder);
      assert.equal(c.official_kit_measured, false);
      assert.equal(c.checked_pixel_parity, false);
      assert.deepEqual([...c.images].sort(), ["dark.svg", "light.svg"]);
      const base = "advanced-cases/" + c.folder + "/";
      verifySvg(base + "dark.svg", 1280, 760);
      verifySvg(base + "light.svg", 1280, 760);
      verifyCaseDocs(base + "README.md", c.source);
      tested.advanced++;
    });
  }
});

check("fidelity-workbench/QA contract", () => {
  const contract = json("fidelity-workbench/qa-contract.json");
  assert.equal(contract.rules.diff_requires_equal_pixel_dimensions, true);
  assert.equal(contract.rules.resize_before_compare, false);
  assert.deepEqual(contract.rules.threshold_range, [0, 100]);
  const html = read("fidelity-workbench/index.html");
  const css = read("fidelity-workbench/styles.css");
  const js = read("fidelity-workbench/app.js");
  read("fidelity-workbench/README.md");
  read("fidelity-workbench/acceptance-checklist.md");
  assert.match(html, /id="source-input"/);
  assert.match(html, /id="target-input"/);
  assert.match(html, /id="diff-canvas"/);
  assert.match(js, /function calculate\(/);
  assert.match(js, /(?:function\s+dimensionsMatch\s*\(|const\s+dimensionsMatch\s*=\s*\(\)\s*=>)/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
  assert.doesNotMatch(js, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\s*\(/);
  assert.ok(css.includes("prefers-reduced-motion"));
  tested.workbench++;
});

console.log("Apple UI Kit QA:", JSON.stringify(tested));
if (errors.length) {
  for (const e of errors) console.error("FAIL", e.label, e.reason);
  console.error(errors.length + " checks failed.");
  process.exitCode = 1;
} else {
  console.log("PASS: 16 base cases, 10 advanced cases, 36 self-contained SVGs, standalone workbench.");
}
